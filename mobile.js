/* TEKO STORE V39 — mobile navigation and user-triggered PWA installation. */
(()=>{
  "use strict";
  const header=document.querySelector(".site-header");
  const toggle=document.getElementById("mobileMenuToggle");
  const nav=document.getElementById("siteNav");
  const installButton=document.getElementById("installAppBtn");
  const installLabel=document.getElementById("installActionLabel");
  const installHint=document.getElementById("installActionHint");
  const overlay=document.getElementById("installHelp");
  const closeHelpButton=document.getElementById("installHelpClose");
  const doneButton=document.getElementById("installHelpDone");
  const stepsList=document.getElementById("installHelpSteps");
  const helpText=document.getElementById("installHelpText");
  if(!header||!toggle||!nav)return;

  let deferredPrompt=null;
  let previousFocus=null;

  const closeMenu=()=>{
    header.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded","false");
    toggle.setAttribute("aria-label","فتح القائمة");
  };

  toggle.addEventListener("click",()=>{
    const next=toggle.getAttribute("aria-expanded")!=="true";
    header.classList.toggle("menu-open",next);
    toggle.setAttribute("aria-expanded",String(next));
    toggle.setAttribute("aria-label",next?"إغلاق القائمة":"فتح القائمة");
  });

  nav.addEventListener("click",event=>{
    if(event.target.closest("a"))closeMenu();
  });
  document.addEventListener("click",event=>{
    if(!header.contains(event.target))closeMenu();
  });
  window.addEventListener("hashchange",closeMenu);
  const desktopQuery=window.matchMedia("(min-width: 851px)");
  if(typeof desktopQuery.addEventListener==="function"){
    desktopQuery.addEventListener("change",closeMenu);
  }else if(typeof desktopQuery.addListener==="function"){
    desktopQuery.addListener(closeMenu);
  }

  const installed=()=>window.matchMedia("(display-mode: standalone)").matches||
    window.matchMedia("(display-mode: fullscreen)").matches||
    window.navigator.standalone===true;

  const refreshInstallButton=()=>{
    if(!installButton)return;
    const done=installed();
    installButton.disabled=done;
    installButton.setAttribute("aria-disabled",String(done));
    if(installLabel)installLabel.textContent=done?"TEKO مثبت بالفعل":"تثبيت TEKO كتطبيق";
    if(installHint)installHint.textContent=done?
      "بتستخدم نسخة التطبيق دلوقتي":"على شاشة موبايلك بأيقونة TEKO";
  };

  const closeHelp=()=>{
    if(!overlay||overlay.hidden)return;
    overlay.hidden=true;
    if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus();
    previousFocus=null;
  };

  const showHelp=()=>{
    if(!overlay||!stepsList)return;
    const ua=navigator.userAgent||"";
    const isIOS=/iPhone|iPad|iPod/i.test(ua)||
      (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    const isAndroid=/Android/i.test(ua);
    let steps;
    if(isIOS){
      helpText.textContent="على الآيفون تقدر تضيف TEKO للشاشة الرئيسية بأيقونته الرسمية من قائمة المشاركة.";
      steps=[
        "افتح موقع TEKO STORE من Safari على الآيفون.",
        "اضغط زر المشاركة (مربع وفيه سهم لفوق).",
        "اختار «إضافة إلى الشاشة الرئيسية»، وبعدها اضغط «إضافة»."
      ];
    }else if(isAndroid){
      helpText.textContent="لو زر التثبيت المباشر مش متاح، تقدر تضيف TEKO من قائمة المتصفح.";
      steps=[
        "افتح موقع TEKO STORE من Chrome على الموبايل.",
        "اضغط الثلاث نقاط ⋮ الخاصة بمتصفح Chrome.",
        "اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، ثم أكّد."
      ];
    }else{
      helpText.textContent="يمكنك تثبيت الموقع أو إضافته للشاشة الرئيسية حسب إمكانيات المتصفح.";
      steps=[
        "افتح موقع TEKO STORE في متصفح يدعم تثبيت المواقع.",
        "افتح قائمة المتصفح أو اضغط أيقونة تثبيت التطبيق في شريط العنوان إن ظهرت.",
        "اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."
      ];
    }
    stepsList.replaceChildren();
    for(const step of steps){
      const item=document.createElement("li");
      item.textContent=step;
      stepsList.appendChild(item);
    }
    previousFocus=document.activeElement;
    overlay.hidden=false;
    closeHelpButton?.focus();
  };

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPrompt=event;
    refreshInstallButton();
  });

  installButton?.addEventListener("click",async()=>{
    closeMenu();
    if(installed()){refreshInstallButton();return}
    if(deferredPrompt&&typeof deferredPrompt.prompt==="function"){
      const promptEvent=deferredPrompt;
      deferredPrompt=null;
      try{
        await promptEvent.prompt();
        const response=await promptEvent.userChoice;
        if(response?.outcome==="accepted")refreshInstallButton();
      }catch(error){
        // The native prompt may be unavailable or dismissed by the browser.
        showHelp();
      }
    }else{
      showHelp();
    }
  });

  closeHelpButton?.addEventListener("click",closeHelp);
  doneButton?.addEventListener("click",closeHelp);
  overlay?.addEventListener("click",event=>{
    if(event.target===overlay)closeHelp();
  });
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    if(overlay&&!overlay.hidden){
      event.preventDefault();
      closeHelp();
    }else if(header.classList.contains("menu-open")){
      closeMenu();
      toggle.focus();
    }
  });
  window.addEventListener("appinstalled",()=>{
    deferredPrompt=null;
    closeHelp();
    refreshInstallButton();
  });
  refreshInstallButton();

  // Service worker is network-only: never cache customer artwork, cart or checkout data.
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"}).catch(()=>{
        // Failure does not block design tools, checkout or manual home-screen addition.
      });
    });
  }
})();
