/* TEKO STORE — confidential owner Web Push dispatcher.
 * Invoked by the database cron every minute with a generated server secret.
 * No public access. No owner/customer keys are ever sent to a browser.
 */
import {createClient} from "npm:@supabase/supabase-js@2";

// Self-contained RFC 8291/8292 encrypted Web Push sender, following the
// already-working KOKO push implementation. No external web-push package import.
type DevicePush={endpoint:string;keys:{p256dh:string;auth:string}};
type ServerKeys={publicKey:string;privateKey:string;subject:string};
const te=new TextEncoder();
function joinBytes(...parts:Uint8Array[]):Uint8Array {
 const out=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));
 let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}
 return out;
}
function fromB64(v:string):Uint8Array {
 const clean=v.replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(clean.padEnd(Math.ceil(clean.length/4)*4,"=")),c=>c.charCodeAt(0));
}
function toB64(bytes:Uint8Array):string {
 let s="";for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function hkdf(ikm:Uint8Array,salt:Uint8Array,info:Uint8Array,length:number):Promise<Uint8Array>{
 const key=await crypto.subtle.importKey("raw",ikm,"HKDF",false,["deriveBits"]);
 return new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info},key,length*8));
}
async function sealedPayload(device:DevicePush,data:Record<string,unknown>):Promise<Uint8Array>{
 const receiver=fromB64(device.keys.p256dh),auth=fromB64(device.keys.auth);
 if(receiver.length!==65||auth.length!==16)throw Error("Invalid device push key");
 const receiverKey=await crypto.subtle.importKey("raw",receiver,{name:"ECDH",namedCurve:"P-256"},false,[]);
 const senderPair=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
 const senderPublic=new Uint8Array(await crypto.subtle.exportKey("raw",senderPair.publicKey));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:receiverKey},senderPair.privateKey,256));
 const prk=await hkdf(shared,auth,joinBytes(te.encode("WebPush: info"),new Uint8Array([0]),receiver,senderPublic),32);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await hkdf(prk,salt,te.encode("Content-Encoding: aes128gcm\0"),16);
 const nonce=await hkdf(prk,salt,te.encode("Content-Encoding: nonce\0"),12);
 const cipher=new Uint8Array(await crypto.subtle.encrypt(
  {name:"AES-GCM",iv:nonce},await crypto.subtle.importKey("raw",key,{name:"AES-GCM"},false,["encrypt"]),
  joinBytes(te.encode(JSON.stringify(data)),new Uint8Array([2]))));
 // salt(16), record size(4096), sender key length(65), sender key, ciphertext.
 return joinBytes(salt,new Uint8Array([0,0,16,0,65]),senderPublic,cipher);
}
async function vapidHeader(keys:ServerKeys,url:string):Promise<string>{
 const publicBytes=fromB64(keys.publicKey);
 if(publicBytes.length!==65||publicBytes[0]!==4||fromB64(keys.privateKey).length!==32)
  throw Error("Invalid owner VAPID keys");
 const x=toB64(publicBytes.slice(1,33)),y=toB64(publicBytes.slice(33,65));
 const privateJwk:JsonWebKey={kty:"EC",crv:"P-256",x,y,d:keys.privateKey,ext:true,key_ops:["sign"]};
 const key=await crypto.subtle.importKey("jwk",privateJwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
 const enc=(value:Record<string,unknown>):string=>toB64(te.encode(JSON.stringify(value)));
 const now=Math.floor(Date.now()/1000);
 const token=enc({typ:"JWT",alg:"ES256"})+"."+enc({
  aud:new URL(url).origin,exp:now+3600,sub:keys.subject});
 const signature=new Uint8Array(await crypto.subtle.sign(
  {name:"ECDSA",hash:"SHA-256"},key,te.encode(token)));
 return "vapid t="+token+"."+toB64(signature)+", k="+keys.publicKey;
}
async function sendNativePush(device:DevicePush,payload:Record<string,unknown>,keys:ServerKeys):Promise<boolean>{
 const bytes=await sealedPayload(device,payload);
 const authorization=await vapidHeader(keys,device.endpoint);
 const response=await fetch(device.endpoint,{
  method:"POST",
  headers:{"content-type":"application/octet-stream",
   "content-encoding":"aes128gcm",
   "authorization":authorization,
   "ttl":"86400",
   "urgency":"high"},
  body:bytes
 });
 if(!response.ok){
  const error=new Error("Push service HTTP "+response.status) as Error & {statusCode:number};
  error.statusCode=response.status;throw error;
 }
 return true;
}


const ALLOWED = (endpoint:string):boolean => {
 try {
  const u=new URL(endpoint);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return false;
  return ["fcm.googleapis.com","updates.push.services.mozilla.com",
   "web.push.apple.com","android.googleapis.com"].includes(u.hostname)||
   u.hostname.endsWith(".notify.windows.com")||
   u.hostname.endsWith(".push.windows.com");
 }catch{return false;}
};
const eql=(a:string,b:string):boolean=>{
 if(!a||a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
};
const labels:Record<string,string>={
 new:"جديد",reviewing:"قيد المراجعة",in_production:"قيد التنفيذ",
 ready:"جاهز",delivered:"تم التسليم",cancelled:"ملغي"
};
const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{
 status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
function admin(){
 const url=Deno.env.get("SUPABASE_URL");
 const config=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
 const key=config.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)throw Error("Missing server credentials");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
Deno.serve(async request=>{
 if(request.method!=="POST")return json({error:"POST required"},405);
 if(request.headers.get("Origin"))return json({error:"Disallowed origin"},403);
 try {
  const db=admin();
  const {data:config,error:configErr}=await db.from("teko_owner_push_config")
   .select("vapid_public,vapid_private,dispatch_secret").eq("config_id",1).single();
  if(configErr||!config?.dispatch_secret)
   throw Error("Missing push configuration");
  const token=request.headers.get("x-teko-push-secret")||"";
  if(!eql(token,config.dispatch_secret))return json({error:"Unauthorized"},403);
  if(!config.vapid_public||!config.vapid_private)
   return json({ok:true,ready:false,sent:0});
  const {data:devices,error:deviceErr}=await db.from("teko_owner_push_subscriptions")
   .select("id,endpoint,p256dh,auth,created_at,sound_enabled")
   .order("created_at",{ascending:true}).limit(12);
  if(deviceErr)throw Error("Device lookup failed");
  if(!devices?.length)return json({ok:true,ready:true,sent:0,devices:0});
  const since=new Date(Date.now()-72*60*60*1000).toISOString();
  const {data:recent,error:eventErr}=await db.from("teko_order_notifications")
   .select("id,order_code,event_type,status,created_at")
   .gte("created_at",since).order("id",{ascending:false}).limit(100);
  if(eventErr)throw Error("Notification lookup failed");
  if(!recent?.length)return json({ok:true,ready:true,sent:0,devices:devices.length});
  // One shared owner inbox: this count is the authoritative icon-badge value.
  const {count:unread,error:unreadError}=await db.from("teko_order_notifications")
   .select("id",{head:true,count:"exact"}).is("owner_read_at",null);
  if(unreadError)throw Error("Owner badge count unavailable");
  const badgeCount=Math.max(0,Math.min(999,Number(unread)||0));
  const events=[...recent].reverse();
  const unreadCount=unread;
  const {data:receipts,error:receiptErr}=await db.from("teko_owner_push_deliveries")
   .select("subscription_id,event_id,attempts,delivered_at")
   .in("event_id",events.map(e=>e.id))
   .in("subscription_id",devices.map(d=>d.id));
  if(receiptErr)throw Error("Delivery state lookup failed");
  const byPair=new Map((receipts||[]).map(x=>[
   x.subscription_id+":"+x.event_id,x
  ]));
  let delivered=0,failed=0,attempts=0;
  for(const event of events){
   for(const sub of devices){
    if(attempts>=35)break;
    if(new Date(event.created_at).getTime()<=new Date(sub.created_at).getTime())continue;
    const pair=sub.id+":"+event.id;
    const previous=byPair.get(pair);
    if(previous?.delivered_at||Number(previous?.attempts||0)>=4)continue;
    if(!ALLOWED(sub.endpoint))continue;
    const updatedAttempts=Number(previous?.attempts||0)+1;
    attempts++;
    let good=false;
    try {
     const message=event.event_type==="new"?
      "طلب جديد "+event.order_code:
      "تحديث "+event.order_code+": "+(labels[event.status]||"تم تحديث الطلب");
     const result=await sendNativePush(
      {endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},
      {title:"TEKO OWNER — إشعار جديد",body:message,
       icon:"https://teko-store.pages.dev/icons/icon-192.png",
       badge:"https://teko-store.pages.dev/icons/icon-192.png",
       tag:"teko-owner-"+event.id,
       badgeCount, // Used by the service worker's native app icon badge.
       silent:sub.sound_enabled===false,
       data:{type:"TEKO_OWNER_PUSH",id:event.id,body:message,
        unreadCount:unreadCount||0,url:"/owner.html"}},
      {publicKey:config.vapid_public,privateKey:config.vapid_private,
       subject:"https://teko-store.pages.dev/"}
     );
     if(result===false)throw Error("Push rejected");
     good=true;delivered++;
    }catch(error){
     failed++;
     const status=Number((error as {statusCode?:number})?.statusCode)||0;
     const safeType=error instanceof Error?error.name:"UnknownPushError";
     const safeMessage=(error instanceof Error?error.message:"failed")
      .replace(/https?:\/\/\S+/g,"[push-url]").slice(0,180);
     console.warn("TEKO owner push failed",status,safeType,safeMessage);
     if(status===404||status===410){
      await db.from("teko_owner_push_subscriptions").delete().eq("id",sub.id);
     }
    }
    const {error:stateErr}=await db.from("teko_owner_push_deliveries")
     .upsert({subscription_id:sub.id,event_id:event.id,attempts:updatedAttempts,
      delivered_at:good?new Date().toISOString():null,
      last_attempt_at:new Date().toISOString()},
      {onConflict:"subscription_id,event_id"});
    if(stateErr)console.warn("TEKO push: delivery receipt could not be saved");
   }
   if(attempts>=35)break;
  }
  return json({ok:true,ready:true,sent:delivered,failed,attempted:attempts,devices:devices.length});
 }catch(error){
  console.error("TEKO push dispatch:",error instanceof Error?error.message:"unknown");
  return json({error:"Push dispatch temporarily unavailable"},500);
 }
});
