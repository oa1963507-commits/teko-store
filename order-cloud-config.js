// TEKO STORE public client configuration — no secrets here.
// Supabase backend uses TURNSTILE_SECRET and TEKO_HMAC_SECRET on server only.
// Safe staging: until the public Turnstile Site Key is set, orders use local ZIP fallback.
window.TEKO_CLOUD = {
  provider: 'supabase',
  functionUrl: 'https://kopsyfhpcilafuesgjti.supabase.co/functions/v1/teko-order-link',
  supabaseOrigin: 'https://kopsyfhpcilafuesgjti.supabase.co',
  turnstileSiteKey: '' // Paste the Cloudflare Turnstile PUBLIC site key after the backend is ready.
};
