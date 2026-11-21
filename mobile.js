/* TEKO STORE V36 — accessible compact mobile navigation. */
(()=>{
  "use strict";
  const header=document.querySelector(".site-header");
  const toggle=document.getElementById("mobileMenuToggle");
  const nav=document.getElementById("siteNav");
  if(!header||!toggle||!nav)return;
  const close=()=>{
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
  nav.addEventListener("click",event=>{if(event.target.closest("a"))close()});
  document.addEventListener("click",event=>{if(!header.contains(event.target))close()});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&header.classList.contains("menu-open")){close();toggle.focus()}
  });
  window.addEventListener("hashchange",close);
  window.matchMedia("(min-width: 851px)").addEventListener("change",close);
})();
