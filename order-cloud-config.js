// TEKO STORE public client configuration — no secrets here.
// Supabase backend uses TURNSTILE_SECRET and TEKO_HMAC_SECRET on server only.
// Supabase ZIP link upload/download successfully validated by owner on a real WhatsApp order.
window.TEKO_CLOUD = {
  provider: 'supabase',
  enabled: true, // Live private Supabase storage with signed 7-day download URLs.
  databaseOrdersEnabled: true, // Verified: every successful private ZIP upload also registers the order in Supabase.
  databaseOrdersPreview: false, // Disable public staging test route after successful owner-console verification.
  previewEnabled: false, // Hide test-only tools on the public storefront.
  functionUrl: 'https://kopsyfhpcilafuesgjti.supabase.co/functions/v1/teko-order-link',
  supabaseOrigin: 'https://kopsyfhpcilafuesgjti.supabase.co',
  turnstileSiteKey: '0x4AAAAAAGMGhn1Jl1VMH-xq' // Cloudflare Turnstile PUBLIC site key, safe to expose.
};
