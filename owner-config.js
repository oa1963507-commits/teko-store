// Public TEKO STORE owner-console settings.
// Only the public Supabase publishable/anon key belongs here.
// NEVER paste service_role, sb_secret_, Vault or Turnstile secrets.
window.TEKO_OWNER_CONFIG = {
  projectUrl: 'https://kopsyfhpcilafuesgjti.supabase.co',
  publicKey: 'sb_publishable_-Oea1-ooIBXP2pzTiZiXSw_nHjqjNKd', // public Supabase publishable key; no server-side privileges
  functionName: 'teko-admin-orders',
  reportsEnabled: true // V29: owner-only KPI reports and customer insights enabled after Edge Function deployment.
};
