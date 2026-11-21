/**
 * TEKO STORE / Orders upload Worker (Cloudflare R2).
 *
 * Deploy separately from the GitHub Pages frontend.
 * Required R2 binding: ORDERS_BUCKET
 * Required secrets: TURNSTILE_SECRET, DOWNLOAD_SIGNING_SECRET
 * APP_ORIGIN: https://oa1963507-commits.github.io
 * Optional: LINK_TTL_DAYS (default 30), MAX_UPLOAD_MB (default 20)
 *
 * Never store customer ZIPs in a public GitHub repository.
 */
const MAX_TTL_DAYS = 30;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const textEncoder = new TextEncoder();

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...cors,
    },
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return origin && origin === env.APP_ORIGIN ? origin : null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-TEKO-Turnstile",
    "Access-Control-Max-Age": "300",
    Vary: "Origin",
  };
}

function equalFixedTime(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signature(secret, uuid, expiresAt) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(uuid + ":" + expiresAt),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTurnstile(token, request, secret) {
  if (!token || token.length > 2048 || !secret) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!response.ok) return false;
    const result = await response.json();
    // Bind to the intended site as well as proving the token is valid.
    return result.success === true && result.hostname === new URL(request.headers.get("Origin")).hostname;
  } catch {
    return false;
  }
}

async function handleUpload(request, env, cors) {
  if (!env.ORDERS_BUCKET || !env.DOWNLOAD_SIGNING_SECRET || !env.TURNSTILE_SECRET) {
    return json({ error: "Storage backend not configured" }, 503, cors);
  }
  const sizeLimit = Math.min(
    30,
    Math.max(1, Number(env.MAX_UPLOAD_MB) || 20),
  ) * 1024 * 1024;
  const suppliedLength = Number(request.headers.get("Content-Length"));
  if (suppliedLength > sizeLimit) return json({ error: "ZIP exceeds size limit" }, 413, cors);
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/zip") {
    return json({ error: "Upload must be an application/zip file" }, 415, cors);
  }
  const token = request.headers.get("X-TEKO-Turnstile") || "";
  if (!await verifyTurnstile(token, request, env.TURNSTILE_SECRET)) {
    return json({ error: "Security verification failed; refresh the challenge" }, 403, cors);
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength < 22 || bytes.byteLength > sizeLimit) {
    return json({ error: "ZIP is empty or exceeds size limit" }, 413, cors);
  }
  const hdr = new Uint8Array(bytes, 0, 4);
  if (hdr[0] !== 0x50 || hdr[1] !== 0x4b || hdr[2] !== 0x03 || hdr[3] !== 0x04) {
    return json({ error: "Invalid ZIP signature" }, 400, cors);
  }
  const ttl = Math.min(MAX_TTL_DAYS, Math.max(1, Number(env.LINK_TTL_DAYS) || 30));
  const expiresAt = Date.now() + ttl * 86400000;
  const uuid = crypto.randomUUID();
  const key = "orders/" + uuid + ".zip";
  await env.ORDERS_BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: "application/zip",
      contentDisposition: "attachment; filename=\"TEKO-ORDER.zip\"",
    },
    customMetadata: { expiresAt: String(expiresAt) },
  });
  const signed = await signature(env.DOWNLOAD_SIGNING_SECRET, uuid, expiresAt);
  const url = new URL(request.url);
  url.pathname = "/download/" + uuid;
  url.search = "?e=" + expiresAt + "&s=" + signed;
  return json({ downloadUrl: url.toString(), expiresAt: new Date(expiresAt).toISOString() }, 201, cors);
}

async function handleDownload(request, env, uuid) {
  if (!env.ORDERS_BUCKET || !env.DOWNLOAD_SIGNING_SECRET) {
    return json({ error: "Download backend not configured" }, 503);
  }
  const url = new URL(request.url);
  const expRaw = url.searchParams.get("e") || "";
  const sig = url.searchParams.get("s") || "";
  if (!/^[0-9]{13}$/.test(expRaw) || !/^[a-f0-9]{64}$/.test(sig)) {
    return json({ error: "Invalid download link" }, 403);
  }
  const expiresAt = Number(expRaw);
  if (expiresAt < Date.now() || expiresAt > Date.now() + MAX_TTL_DAYS * 86400000) {
    return json({ error: "Download link expired" }, 410);
  }
  const expected = await signature(env.DOWNLOAD_SIGNING_SECRET, uuid, expRaw);
  if (!equalFixedTime(expected, sig)) return json({ error: "Invalid link signature" }, 403);
  const object = await env.ORDERS_BUCKET.get("orders/" + uuid + ".zip");
  if (!object) return json({ error: "File not found or already deleted" }, 404);
  const storedExpiry = Number(object.customMetadata?.expiresAt || 0);
  if (storedExpiry && storedExpiry < Date.now()) return json({ error: "File expired" }, 410);
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="TEKO-ORDER.zip"',
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: !!env.ORDERS_BUCKET, version: 1 });
      }
      if (url.pathname === "/upload") {
        const origin = allowedOrigin(request, env);
        if (!origin) return json({ error: "Origin not allowed" }, 403);
        const cors = corsHeaders(origin);
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
        if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
        return await handleUpload(request, env, cors);
      }
      const match = /^\/download\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (match) {
        if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
        return handleDownload(request, env, match[1]);
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error("TEKO order upload failure:", error?.message || error);
      return json({ error: "Internal storage error" }, 500,
        url.pathname === "/upload" && allowedOrigin(request, env) ? corsHeaders(env.APP_ORIGIN) : {});
    }
  },
};
