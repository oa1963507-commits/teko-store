/**
 * TEKO STORE — protected owner + capability-based customer order notifications.
 * Runs with verify_jwt=false because it validates the owner JWT itself and
 * validates customer calls using a 256-bit, unguessable tracking secret.
 * Never send the owner's service-role key or owner UID to the browser.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://teko-store.pages.dev",
  "https://oa1963507-commits.github.io"
]);
const enc = new TextEncoder();
const ORDER_PATH = /^orders\/[a-f0-9-]{36}\.zip$/;
const HASH = /^[a-f0-9]{64}$/;
const CODE = /^TK-[0-9]{5,20}$/;

function cors(origin: string | null): Record<string,string> {
  if (!origin || !ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "1800",
    "Vary": "Origin"
  };
}
function reply(origin:string|null, data:Record<string,unknown>, status=200) {
  return Response.json(data, {status, headers:{
    ...cors(origin), "Cache-Control":"no-store, private",
    "X-Content-Type-Options":"nosniff"
  }});
}
function client() {
  const url=Deno.env.get("SUPABASE_URL");
  const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  const key=secrets.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)throw Error("Supabase service key unavailable");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function hexSha(value:string){
  const hash=await crypto.subtle.digest("SHA-256",enc.encode(value));
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("");
}
async function hmac(value:string){
  const secret=Deno.env.get("TEKO_HMAC_SECRET");
  if(!secret||secret.length<32)throw Error("Missing order-proof secret");
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=await crypto.subtle.sign("HMAC",key,enc.encode(value));
  return Array.from(new Uint8Array(signed),n=>n.toString(16).padStart(2,"0")).join("");
}
function safeEqual(a:string,b:string) {
  if(a.length!==b.length)return false;
  let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);
  return n===0;
}
async function authorizedOwner(req:Request,db:ReturnType<typeof client>) {
  const owner=Deno.env.get("TEKO_OWNER_UID")||"";
  const bearer=req.headers.get("authorization")||"";
  const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
  if(!/^[a-f0-9-]{36}$/i.test(owner)||!token||token.length>6000)return false;
  const {data,error}=await db.auth.getUser(token);
  return !error&&data?.user?.id?.toLowerCase()===owner.toLowerCase();
}


const b64url=(bytes:Uint8Array):string=>
 btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const validB64=(value:unknown,min:number,max:number):value is string=>
 typeof value==="string"&&value.length>=min&&value.length<=max&&/^[a-zA-Z0-9_-]+$/.test(value);
function validEndpoint(endpoint:unknown):endpoint is string {
 if(typeof endpoint!=="string"||endpoint.length<40||endpoint.length>2048)return false;
 try{
  const u=new URL(endpoint);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return false;
  return u.hostname==="fcm.googleapis.com"||
   u.hostname==="updates.push.services.mozilla.com"||
   u.hostname==="web.push.apple.com"||
   u.hostname==="android.googleapis.com"||
   u.hostname.endsWith(".notify.windows.com")||
   u.hostname.endsWith(".push.windows.com");
 }catch{return false;}
}
async function ownerVapidKey(db:ReturnType<typeof client>) {
 let {data:config,error}=await db.from("teko_owner_push_config")
  .select("vapid_public,vapid_private").eq("config_id",1).single();
 if(error||!config)throw Error("Push backend not initialized");
 if(!config.vapid_public||!config.vapid_private){
  // Generated only server-side: the private key is never sent to the browser.
  const pair=await crypto.subtle.generateKey(
   {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const raw=new Uint8Array(await crypto.subtle.exportKey("raw",pair.publicKey));
  const jwk=await crypto.subtle.exportKey("jwk",pair.privateKey);
  if(!jwk.d)throw Error("VAPID export unavailable");
  const {error:saveError}=await db.from("teko_owner_push_config")
   .update({vapid_public:b64url(raw),vapid_private:jwk.d})
   .eq("config_id",1).is("vapid_public",null);
  if(saveError)throw Error("Push activation failed");
  const state=await db.from("teko_owner_push_config")
   .select("vapid_public,vapid_private").eq("config_id",1).single();
  config=state.data;
  if(state.error||!config?.vapid_public||!config?.vapid_private)
   throw Error("Push activation unavailable");
 }
 return config.vapid_public as string;
}

Deno.serve(async req=>{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS"&&origin&&ORIGINS.has(origin))
    return new Response(null,{status:204,headers:cors(origin)});
  if(!origin||!ORIGINS.has(origin))return reply(origin,{error:"Forbidden origin"},403);
  if(req.method!=="POST")return reply(origin,{error:"POST required"},405);
  if(!req.headers.get("content-type")?.includes("application/json"))
    return reply(origin,{error:"JSON required"},415);
  if(Number(req.headers.get("content-length")||0)>6000)
    return reply(origin,{error:"Request too large"},413);
  try{
    const raw=await req.text();
    if(raw.length>6000)return reply(origin,{error:"Request too large"},413);
    const data=JSON.parse(raw);
    if(!data||typeof data!=="object"||Array.isArray(data))
      return reply(origin,{error:"Bad request"},400);
    const action=String(data.action||"");
    const db=client();

    if(action==="bind"){
      const path=String(data.path||"");
      const size=Number(data.size),expires=Number(data.expires);
      const proof=String(data.proof||"");
      const code=String(data.code||"");
      const secret=String(data.trackingToken||"");
      if(!ORDER_PATH.test(path)||!CODE.test(code)||!HASH.test(proof)||
         !HASH.test(secret)||!Number.isSafeInteger(size)||size<22||size>40*1024*1024||
         !Number.isSafeInteger(expires)||expires<Date.now()||expires>Date.now()+16*60000)
        return reply(origin,{error:"Invalid/expired order proof"},403);
      const expected=await hmac([path,size,expires].join("|"));
      if(!safeEqual(expected,proof))return reply(origin,{error:"Invalid order proof"},403);
      const {data:order,error:orderError}=await db.from("teko_orders")
        .select("id,order_code").eq("storage_path",path).eq("order_code",code).maybeSingle();
      if(orderError||!order)return reply(origin,{error:"Order not registered"},404);
      const tokenHash=await hexSha(secret);
      const {error:insertError}=await db.from("teko_order_tracking")
        .insert({order_id:order.id,token_hash:tokenHash});
      if(insertError){
        if(insertError.code!=="23505")throw Error("Customer tracking save failed");
        const {data:existing,error:existingError}=await db.from("teko_order_tracking")
          .select("token_hash").eq("order_id",order.id).maybeSingle();
        if(existingError||!existing||!safeEqual(existing.token_hash,tokenHash))
          return reply(origin,{error:"Tracking already activated"},409);
      }
      return reply(origin,{tracking:true,code:order.order_code});
    }

    if(action==="customerFeed"){
      const secret=String(data.trackingToken||"");
      if(!HASH.test(secret))return reply(origin,{error:"Tracking not found"},404);
      const tokenHash=await hexSha(secret);
      const {data:tracking,error:trackingError}=await db.from("teko_order_tracking")
        .select("order_id").eq("token_hash",tokenHash).maybeSingle();
      if(trackingError||!tracking)return reply(origin,{error:"Tracking not found"},404);
      const {data:order,error:orderError}=await db.from("teko_orders")
        .select("order_code,status,created_at,updated_at").eq("id",tracking.order_id).maybeSingle();
      if(orderError||!order)return reply(origin,{error:"Tracking not found"},404);
      const {data:events,error:eventsError}=await db.from("teko_order_notifications")
        .select("id,event_type,status,created_at")
        .eq("order_id",tracking.order_id).order("id",{ascending:false}).limit(30);
      if(eventsError)throw Error("Customer timeline unavailable");
      return reply(origin,{order,events:events||[]});
    }


    if(action==="ownerPushKey"||action==="ownerPushSubscribe"||action==="ownerPushUnsubscribe"){
      if(!await authorizedOwner(req,db))
        return reply(origin,{error:"Owner authentication required"},403);
      const publicKey=await ownerVapidKey(db);
      if(action==="ownerPushKey")return reply(origin,{publicKey});
      const subscription=data.subscription;
      const endpoint=action==="ownerPushUnsubscribe"?
        String(data.endpoint||""):String(subscription?.endpoint||"");
      if(!validEndpoint(endpoint))return reply(origin,{error:"Unsupported push service"},400);
      if(action==="ownerPushUnsubscribe"){
        const {error}=await db.from("teko_owner_push_subscriptions")
          .delete().eq("endpoint",endpoint);
        if(error)throw Error("Push unsubscribe failed");
        return reply(origin,{ok:true});
      }
      const keys=subscription?.keys;
      if(!validB64(keys?.p256dh,80,140)||!validB64(keys?.auth,16,64))
        return reply(origin,{error:"Invalid push subscription keys"},400);
      const {count,error:countErr}=await db.from("teko_owner_push_subscriptions")
        .select("id",{head:true,count:"exact"});
      if(countErr)throw Error("Push device list unavailable");
      const exists=await db.from("teko_owner_push_subscriptions")
       .select("id").eq("endpoint",endpoint).maybeSingle();
      if(exists.error)throw Error("Push device lookup failed");
      if(!exists.data&&Number(count)>=12)
        return reply(origin,{error:"Maximum 12 owner devices"},409);
      const {error:saveError}=await db.from("teko_owner_push_subscriptions")
       .upsert({endpoint,p256dh:keys.p256dh,auth:keys.auth,
         updated_at:new Date().toISOString()},{onConflict:"endpoint"});
      if(saveError)throw Error("Push device save failed");
      return reply(origin,{ok:true,subscribed:true,publicKey});
    }

    if(action==="ownerFeed"||action==="ownerRead"){
      if(!await authorizedOwner(req,db))
        return reply(origin,{error:"Owner authentication required"},403);
      if(action==="ownerRead"){
        const ids=data.ids;
        if(!Array.isArray(ids)||ids.length===0||ids.length>50||
          !ids.every(x=>Number.isSafeInteger(x)&&x>0))
          return reply(origin,{error:"Invalid notification ids"},400);
        const {error}=await db.from("teko_order_notifications")
          .update({owner_read_at:new Date().toISOString()})
          .in("id",ids).is("owner_read_at",null);
        if(error)throw Error("Notification read failed");
        return reply(origin,{ok:true});
      }
      const {data:events,error:listError}=await db.from("teko_order_notifications")
        .select("id,order_id,order_code,event_type,status,created_at,owner_read_at")
        .order("id",{ascending:false}).limit(60);
      if(listError)throw Error("Owner notifications unavailable");
      const {count,error:countError}=await db.from("teko_order_notifications")
        .select("id",{head:true,count:"exact"}).is("owner_read_at",null);
      if(countError)throw Error("Unread notification count unavailable");
      return reply(origin,{events:events||[],unread:count||0});
    }

    return reply(origin,{error:"Unknown action"},400);
  }catch(e){
    console.error("TEKO notifications",(e instanceof Error?e.message:"unknown"));
    return reply(origin,{error:"Notification service temporarily unavailable"},500);
  }
});
