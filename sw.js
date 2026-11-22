/* TEKO STORE auto-update service worker (network-first, no customer data cached).
   TEKO_BUILD_REV: 126d195489bd9560e433e607e4071283ad32c82f
   This build marker is updated by the release workflow after every source push. */
self.addEventListener("install",()=>{
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const target=new URL(request.url);
  if(target.origin!==self.location.origin)return;

  // Always request the latest same-origin pages, scripts, CSS, and mockup files.
  // HTTP revalidation is allowed, but no offline CacheStorage is used.
  // Requests to external Supabase and Cloudflare Turnstile are not intercepted.
  event.respondWith(fetch(request,{cache:request.mode==="navigate"?"no-store":"no-cache"}));
});
