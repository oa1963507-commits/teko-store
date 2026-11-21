// Public TEKO STORE owner-console settings.
// Only the public Supabase publishable/anon key belongs here.
// NEVER paste service_role, sb_secret_, Vault or Turnstile secrets.
window.TEKO_OWNER_CONFIG = {
  projectUrl: 'https://kopsyfhpcilafuesgjti.supabase.co',
  publicKey: '', // fill with sb_publishable_* (or legacy anon PUBLIC key) after setup
  functionName: 'teko-admin-orders'
};
