/**
 * TEKO STORE / delete private order ZIPs older than 7 days.
 * Meant for a daily Supabase Cron HTTP job, not a browser.
 * Secrets: TEKO_CRON_SECRET (random 32+ character string).
 * Default backend: SUPABASE_URL, SUPABASE_SECRET_KEYS.
 * Verify JWT OFF, but a secret header is required to run cleanup.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "teko-orders";
const AGE = 7 * 86400 * 1000;
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
Deno.serve(async request => {
  const secret = Deno.env.get("TEKO_CRON_SECRET") || "";
  const provided = request.headers.get("x-teko-cron-key") || "";
  if (request.method !== "POST" || secret.length < 32 || !safeEqual(secret, provided)) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const adminKey = secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!adminKey) throw Error("Missing Supabase service credentials");
    const client = createClient(Deno.env.get("SUPABASE_URL")!, adminKey, {
      auth: { persistSession: false },
    });
    let deleted = 0;
    for (let batch = 0; batch < 10; batch++) {
      const { data, error } = await client.storage.from(BUCKET).list("orders", {
        limit: 100, offset: 0,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (error) throw error;
      const stale = (data || []).filter(item =>
        item.id && Number.isFinite(Date.parse(item.created_at || "")) &&
        Date.parse(item.created_at) < Date.now() - AGE
      );
      if (stale.length === 0) break;
      const paths = stale.map(file => "orders/" + file.name);
      const { error: removeError } = await client.storage.from(BUCKET).remove(paths);
      if (removeError) throw removeError;
      deleted += paths.length;
      if ((data || []).length < 100) break;
    }
    return Response.json({ ok: true, deleted }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("TEKO cleanup failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 500 });
  }
});
