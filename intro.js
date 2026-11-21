/* TEKO STORE V40 — cinematic 7-second startup overlay.
   Does not persist session flags or touch order/cart/customer data. */
(()=>{
  "use strict";
  const intro=document.getElementById("tekoIntro");
  if(!intro)return;
  const duration=7000;
  let finished=false;
  const started=performance.now();
  const finish=()=>{
    if(finished)return;
    finished=true;
    intro.hidden=true;
    intro.setAttribute("aria-hidden","true");
    document.body.classList.remove("teko-intro-active");
    // Restore the normal focus order without jumping away from the chosen route.
    intro.inert=true;
  };
  // A setTimeout is a fallback for animationend and a precise seven-second gate.
  const timer=setTimeout(finish,duration);
  intro.addEventListener("animationend",event=>{
    if(event.target===intro&&event.animationName==="teko-intro-curtain"){
      const remaining=duration-(performance.now()-started);
      if(remaining<=0)finish();
      else setTimeout(finish,remaining);
    }
  });
  // Browsers may resume a tab after animation timers were suspended.
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&performance.now()-started>=duration){
      clearTimeout(timer);
      finish();
    }
  });
})();
