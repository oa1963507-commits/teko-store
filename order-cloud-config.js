// Public configuration only. Do not add API keys or secrets here.
// Set these two values after deploying the Cloudflare Worker and adding a Turnstile widget.
window.TEKO_CLOUD = {
  workerUrl: '', // e.g. https://<your-worker>.workers.dev (without trailing slash)
  turnstileSiteKey: '' // Cloudflare Turnstile PUBLIC site key
};
