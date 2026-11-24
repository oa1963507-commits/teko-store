/* TEKO OWNER V53 — persistent, rotating Supabase Auth session.
 * Access JWTs still expire normally; a one-use refresh token renews them.
 * The browser stores only the owner's own session after server-side owner
 * authorization. No service-role credentials or password are persisted.
 */
(()=>{
 "use strict";
 const KEY="teko_owner_authenticated_session_v1";
 const config=window.TEKO_OWNER_CONFIG||{};
 const project=String(config.projectUrl||"").replace(/\/+$/,"");
 const apikey=String(config.publicKey||"");
 const validConfig=project.startsWith("https://")&&!!apikey;
 let session=null,approved=false,refreshing=null,renewalTimer=null;
 let restoring=false;
 const emit=type=>window.dispatchEvent(new Event(type));
 function valid(s){
  return s&&s.version===1&&typeof s.accessToken==="string"&&
   s.accessToken.length>100&&s.accessToken.length<6500&&
   typeof s.refreshToken==="string"&&s.refreshToken.length>15&&s.refreshToken.length<7000&&
   Number.isFinite(s.expiresAt)&&s.expiresAt>1e12;
 }
 function saved(){
  try{const s=JSON.parse(localStorage.getItem(KEY)||"null");return valid(s)?s:null;}
  catch{return null;}
 }
 function persist(){
  if(!approved||!session)return;
  try{localStorage.setItem(KEY,JSON.stringify(session));}
  catch{throw Error("المتصفح منع حفظ جلسة المالك. فعّل التخزين لهذا الموقع علشان الدخول يفضل مستمر.");}
 }
 function schedule(){
  if(renewalTimer!==null)clearTimeout(renewalTimer);
  renewalTimer=null;
  if(!approved||!session)return;
  const delay=Math.min(2147483000,Math.max(5000,session.expiresAt-Date.now()-120000));
  renewalTimer=setTimeout(()=>{
   void refresh(false).catch(()=>{
    if(approved&&session){renewalTimer=setTimeout(()=>{
     if(approved)void refresh(false).catch(()=>{});
    },30000);}
   });
  },delay);
 }
 function parse(value){
  if(!value?.access_token||!value?.refresh_token)
   throw Error("خدمة تسجيل الدخول لم تُرسل بيانات جلسة صالحة.");
  const s={
   version:1,accessToken:String(value.access_token),
   refreshToken:String(value.refresh_token),
   expiresAt:Date.now()+Math.max(60,Number(value.expires_in)||3600)*1000
  };
  if(!valid(s))throw Error("جلسة غير صالحة.");
  return s;
 }
 async function exchange(grant,body,token){
  if(!validConfig)throw Error("إعدادات تسجيل دخول المالك ناقصة.");
  let response;
  try{
   response=await fetch(project+"/auth/v1/token?grant_type="+grant,{
    method:"POST",headers:{"Content-Type":"application/json","apikey":apikey},
    body:JSON.stringify(body),cache:"no-store"
   });
  }catch{throw Error("تعذر الاتصال بخدمة تسجيل الدخول؛ هتفضل الجلسة محفوظة لإعادة المحاولة.");}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   const error=new Error(
    response.status===400||response.status===401||response.status===403?
     "انتهت صلاحية اعتماد الجلسة من الخادم؛ يلزم تسجيل الدخول من جديد.":
     "خدمة تسجيل الدخول غير متاحة مؤقتًا. الجلسة محفوظة؛ حاول مجددًا.");
   error.invalidCredentials=[400,401,403].includes(response.status);
   throw error;
  }
  return parse(data);
 }
 async function refresh(force=false){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   if(!session)session=saved();
   if(!session)throw Error("سجّل دخولك بحساب المالك أولًا.");
   const attempt=async()=>{
    // Synchronize tokens rotated in another tab before making one-time refresh request.
    const disk=saved();
    if(approved&&disk&&disk.refreshToken!==session.refreshToken){
     session=disk;schedule();
     if(session.expiresAt>Date.now()+90000)return session.accessToken;
    }
    if(!force&&session.expiresAt>Date.now()+90000)return session.accessToken;
    try{
     const fresh=await exchange("refresh_token",{refresh_token:session.refreshToken});
     session=fresh;
     if(approved)persist();
     schedule();
     return session.accessToken;
    }catch(err){
     const newest=saved();
     if(approved&&newest&&newest.refreshToken!==session?.refreshToken){
      session=newest;schedule();
      return session.accessToken;
     }
     if(err.invalidCredentials){forget();emit("teko-owner-auth-revoked");}
     throw err;
    }
   };
   // navigator.locks avoids refresh-token reuse across multiple open owner tabs.
   if(typeof navigator!=="undefined"&&navigator.locks?.request)
    return navigator.locks.request("teko-owner-session-refresh",{mode:"exclusive"},attempt);
   return attempt();
  })();
  try{return await refreshing;}
  finally{refreshing=null;}
 }
 async function getToken(){
  if(!session)session=approved?saved():null;
  if(!session)throw Error("سجّل دخولك بحساب المالك أولًا.");
  if(session.expiresAt>Date.now()+90000)return session.accessToken;
  return refresh(false);
 }
 async function signIn(email,password){
  const result=await exchange("password",{email,password});
  if(renewalTimer!==null)clearTimeout(renewalTimer);
  session=result;approved=false;
  return result.accessToken;
 }
 function confirmOwner(){
  if(!session)throw Error("تعذر اعتماد الجلسة.");
  approved=true;persist();schedule();
 }
 async function restore(){
  if(restoring)return false;
  restoring=true;
  try{
   const data=saved();
   if(!data)return false;
   session=data;approved=true;
   await getToken();
   schedule();
   return true;
  }finally{restoring=false;}
 }
 function forget(){
  approved=false;session=null;
  if(renewalTimer!==null)clearTimeout(renewalTimer);
  renewalTimer=null;
  try{localStorage.removeItem(KEY);}catch{}
 }
 async function signOut(){
  const token=await getToken().catch(()=>session?.accessToken);
  try{
   if(token&&validConfig){
    await fetch(project+"/auth/v1/logout?scope=local",{
     method:"POST",headers:{"apikey":apikey,"Authorization":"Bearer "+token},
     cache:"no-store",signal:AbortSignal.timeout(3500)
    });
   }
  }catch{
   // User-requested local logout still completes while offline.
  }finally{forget();}
 }
 // In tabs on the same origin, a logout invalidates the local admin UI.
 window.addEventListener("storage",event=>{
  if(event.key!==KEY)return;
  if(!event.newValue&&approved){
   forget();emit("teko-owner-auth-remote-logout");
  }else if(event.newValue&&approved){
   const latest=saved();
   if(latest&&latest.refreshToken!==session?.refreshToken){session=latest;schedule();}
  }
 });
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&approved)
   void getToken().catch(()=>{});
 });
 window.TEKO_OWNER_AUTH={signIn,confirmOwner,restore,getToken,refresh,forget,signOut,
  hasSavedSession:()=>!!saved()};
})();
