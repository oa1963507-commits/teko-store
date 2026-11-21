/**
 * TEKO STORE — private ZIP retention, delete only orders/*.zip older than 7 days.
 *
 * POST with x-teko-cron-key (TEKO_CRON_SECRET 32+ chars).
 * Body {"dryRun":true} to inspect; {"dryRun":false} for daily scheduled deletion.
 * Custom secret: TEKO_CRON_SECRET. Server defaults: SUPABASE_URL,
 * SUPABASE_SECRET_KEYS.default (fallback SUPABASE_SERVICE_ROLE_KEY).
 *
 * In Supabase Edge Function settings, disable Verify JWT.
 * NEVER put cron credentials in Github Pages code or the GitHub repository.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "teko-orders";
const AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 100;
const MAX_BATCHES = 10; // 1000 objects maximum per daily invocation

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function result(payload: Record<string, unknown>, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

Deno.serve(async (request) => {
  const expected = Deno.env.get("TEKO_CRON_SECRET") || "";
  const given = request.headers.get("x-teko-cron-key") || "";
  if (request.method !== "POST" || expected.length < 32 || !safeEqual(expected, given)) {
    return result({ error: "Forbidden" }, 403);
  }

  try {
    // Safe default: manual requests without dryRun:false never delete.
    const params = await request.json().catch(() => ({}));
    const dryRun = params?.dryRun !== false;
    const projectUrl = Deno.env.get("SUPABASE_URL");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const key = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!projectUrl || !key) throw new Error("Supabase Storage admin credentials unavailable");

    const client = createClient(projectUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const cutoff = Date.now() - AGE_MS;
    let deleted = 0, eligible = 0, batches = 0;
    let offset = 0;
    while (batches < MAX_BATCHES) {
      const { data, error } = await client.storage.from(BUCKET).list("orders", {
        limit: LIMIT,
        offset,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (error) throw error;
      const objects = data || [];
      const stale = objects.filter((item) => {
        if (!item.id || !/^[a-f0-9-]{36}\.zip$/.test(item.name)) return false;
        const created = Date.parse(item.created_at || "");
        return Number.isFinite(created) && created < cutoff;
      });
      if (stale.length === 0) break;

      eligible += stale.length;
      if (!dryRun) {
        const paths = stale.map((item) => "orders/" + item.name);
        const { error: removeError } = await client.storage.from(BUCKET).remove(paths);
        if (removeError) throw removeError;
        deleted += paths.length;
        // Re-read offset zero: deleted objects no longer appear on the first page.
      } else {
        offset += LIMIT;
      }
      batches++;
      if (objects.length < LIMIT) break;
    }

    console.log("TEKO cleanup", JSON.stringify({ dryRun, eligible, deleted, batches }));
    return result({ ok: true, dryRun, eligible, deleted, batches, retentionDays: 7 });
  } catch (error) {
    console.error("TEKO cleanup error", error instanceof Error ? error.message : "unknown");
    return result({ ok: false, error: "Storage cleanup failed" }, 500);
  }
});
