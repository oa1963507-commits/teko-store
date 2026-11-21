// TEKO STORE public client configuration — no secrets here.
// Supabase backend uses TURNSTILE_SECRET and TEKO_HMAC_SECRET on server only.
// Safe staging: keep cloud checkout disabled until a verified Supabase upload and download test succeeds.
window.TEKO_CLOUD = {
  provider: 'supabase',
  enabled: false, // Production stays on the existing ZIP + WhatsApp flow.
  previewEnabled: true, // A temporary URL parameter enables supervised end-to-end cloud testing.
  functionUrl: 'https://kopsyfhpcilafuesgjti.supabase.co/functions/v1/teko-order-link',
  supabaseOrigin: 'https://kopsyfhpcilafuesgjti.supabase.co',
  turnstileSiteKey: '0x4AAAAAAGMGhn1Jl1VMH-xq' // Cloudflare Turnstile PUBLIC site key, safe to expose.
};
