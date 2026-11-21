/* TEKO STORE V41 — reliable 7-second intro for browser and installed PWA.
   Installed apps can resume an existing page without a fresh document load.
   Replay only on standalone app foregrounding from a real background period,
   and never interrupt the editor, cart or checkout. No persistent customer data. */
(()=>{
 "use strict";
 const intro=document.getElementById("tekoIntro");
 if(!intro)return;
 const DURATION_MS=7000;
 const BACKGROUND_REPLAY_MS=2500;
 const nonHomeRoutes=new Set(["studio","editor","checkout","designs","studio-designs","cart"]);
 let generation=0;
 let timer=null;
 let playing=false;
 let backgroundAt=null;

 function isInstalledApp(){
  return window.matchMedia("(display-mode: standalone)").matches||
   window.matchMedia("(display-mode: fullscreen)").matches||
   navigator.standalone===true;
 }
 function onHome(){
  return !nonHomeRoutes.has(window.location.hash.replace(/^#/,""));
 }
 function finish(run){
  if(run!==generation||!playing)return;
  playing=false;
  if(timer!==null){clearTimeout(timer);timer=null;}
  intro.hidden=true;
  intro.inert=true;
  intro.setAttribute("aria-hidden","true");
  document.body.classList.remove("teko-intro-active");
 }
 function start(replay=false){
  generation+=1;
  const run=generation;
  if(timer!==null){clearTimeout(timer);timer=null;}
  if(replay){
   // Hidden display:none resets the intro and child CSS animations.
   intro.hidden=true;
   void intro.offsetWidth;
   intro.hidden=false;
  }else{
   intro.hidden=false;
  }
  intro.inert=false;
  intro.removeAttribute("aria-hidden");
  document.body.classList.add("teko-intro-active");
  playing=true;
  timer=setTimeout(()=>finish(run),DURATION_MS);
 }
 function maybeReplay(){
  if(backgroundAt===null||document.visibilityState==="hidden")return;
  const elapsed=Date.now()-backgroundAt;
  backgroundAt=null;
  if(!isInstalledApp()||!onHome()||elapsed<BACKGROUND_REPLAY_MS)return;
  start(true);
 }
 function background(){
  if(backgroundAt===null)backgroundAt=Date.now();
 }

 // A full load always starts the exact approved cinematic intro.
 // If launched while hidden, begin upon the first foreground instead.
 if(document.visibilityState==="hidden"){
  intro.hidden=true;
  intro.inert=true;
  document.body.classList.remove("teko-intro-active");
  background();
 }else{
  start();
 }

 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden"){
   background();
  }else if(backgroundAt!==null){
   if(generation===0){
    backgroundAt=null;
    start();
   }else{
    maybeReplay();
   }
  }
 });
 window.addEventListener("pagehide",background);
 window.addEventListener("pageshow",event=>{
  if(event.persisted)maybeReplay();
 });
 window.addEventListener("focus",()=>{
  // Fallback for installed browsers that do not dispatch visibilitychange.
  maybeReplay();
 });

 intro.addEventListener("animationend",event=>{
  if(event.target===intro&&event.animationName==="teko-intro-curtain"&&playing){
   // The timeout is authoritative: animationend may precede the full 7 seconds.
   // Leave the active run in place until its timer completes.
  }
 });
})();
