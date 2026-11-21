/**
 * TEKO STORE — Supabase Edge Function. Stage-only until deployed and configured.
 * Anonymous browsers obtain signed upload URLs after Cloudflare Turnstile verification.
 * Large ZIP bodies upload directly to Storage, not through Edge Function memory.
 * Required custom secrets: TURNSTILE_SECRET and TEKO_HMAC_SECRET (32+ chars).
 * Auto-injected: SUPABASE_URL, SUPABASE_SECRET_KEYS.
 * For anonymous access: Verify JWT OFF; NEVER expose secret keys to frontend.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://oa1963507-commits.github.io";
const BUCKET = "teko-orders";
const MAX_BYTES = 40 * 1024 * 1024;
const DOWNLOAD_SECONDS = 7 * 86400;
const PROOF_TTL_MS = 15 * 60000;
const encoder = new TextEncoder();

function headers(origin: string | null) {
  return origin === ORIGIN ? {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  } : {};
}
function json(data: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", ...headers(origin),
  } });
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw Error("Supabase backend configuration missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function hmac(message: string) {
  const secret = Deno.env.get("TEKO_HMAC_SECRET");
  if (!secret || secret.length < 32) throw Error("TEKO_HMAC_SECRET is not configured");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signed), n => n.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function checkTurnstile(token: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret || !token || token.length > 2048) return false;
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body });
  if (!check.ok) return false;
  const result = await check.json();
  return result.success === true && result.hostname === "oa1963507-commits.github.io";
}

// Staged V24: validated order details, stored only after ZIP upload completes.
// Financial numbers are customer-facing quotes, not trusted prices for payment.
function parseOrder(payload: unknown, storagePath: string): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("Invalid order details");
  const d = payload as Record<string, unknown>;
  if (JSON.stringify(d).length > 16000) throw Error("Order details too large");
  const customer = d.customer as Record<string, unknown> | undefined;
  const item = d.item as Record<string, unknown> | undefined;
  if (!customer || !item || typeof customer !== "object" || typeof item !== "object") throw Error("Incomplete order");
  const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  const name = clean(customer.name, 120);
  const phone = clean(customer.phone, 20);
  const code = clean(d.code, 40);
  const qty = Number(item.quantity);
  const unit = Number(item.unitPrice);
  const total = Number(item.totalBeforeShipping);
  const designs = d.designs;
  if (!name || !/^01[0-9]{9}$/.test(phone) || !/^TK-[0-9]{5,20}$/.test(code) ||
      !Number.isSafeInteger(qty) || qty < 1 || qty > 100 ||
      !Number.isFinite(unit) || unit < 0 || unit > 100000 ||
      !Number.isFinite(total) || total < 0 || total > 10000000 ||
      !Array.isArray(designs) || designs.length > 32) throw Error("Invalid order data");
  return {
    order_code: code,
    storage_path: storagePath,
    customer_name: name,
    customer_phone: phone,
    customer_address: clean(customer.address, 450),
    customer_notes: clean(customer.notes, 750),
    hoodie_color: clean(item.color, 50),
    hoodie_size: clean(item.size, 15),
    quantity: qty,
    unit_quote_egp: unit,
    total_quote_egp: total,
    order_payload: d,
    status: "new",
  };
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS" && origin === ORIGIN)
    return new Response(null, { status: 204, headers: headers(origin) });
  if (origin !== ORIGIN) return json({ error: "Origin not permitted" }, 403, origin);
  if (request.method !== "POST") return json({ error: "Method not permitted" }, 405, origin);
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    return json({ error: "Expected JSON" }, 415, origin);

  try {
    const p = await request.json();
    if (p.action === "init") {
      const size = Number(p.size);
      if (!Number.isSafeInteger(size) || size < 22 || size > MAX_BYTES)
        return json({ error: "ZIP must be at most 40 MB" }, 413, origin);
      if (!await checkTurnstile(String(p.turnstileToken || "")))
        return json({ error: "Security verification failed" }, 403, origin);
      const path = "orders/" + crypto.randomUUID() + ".zip";
      const { data, error } = await adminClient().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data?.signedUrl) throw Error(error?.message || "Signed upload failed");
      const expires = Date.now() + PROOF_TTL_MS;
      const proof = await hmac([path, size, expires].join("|"));
      const uploadUrl = new URL(data.signedUrl);
      if (uploadUrl.origin !== new URL(Deno.env.get("SUPABASE_URL")!).origin)
        throw Error("Unexpected signed upload origin");
      return json({ uploadUrl: uploadUrl.toString(), path, size, expires, proof }, 200, origin);
    }
    if (p.action === "finish") {
      const path = String(p.path || "");
      const size = Number(p.size);
      const expires = Number(p.expires);
      const proof = String(p.proof || "");
      if (!/^orders\/[a-f0-9-]{36}\.zip$/.test(path) ||
          !Number.isSafeInteger(size) || size < 22 || size > MAX_BYTES ||
          !Number.isSafeInteger(expires) || expires < Date.now() ||
          expires > Date.now() + PROOF_TTL_MS + 10000 ||
          !/^[a-f0-9]{64}$/.test(proof))
        return json({ error: "Invalid/expired upload proof" }, 403, origin);
      const expected = await hmac([path, size, expires].join("|"));
      if (!safeEqual(expected, proof)) return json({ error: "Invalid proof" }, 403, origin);
      const client = adminClient();
      const { data: info, error: infoError } = await client.storage.from(BUCKET).info(path);
      if (infoError || !info || Number(info.size) !== size)
        return json({ error: "ZIP upload missing or incomplete" }, 409, origin);
      let recorded = false;
      if (p.order !== undefined) {
        let row: Record<string, unknown>;
        try { row = parseOrder(p.order, path); }
        catch { return json({ error: "Invalid order details" }, 400, origin); }
        const { error: insertError } = await client.from("teko_orders").insert(row);
        if (insertError) {
          // A repeated finish for an already registered ZIP is idempotent.
          if (insertError.code === "23505") {
            const { data: found, error: findError } = await client.from("teko_orders")
              .select("id").eq("storage_path", path).maybeSingle();
            if (findError || !found) throw Error("Unable to verify existing order");
          } else throw Error("Database order registration failed");
        }
        recorded = true;
      }
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(
        path, DOWNLOAD_SECONDS, { download: "TEKO-ORDER.zip" });
      if (error || !data?.signedUrl) throw Error(error?.message || "Signed download failed");
      return json({ downloadUrl: data.signedUrl, registered: recorded,
        expiresAt: new Date(Date.now() + DOWNLOAD_SECONDS * 1000).toISOString() },
        200, origin);
    }
    return json({ error: "Unknown action" }, 400, origin);
  } catch (error) {
    console.error("TEKO Storage API", error instanceof Error ? error.message : "unknown");
    return json({ error: "Storage unavailable; retry" }, 500, origin);
  }
});
