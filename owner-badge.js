/* TEKO OWNER V55 — app icon unread badge, not an image overlay.
 * Only verified owner notification responses may update this badge.
 * Web app Badging support varies by device/launcher.
 */
(()=>{
 "use strict";
 const originalTitle=document.title.replace(/^\(\d+\)\s*/, "");
 const status=document.getElementById("ownerAppBadgeStatus");
 let authenticated=false,unread=0;
 const supported=()=>typeof navigator.setAppBadge==="function"&&typeof navigator.clearAppBadge==="function";
 function describe(){
  if(!status)return;
  if(supported()){
   status.textContent=unread>0?
    "عداد التطبيق: "+unread+" إشعار غير مقروء. ظهور الرقم على الأيقونة يعتمد على إعدادات الموبايل.":
    "عداد التطبيق متاح: هيظهر على أيقونة التطبيق لما يوصل إشعار غير مقروء.";
  }else{
   status.textContent="الموبايل أو اللانشر ده لا يدعم عرض رقم الإشعارات من تطبيق ويب؛ ممكن تظهر نقطة إشعار بدل الرقم.";
  }
 }
 async function update(value){
  if(!authenticated)return;
  unread=Math.max(0,Math.min(999,Math.trunc(Number(value)||0)));
  document.title=(unread?"("+unread+") ":"")+originalTitle;
  describe();
  try{
   if(unread&&typeof navigator.setAppBadge==="function")
    await navigator.setAppBadge(unread);
   else if(!unread&&typeof navigator.clearAppBadge==="function")
    await navigator.clearAppBadge();
  }catch{
   if(status)status.textContent="تعذر ضبط شارة الأيقونة؛ راجع إذن إشعارات TEKO OWNER وإعدادات شارات التطبيقات.";
  }
 }
 async function clear(){
  unread=0;document.title=originalTitle;describe();
  try{await navigator.clearAppBadge?.();}catch{}
  try{
   const registration=await navigator.serviceWorker?.getRegistration("./");
   registration?.active?.postMessage({type:"TEKO_OWNER_CLEAR_BADGE"});
  }catch{}
 }
 window.TEKO_OWNER_APP_BADGE={update,clear,supported};
 window.addEventListener("teko-owner-signin",()=>{authenticated=true;describe();});
 window.addEventListener("teko-owner-signout",()=>{authenticated=false;void clear();});
 describe();
})();