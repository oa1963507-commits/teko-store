/* TEKO STORE auto-update service worker (network-first, no customer data cached).
   TEKO_BUILD_REV: 9b9b2c5b7ca0426a8820ada17a50246a8db2c845
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


/* V52 — Web Push for owner devices.
   A closed/background app receives the system notification sound.
   When the authenticated owner window is focused, signal its own single
   chime rather than creating a second OS notification.
   No customer documents, JWTs or messages are stored in CacheStorage.
 */
self.addEventListener("push",event=>{
 event.waitUntil((async()=>{
  let p;
  try{p=event.data?.json()}catch{return}
  if(!p||p.data?.type!=="TEKO_OWNER_PUSH")return;
  const id=Number(p.data.id)||0;
  const body=String(p.body||"وصل إشعار جديد للمتجر").slice(0,150);
  const pages=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const focused=pages.filter(page=>{
   try{
    const url=new URL(page.url);
    return url.origin===self.location.origin &&
     url.pathname.endsWith("/owner.html") &&
     page.visibilityState==="visible" && page.focused;
   }catch{return false}
  });
  if(focused.length){
   for(const page of focused)
    page.postMessage({type:"TEKO_OWNER_PUSH",id,body});
   return;
  }
  await self.registration.showNotification("TEKO OWNER — إشعار جديد",{
   body,tag:"teko-owner-"+id,
   icon:"./icons/icon-192.png",
   badge:"./icons/icon-192.png",
   data:{type:"TEKO_OWNER_PUSH",id,url:"./owner.html"},
   silent:p.silent===true,
   renotify:p.silent!==true
  });
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const pages=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const owner=pages.find(page=>{
   try{return new URL(page.url).pathname.endsWith("/owner.html")}catch{return false}
  });
  if(owner){await owner.focus();return}
  await self.clients.openWindow(new URL("./owner.html",self.registration.scope).href);
 })());
});
