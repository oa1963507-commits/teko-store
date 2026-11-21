/* TEKO STORE V39 - minimal, network-only service worker.
   Provides the navigation fetch handler used by some install-prompt checks.
   Never caches artwork, ZIP files, customer information, cart, or checkout data. */
self.addEventListener("install",()=>{
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch",event=>{
  if(event.request.mode!=="navigate")return;
  // Let the network serve the current site. Keep pages and order details uncached.
  event.respondWith(fetch(event.request));
});
