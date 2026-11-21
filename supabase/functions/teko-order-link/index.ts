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
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(
        path, DOWNLOAD_SECONDS, { download: "TEKO-ORDER.zip" });
      if (error || !data?.signedUrl) throw Error(error?.message || "Signed download failed");
      return json({ downloadUrl: data.signedUrl,
        expiresAt: new Date(Date.now() + DOWNLOAD_SECONDS * 1000).toISOString() },
        200, origin);
    }
    return json({ error: "Unknown action" }, 400, origin);
  } catch (error) {
    console.error("TEKO Storage API", error instanceof Error ? error.message : "unknown");
    return json({ error: "Storage unavailable; retry" }, 500, origin);
  }
});
