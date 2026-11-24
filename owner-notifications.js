/* TEKO STORE V50 — owner inbox for verified new orders and status changes.
 * Browser permission only shows alerts while this owner panel remains open.
 * Authentication is handled by owner.js, which never exposes the JWT.
 */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 if(!$("ownerNotificationToggle"))return;
 const labels={new:"جديد",reviewing:"قيد المراجعة",in_production:"قيد التنفيذ",ready:"جاهز",delivered:"تم التسليم",cancelled:"ملغي"};
 let authorized=false,inFlight=false,timer=null,lastMax=0,nativeEnabled=false,opened=false;
 const bell=$("ownerNotificationToggle"),badge=$("ownerNotificationBadge"),panel=$("ownerNotificationPanel");
 const list=$("ownerNotificationList"),message=$("ownerNotificationMessage"),permission=$("ownerNotificationPermission");
 const formatDate=value=>{
  try{return new Intl.DateTimeFormat("ar-EG",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));}
  catch{return "—";}
 };
 const text=(tag,value,className)=>{
  const el=document.createElement(tag);el.textContent=String(value);
  if(className)el.className=className;return el;
 };
 function describe(e){
  return e.event_type==="new"?
   "طلب جديد "+e.order_code:"تحديث "+e.order_code+": "+(labels[e.status]||e.status);
 }
 function nativeAlert(e){
  // A single shared chime is triggered for every type of owner notification.
  window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{
   detail:{id:e.id,message:describe(e)}
  }));
  // Background Web Push owns system notifications when a device is subscribed.
  if(window.TEKO_OWNER_PUSH_ACTIVE)return;
  if(!nativeEnabled||!("Notification" in window)||Notification.permission!=="granted")return;
  try{new Notification("TEKO STORE — تنبيه أوردر",{body:describe(e),tag:"teko-owner-order-"+e.id});}
  catch{}
 }
 function render(events,unread){
  badge.textContent=unread>99?"99+":String(unread);
  badge.hidden=unread===0;
  if(!events.length){list.replaceChildren(text("p","لا توجد إشعارات بعد.","owner-notification-empty"));return;}
  const fragment=document.createDocumentFragment();
  for(const e of events){
   const row=text("article","", "owner-notification-item"+(!e.owner_read_at?" unread":""));
   row.dataset.id=String(e.id);
   const title=text("strong",describe(e));
   const time=text("small",formatDate(e.created_at));
   const jump=text("button","عرض الأوردر","owner-notification-order");
   jump.type="button";jump.addEventListener("click",()=>{
    $("tabOrders")?.click();
    const search=$("searchOrders");if(search)search.value=e.order_code;
    $("filterStatus").value="all";
    $("filterForm")?.requestSubmit();
    panel.hidden=true;opened=false;bell.setAttribute("aria-expanded","false");
   });
   row.append(title,time,jump);fragment.append(row);
  }
  list.replaceChildren(fragment);
 }
 async function poll(){
  if(!authorized||inFlight)return;
  inFlight=true;
  try{
   const result=await window.TEKO_OWNER_NOTIFICATIONS_API("ownerFeed");
   const events=Array.isArray(result.events)?result.events:[];
   const max=events.reduce((v,e)=>Math.max(v,Number(e.id)||0),0);
   if(lastMax>0&&max>lastMax){
    const newest=events.filter(e=>Number(e.id)>lastMax);
    for(const e of newest.slice().reverse())nativeAlert(e);
    message.textContent="وصل "+newest.length+" تحديث جديد.";
   }else if(!lastMax)message.textContent="الإشعارات مرتبطة بقاعدة الطلبات الحقيقية.";
   lastMax=Math.max(lastMax,max);
   render(events,Number(result.unread)||0);
  }catch{
   message.textContent="تعذر تحديث الإشعارات؛ سيتم إعادة المحاولة تلقائيًا.";
  }finally{inFlight=false;}
 }
 function start(){
  authorized=true;lastMax=0;
  if(timer)clearInterval(timer);
  void poll();
  timer=setInterval(()=>void poll(),20000);
 }
 function stop(){
  authorized=false;lastMax=0;
  if(timer)clearInterval(timer);timer=null;
  badge.hidden=true;list.replaceChildren();
  panel.hidden=true;opened=false;bell.setAttribute("aria-expanded","false");
 }
 bell.addEventListener("click",()=>{
  if(!authorized)return;
  opened=!opened;panel.hidden=!opened;
  bell.setAttribute("aria-expanded",String(opened));
  if(opened)void poll();
 });
 $("ownerNotificationClose").addEventListener("click",()=>{
  panel.hidden=true;opened=false;bell.setAttribute("aria-expanded","false");
 });
 $("ownerNotificationRefresh").addEventListener("click",()=>void poll());
 $("ownerNotificationReadAll").addEventListener("click",async()=>{
  const ids=Array.from(list.querySelectorAll(".owner-notification-item.unread"))
   .map(x=>Number(x.dataset.id)).filter(Number.isSafeInteger);
  // IDs are added below when each rendered event is created.
  if(!ids.length){
   message.textContent="كل الإشعارات الظاهرة مقروءة.";return;
  }
  try{await window.TEKO_OWNER_NOTIFICATIONS_API("ownerRead",{ids:ids.slice(0,50)});await poll();}
  catch{message.textContent="تعذر تعليم الإشعارات كمقروءة؛ جرّب مجددًا.";}
 });
 permission.addEventListener("click",async()=>{
  if(typeof window.TEKO_OWNER_PUSH_ENABLE==="function"){
   try{
    const info=await window.TEKO_OWNER_PUSH_ENABLE();
    nativeEnabled=("Notification" in window)&&Notification.permission==="granted";
    message.textContent=info;
   }catch(e){message.textContent="تعذر تفعيل تنبيهات الخلفية: "+(e?.message||"حاول مرة أخرى");}
   return;
  }
  if(!window.isSecureContext||!("Notification" in window)){
   message.textContent="المتصفح ده لا يدعم إشعارات الشاشة؛ الجرس شغال داخل لوحة المالك.";return;
  }
  try{
   nativeEnabled=(await Notification.requestPermission())==="granted";
   message.textContent=nativeEnabled?
    "تم تفعيل تنبيهات المتصفح أثناء فتح لوحة المالك.":
    "التنبيهات الخارجية غير مفعلة؛ هتظهر الإشعارات داخل اللوحة.";
   if(nativeEnabled)try{sessionStorage.setItem("teko-owner-native-alerts","1");}catch{}
  }catch{message.textContent="تعذر طلب إذن التنبيهات من المتصفح.";}
 });
 try{nativeEnabled=sessionStorage.getItem("teko-owner-native-alerts")==="1";}catch{}
 window.addEventListener("teko-owner-push-message",event=>{
   if(!authorized)return;
   const messageData=event.detail||{};
   window.dispatchEvent(new CustomEvent("teko-owner-alert-event",{
     detail:{id:messageData.id,message:messageData.message||"وصل إشعار للمتجر"}
   }));
   void poll();
 });
 window.addEventListener("teko-owner-signin",start);
 window.addEventListener("teko-owner-signout",stop);
 document.addEventListener("visibilitychange",()=>{if(authorized&&document.visibilityState==="visible")void poll();});
})();
