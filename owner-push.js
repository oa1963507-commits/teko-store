/* TEKO OWNER V52 — authentic, authenticated Web Push registration.
 * Background notifications use the mobile OS sound. Foreground sound uses
 * the identical user-enabled TEKO chime for every event.
 * Never stores the owner's JWT, the VAPID private key, or customer records.
 */
(()=>{
 "use strict";
 const info=document.getElementById("ownerNotificationMessage");
 let signedIn=false;
 let pushActive=false;
 let busy=false;
 let installedPreference=true;
 const keyBytes=str=>{
  const fixed=str.replace(/-/g,"+").replace(/_/g,"/");
  const decoded=atob(fixed.padEnd(Math.ceil(fixed.length/4)*4,"="));
  return Uint8Array.from(decoded,c=>c.charCodeAt(0));
 };
 const supported=()=>
  window.isSecureContext&&"serviceWorker" in navigator&&
  "PushManager" in window&&"Notification" in window;
 const say=value=>{if(info)info.textContent=value};
 const request=async(action,payload={})=>{
  if(typeof window.TEKO_OWNER_NOTIFICATIONS_API!=="function")
   throw Error("خدمة إشعارات المالك غير جاهزة");
  return window.TEKO_OWNER_NOTIFICATIONS_API(action,payload);
 };
 const soundOn=()=>{
  try{return localStorage.getItem("teko_owner_sound_v1")==="1";}
  catch{return false}
 };
 async function getSubscription(){
  if(!supported())return null;
  // Never wait indefinitely for an unregistered service worker at logout.
  const registration=await navigator.serviceWorker.getRegistration("./");
  return registration?.pushManager?.getSubscription()||null;
 }
 async function updateSubscription(sub){
  const json=sub.toJSON();
  if(!json.endpoint||!json.keys?.auth||!json.keys?.p256dh)
   throw Error("المتصفح لم يرجع بيانات اشتراك Push صالحة");
  return request("ownerPushSubscribe",{
   subscription:json,soundEnabled:soundOn()
  });
 }
 async function enable(){
  if(busy)throw Error("جاري تفعيل الإشعارات بالفعل");
  if(!signedIn)throw Error("سجّل الدخول بحساب المالك أولًا");
  if(!supported())throw Error("المتصفح أو وضع التطبيق الحالي لا يدعم إشعارات الخلفية. على iPhone افتح TEKO OWNER من أيقونته بعد إضافته للشاشة الرئيسية.");
  busy=true;
  try{
   // Permission is requested in direct response to the owner's real click.
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw Error("لازم توافق على إذن الإشعارات من إعدادات المتصفح");
   const response=await request("ownerPushKey");
   const applicationServerKey=keyBytes(response.publicKey);
   if(applicationServerKey.length!==65)throw Error("مفتاح Web Push غير صالح");
   const registration=await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(subscription){
    const previous=subscription.options?.applicationServerKey;
    const old=previous?Array.from(new Uint8Array(previous)):[];
    if(old.length!==applicationServerKey.length||
       old.some((value,i)=>value!==applicationServerKey[i])){
      await subscription.unsubscribe();subscription=null;
    }
   }
   if(!subscription)subscription=await registration.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey
   });
   await updateSubscription(subscription);
   pushActive=true;window.TEKO_OWNER_PUSH_ACTIVE=true;
   installedPreference=true;
   return "تم تفعيل إشعارات TEKO OWNER للجهاز ده، حتى والتطبيق في الخلفية أو مقفول، حسب دعم الموبايل. نفس صوت النظام لكل إشعار.";
  }finally{busy=false;}
 }
 async function disable(){
  pushActive=false;window.TEKO_OWNER_PUSH_ACTIVE=false;
  const subscription=await getSubscription();
  if(!subscription)return;
  const endpoint=subscription.endpoint;
  // Unsubscribe locally on logout so a shared device won't keep receiving
  // private owner order updates after owner access has ended.
  await subscription.unsubscribe().catch(()=>{});
  if(signedIn)await request("ownerPushUnsubscribe",{endpoint}).catch(()=>{});
 }
 window.TEKO_OWNER_PUSH_ENABLE=enable;
 window.TEKO_OWNER_PUSH_DISABLE=disable;
 window.TEKO_OWNER_PUSH_ACTIVE=false;
 window.addEventListener("teko-owner-signin",async()=>{
  signedIn=true;
  try{
   const sub=await getSubscription();
   if(!signedIn||!sub)return;
   await updateSubscription(sub);
   pushActive=true;window.TEKO_OWNER_PUSH_ACTIVE=true;
  }catch{
   // Manual subscription button remains available.
  }
 });
 window.addEventListener("teko-owner-signout",()=>{
  signedIn=false;void disable();
 });
 window.addEventListener("teko-owner-sound-change",async()=>{
  if(!signedIn||!pushActive)return;
  try{
   const sub=await getSubscription();
   if(sub)await updateSubscription(sub);
  }catch{say("تم حفظ تفضيل الصوت على الجهاز؛ تعذر تحديث التفضيل للخادم مؤقتًا.");}
 });
 if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("message",event=>{
   const data=event.data;
   if(data?.type!=="TEKO_OWNER_PUSH"||!signedIn)return;
   window.dispatchEvent(new CustomEvent("teko-owner-push-message",{
    detail:{id:data.id,message:data.body}
   }));
  });
 }
})();
