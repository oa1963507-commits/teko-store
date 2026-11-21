/**
 * TEKO STORE — private owner order API (STAGED, not deployed).
 * POST from GitHub Pages, JWT authenticated with Supabase Auth.getUser(jwt).
 * The allowed owner UUID is stored server-side in TEKO_OWNER_UID.
 * Deploy with Verify JWT OFF; this function manually verifies every JWT.
 * Never put service role or TEKO_OWNER_UID in public frontend code.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://oa1963507-commits.github.io";
const BUCKET = "teko-orders";
const PAGE_SIZE = 25;
const STATUS = ["new","reviewing","in_production","ready","delivered","cancelled"] as const;

function cors(origin: string | null): Record<string,string> {
  return origin === ORIGIN ? {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
  } : {};
}
function reply(origin: string | null, body: Record<string, unknown>, status = 200) {
  return Response.json(body,{status,headers:{
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    ...cors(origin)
  }});
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw Error("Admin credentials missing");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function uuid(value: unknown): string | null {
  const s=String(value||"");
  return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s)?s:null;
}

Deno.serve(async req=>{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS"&&origin===ORIGIN)return new Response(null,{status:204,headers:cors(origin)});
  if(origin!==ORIGIN)return reply(origin,{error:"Forbidden origin"},403);
  if(req.method!=="POST")return reply(origin,{error:"Method not allowed"},405);
  if(!req.headers.get("content-type")?.includes("application/json"))return reply(origin,{error:"Expected JSON"},415);
  try{
    const expectedOwner=uuid(Deno.env.get("TEKO_OWNER_UID"));
    if(!expectedOwner)throw Error("Owner access not configured");
    const bearer=req.headers.get("authorization")||"";
    const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
    if(!token||token.length>6000)return reply(origin,{error:"Sign in required"},401);
    const admin=adminClient();
    // Always validate caller JWT against Auth service; never trust client-provided ids.
    const {data:identity,error:authError}=await admin.auth.getUser(token);
    if(authError||!identity?.user)return reply(origin,{error:"Session expired"},401);
    if(identity.user.id.toLowerCase()!==expectedOwner.toLowerCase())
      return reply(origin,{error:"Owner access only"},403);

    const input=await req.json();
    if(!input||typeof input!=="object")return reply(origin,{error:"Bad request"},400);
    const action=String(input.action||"");
    if(action==="list"){
      const page=Math.max(0,Math.min(1000,Math.floor(Number(input.page)||0)));
      const requestedStatus=String(input.status||"all");
      if(requestedStatus!=="all"&&!STATUS.includes(requestedStatus as typeof STATUS[number]))
        return reply(origin,{error:"Invalid status"},400);
      // Allowed search chars cannot escape PostgREST filters.
      const query=String(input.search||"").normalize("NFKC").replace(/[^\p{L}\p{N} _-]/gu,"").trim().slice(0,60);
      let queryBuilder=admin.from("teko_orders")
        .select("id,order_code,customer_name,customer_phone,hoodie_color,hoodie_size,quantity,total_quote_egp,status,created_at",
          {count:"exact"})
        .order("created_at",{ascending:false})
        .range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
      if(requestedStatus!=="all")queryBuilder=queryBuilder.eq("status",requestedStatus);
      if(query)queryBuilder=queryBuilder.or(
        "order_code.ilike.%"+query+"%,customer_name.ilike.%"+query+"%,customer_phone.ilike.%"+query+"%"
      );
      const {data,error,count}=await queryBuilder;
      if(error)throw Error("Orders query failed");
      return reply(origin,{orders:data||[],total:count||0,page,pageSize:PAGE_SIZE});
    }
    if(action==="detail"){
      const id=uuid(input.id);
      if(!id)return reply(origin,{error:"Invalid order ID"},400);
      const {data,error}=await admin.from("teko_orders").select("*").eq("id",id).maybeSingle();
      if(error)throw Error("Order detail failed");
      if(!data)return reply(origin,{error:"Order not found"},404);
      return reply(origin,{order:data});
    }
    if(action==="status"){
      const id=uuid(input.id),status=String(input.status||"");
      if(!id||!STATUS.includes(status as typeof STATUS[number]))
        return reply(origin,{error:"Invalid status update"},400);
      const {data,error}=await admin.from("teko_orders")
        .update({status}).eq("id",id).select("id,status,updated_at").maybeSingle();
      if(error)throw Error("Status update failed");
      if(!data)return reply(origin,{error:"Order not found"},404);
      return reply(origin,{order:data});
    }
    if(action==="download"){
      const id=uuid(input.id);
      if(!id)return reply(origin,{error:"Invalid order ID"},400);
      const {data:order,error}=await admin.from("teko_orders")
        .select("storage_path").eq("id",id).maybeSingle();
      if(error||!order)return reply(origin,{error:"Order not found"},404);
      const {data,error:downloadError}=await admin.storage.from(BUCKET)
        .createSignedUrl(order.storage_path,15*60,{download:"TEKO-ORDER.zip"});
      if(downloadError||!data?.signedUrl)return reply(origin,{
        error:"ZIP unavailable; it may have been removed after 7 days"
      },404);
      return reply(origin,{downloadUrl:data.signedUrl,expiresInSeconds:900});
    }
    return reply(origin,{error:"Unknown action"},400);
  }catch(error){
    console.error("TEKO owner orders",error instanceof Error?error.message:"unknown");
    return reply(origin,{error:"Service unavailable; check configuration"},500);
  }
});
