/* TEKO STORE — automatic updates for the site and installed PWA.
   Check the on-site release marker. Refresh only a safe Home screen;
   defer on Studio, Cart, Checkout and unsent forms. Never clear customer data. */
(()=>{
 "use strict";
 const currentRelease=document.querySelector('meta[name="teko-build"]')?.content||"";
 const CHECK_INTERVAL_MS=3*60*1000;
 const CHECK_THROTTLE_MS=10000;
 const RETRY_MS=65000;
 const STORAGE_KEY="teko-last-update-attempt";
 const $=id=>document.getElementById(id);
 let pendingRelease=null;
 let checking=false,started=false,reloading=false,lastChecked=0,autoRetry=null;
 let dismissedRelease=null;

 const isHome=()=>{
   const route=location.hash.replace(/^#/,"").toLowerCase();
   return route===""||route==="home";
 };
 const hasActiveDialog=()=>[
  "reviewModal","installHelp"
 ].some(id=>{const e=$(id);return e&&!e.hidden});
 const homeSafe=()=>isHome()&&!hasActiveDialog()&&
   !document.body.classList.contains("cart-checkout-active");
 const currentFormHasValues=()=>{
   return ["customerName","customerPhone","address","notes"].some(id=>String($(id)?.value||"").trim());
 };

 const banner=document.createElement("section");
 banner.className="teko-update-banner";
 banner.id="tekoUpdateBanner";
 banner.hidden=true;
 banner.setAttribute("role","status");
 banner.setAttribute("aria-live","polite");
 banner.innerHTML='<span class="teko-update-indicator" aria-hidden="true">↻</span>'+
  '<div class="teko-update-copy"><strong>تحديث جديد لـ TEKO STORE</strong><small id="tekoUpdateDescription">هينزل تلقائيًا لما تخرج من صفحة التصميم.</small></div>'+
  '<button type="button" id="tekoUpdateNow" class="teko-update-action">تحديث الآن</button>'+
  '<button type="button" id="tekoUpdateLater" class="teko-update-later" aria-label="إخفاء تنبيه التحديث">×</button>';
 document.body.appendChild(banner);
 const label=$("tekoUpdateDescription");

 function showBanner(){
  if(!pendingRelease||dismissedRelease===pendingRelease||reloading)return;
  if(label){
   label.textContent=homeSafe()?
     "التحديث جاهز. اضغط تحديث الآن لو لم يُحدّث تلقائيًا.":
     "تصميمك وسلتك هيكملوا زي ما هم. التحديث هيتنفذ عند الرجوع للرئيسية.";
  }
  banner.hidden=false;
 }
 function closeBanner(){
  banner.hidden=true;
  dismissedRelease=pendingRelease;
 }
 function lastAttempt(){
  try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||"null")}
  catch{return null}
 }
 function markAttempt(revision){
  try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify({revision,at:Date.now()}))}
  catch{/* Private browsing may block storage; stay functional. */}
 }
 async function reloadForUpdate(manual=false){
  if(reloading||!pendingRelease)return;
  if(!manual&&!homeSafe()){showBanner();return}
  if(document.body.classList.contains("teko-intro-active")){
   if(autoRetry===null)autoRetry=setTimeout(()=>{
    autoRetry=null;
    void reloadForUpdate(manual);
   },7500);
   return;
  }
  const last=lastAttempt();
  if(last?.revision===pendingRelease&&Date.now()-Number(last.at)<RETRY_MS){
   // Avoid an endless reload loop if one CDN deployment reaches clients later.
   showBanner();
   return;
  }
  if(manual&&!homeSafe()&&currentFormHasValues()){
   if(!window.confirm("تحديث TEKO هينعش الصفحة. التصميم المحفوظ والسلة هيفضلوا موجودين، لكن بيانات الطلب المكتوبة ولسه متبعتتش ممكن تتمسح. تكمّل؟"))return;
  }
  try{await window.TEKO_DRAFT?.flush?.()}catch{/* Respect broken storage below. */}
  const draftStatus=$("draftStatus")?.textContent||"";
  if(/تعذر الحفظ|غير متاح/.test(draftStatus)&&!homeSafe()){
   window.alert("تعذر التأكد من حفظ التصميم. احتفظ بنسخة منه قبل التحديث.");
   return;
  }
  reloading=true;
  banner.hidden=true;
  const revision=pendingRelease;
  markAttempt(revision);
  const url=new URL(location.href);
  url.searchParams.set("teko_version",revision.slice(0,12));
  // Preserve the current route. Automatic updates only happen on Home.
  window.location.replace(url.href);
 }

 function handleAvailable(revision){
  if(revision===currentRelease)return;
  pendingRelease=revision;
  if(homeSafe()){
   dismissedRelease=null;
   void reloadForUpdate(false);
  }else{
   showBanner();
  }
 }
 async function checkForUpdate(force=false){
  if(checking||reloading||document.visibilityState==="hidden"||navigator.onLine===false)return;
  if(!force&&Date.now()-lastChecked<CHECK_THROTTLE_MS)return;
  lastChecked=Date.now();
  checking=true;
  try{
   const url=new URL("./version.json",location.href);
   url.searchParams.set("_",String(Date.now()));
   const response=await fetch(url.toString(),{cache:"no-store",credentials:"same-origin"});
   if(!response.ok)return;
   const marker=await response.json();
   const rev=String(marker?.revision||"");
   if(/^[0-9a-f]{40}$/.test(rev)&&currentRelease&&rev!==currentRelease){
    handleAvailable(rev);
   }
  }catch(error){
   // Offline and partial deployments must not interrupt shopping or designing.
  }finally{checking=false}
 }

 $("tekoUpdateNow").addEventListener("click",()=>{
  dismissedRelease=null;
  void reloadForUpdate(true);
 });
 $("tekoUpdateLater").addEventListener("click",closeBanner);
 window.addEventListener("hashchange",()=>{
  if(pendingRelease&&homeSafe()&&!reloading){
   dismissedRelease=null;
   void reloadForUpdate(false);
  }
 });
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")void checkForUpdate(true);
 });
 window.addEventListener("pageshow",()=>void checkForUpdate(true));
 window.addEventListener("focus",()=>void checkForUpdate(false));
 window.addEventListener("online",()=>void checkForUpdate(true));
 setInterval(()=>{if(document.visibilityState==="visible")void checkForUpdate()},CHECK_INTERVAL_MS);

 if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("controllerchange",()=>void checkForUpdate(true));
  window.addEventListener("load",()=>{
   navigator.serviceWorker.ready.then(async registration=>{
    try{
     registration.updateViaCache="none";
     await registration.update();
    }catch{/* Not all browsers permit immediate SW update. */}
   }).catch(()=>{});
  });
  document.addEventListener("visibilitychange",()=>{
   if(document.visibilityState!=="visible")return;
   navigator.serviceWorker.getRegistration("./").then(reg=>{
    reg?.update().catch(()=>{});
   }).catch(()=>{});
  });
 }
 // The release marker is served from the same deployed origin (Pages or GitHub Pages).
 // Do not poll GitHub or external APIs, and never cache photos or order ZIPs.
 void checkForUpdate(true);
})();
