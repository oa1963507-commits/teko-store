/* TEKO OWNER V51 — independent PWA install flow + owner-only responsive navigation.
   Reuses TEKO's existing network-only SW; never stores owner JWT or order data. */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const body=document.body;
 const install=$("ownerInstallBtn");
 const installLabel=$("ownerInstallLabel");
 const modal=$("ownerInstallHelp");
 const steps=$("ownerInstallSteps");
 const description=$("ownerInstallDescription");
 const dismiss=$("ownerInstallClose");
 const done=$("ownerInstallDone");
 const navIds={
  overview:"ownerNavOverview",
  orders:"ownerNavOrders",
  customers:"ownerNavCustomers",
  storage:"ownerNavStorage",
  alerts:"ownerNavAlerts"
 };
 let installPrompt=null;
 let lastFocus=null;

 const isInstalled=()=>{
  try{return window.matchMedia("(display-mode: standalone)").matches||
   window.matchMedia("(display-mode: fullscreen)").matches||
   window.navigator.standalone===true;}catch{return false;}
 };
 function refreshInstall(){
  if(!install)return;
  const installed=isInstalled();
  install.disabled=installed;
  install.setAttribute("aria-disabled",String(installed));
  if(installLabel)installLabel.textContent=installed?"التطبيق مثبت":"تثبيت لوحة المالك";
 }
 function closeHelp(){
  if(!modal||modal.hidden)return;
  modal.hidden=true;
  document.body.style.overflow="";
  if(lastFocus?.focus)lastFocus.focus();
  lastFocus=null;
 }
 function showHelp(){
  if(!modal||!steps)return;
  const ua=window.navigator.userAgent||"";
  const ios=/iPhone|iPad|iPod/i.test(ua)||
   (window.navigator.platform==="MacIntel"&&window.navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  let instructions;
  if(ios){
   description.textContent="على iPhone ثبّت لوحة TEKO OWNER من Safari، وهتظهر بأيقونتها على الشاشة الرئيسية.";
   instructions=[
    "افتح رابط لوحة المالك من متصفح Safari على الآيفون.",
    "اضغط زر المشاركة (المربع والسهم لأعلى) في شريط المتصفح.",
    "اختار «إضافة إلى الشاشة الرئيسية»، ثم اضغط «إضافة».",
    "افتح TEKO OWNER من الشاشة الرئيسية وسجّل دخولك بحساب المالك."
   ];
  }else if(android){
   description.textContent="ثبت لوحة الإدارة من Chrome على Android، كتطبيق مستقل عن متجر TEKO STORE.";
   instructions=[
    "افتح صفحة TEKO OWNER باستخدام Chrome على الموبايل.",
    "اضغط قائمة النقاط الثلاث ⋮ الخاصة بمتصفح Chrome.",
    "اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
    "افتح TEKO OWNER من أيقونة الهاتف وسجّل دخول المالك."
   ];
  }else{
   description.textContent="تثبيت لوحة TEKO OWNER يعتمد على إمكانيات المتصفح والجهاز.";
   instructions=[
    "افتح صفحة TEKO OWNER من متصفح يدعم تثبيت تطبيقات الويب.",
    "اختار أيقونة تثبيت التطبيق في شريط العنوان، أو من قائمة المتصفح.",
    "أكّد التثبيت، وبعدها افتح TEKO OWNER من قائمة تطبيقات جهازك."
   ];
  }
  steps.replaceChildren();
  for(const line of instructions){
   const li=document.createElement("li");
   li.textContent=line;steps.append(li);
  }
  lastFocus=document.activeElement;
  modal.hidden=false;
  document.body.style.overflow="hidden";
  dismiss?.focus();
 }
 window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  installPrompt=e;
  refreshInstall();
 });
 install?.addEventListener("click",async()=>{
  if(isInstalled()){refreshInstall();return;}
  if(installPrompt&&typeof installPrompt.prompt==="function"){
   const prompt=installPrompt;installPrompt=null;
   try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice?.outcome==="accepted"){refreshInstall();return;}
    if(choice?.outcome==="dismissed")return;
   }catch{}
  }
  showHelp();
 });
 dismiss?.addEventListener("click",closeHelp);
 done?.addEventListener("click",closeHelp);
 modal?.addEventListener("click",e=>{
  if(e.target===modal)closeHelp();
 });
 document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&modal&&!modal.hidden){
   e.preventDefault();closeHelp();
  }
 });
 window.addEventListener("appinstalled",()=>{
  installPrompt=null;closeHelp();refreshInstall();
 });
 refreshInstall();

 // Owner controls remain wired to the original authenticated dashboard,
 // including the original tab handlers and server-only order operations.
 function active(section){
  for(const [key,id] of Object.entries(navIds)){
   const button=$(id);
   if(!button)continue;
   const selected=key===section;
   button.classList.toggle("is-active",selected);
   if(selected)button.setAttribute("aria-current","page");
   else button.removeAttribute("aria-current");
  }
 }
 const click=(id)=>document.getElementById(id)?.click();
 const jump=id=>{
  const panel=$(id);
  if(panel&&!panel.hidden){
   panel.scrollIntoView({behavior:"smooth",block:"start"});
  }
 };
 const actions={
  ownerNavOverview:()=>{
   active("overview");jump("insightsPanel");
  },
  ownerNavOrders:()=>{
   click("tabOrders");active("orders");jump("ordersPanel");
  },
  ownerNavCustomers:()=>{
   click("tabCustomers");active("customers");jump("customersPanel");
  },
  ownerNavStorage:()=>{
   if($("tabStorage")?.hidden)return;
   click("tabStorage");active("storage");jump("storagePanel");
  },
  ownerNavAlerts:()=>{
   click("ownerNotificationToggle");
   active("alerts");
   jump("ownerNotificationPanel");
  }
 };
 for(const [id,fn] of Object.entries(actions)){
  $(id)?.addEventListener("click",fn);
 }
 for(const [tab,section] of [["tabOrders","orders"],["tabCustomers","customers"],["tabStorage","storage"]]){
  $(tab)?.addEventListener("click",()=>active(section));
 }
 $("ownerNotificationToggle")?.addEventListener("click",()=>{
  if(!$("ownerNotificationPanel")?.hidden)active("alerts");
 });
 window.addEventListener("teko-owner-signin",()=>{
  body.classList.add("owner-authenticated");
  // showApp() reveals the storage tab after dispatching sign-in.
  // Defer visibility sync until its original authorization UI has settled.
  window.requestAnimationFrame(()=>{
   if($("ownerNavStorage"))$("ownerNavStorage").hidden=!!$("tabStorage")?.hidden;
  });
  active("overview");
 });
 window.addEventListener("teko-owner-signout",()=>{
  body.classList.remove("owner-authenticated");
  active("overview");
  closeHelp();
 });
 if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
   navigator.serviceWorker.register("./sw.js",{
    scope:"./",updateViaCache:"none"
   }).catch(()=>{
    // Missing worker must never affect login, orders, admin authentication
    // or manual install instructions.
   });
  });
 }
})();
