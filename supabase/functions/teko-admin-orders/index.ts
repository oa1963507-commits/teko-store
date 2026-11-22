/**
 * TEKO STORE — private owner order API (STAGED, not deployed).
 * POST from GitHub Pages, JWT authenticated with Supabase Auth.getUser(jwt).
 * The allowed owner UUID is stored server-side in TEKO_OWNER_UID.
 * Deploy with Verify JWT OFF; this function manually verifies every JWT.
 * Never put service role or TEKO_OWNER_UID in public frontend code.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

// Restrict owner API CORS to the exact TEKO store origins.
const ALLOWED_ORIGINS = new Set([
  "https://oa1963507-commits.github.io",
  "https://teko-store.pages.dev",
]);
function allowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}
const BUCKET = "teko-orders";
const PAGE_SIZE = 25;
const STATUS = ["new","reviewing","in_production","ready","delivered","cancelled"] as const;

function cors(origin: string | null): Record<string,string> {
  return allowedOrigin(origin) ? {
    "Access-Control-Allow-Origin": origin!,
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

// V28 owner reporting: scan at most 5,000 recent records in bounded pages.
// If a store exceeds this size the API explicitly reports partial=true.
// No PII is accessible without the existing Supabase Auth + owner UID guard.
const REPORT_LIMIT = 5000;
const REPORT_BATCH = 500;
type ReportingRow = {
  created_at: string; customer_name: string; customer_phone: string;
  hoodie_color: string; quantity: number; total_quote_egp: string | number;
  status: string;
};
async function readReportingRows(admin: ReturnType<typeof adminClient>, days: number) {
  const cutoff = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null;
  const rows: ReportingRow[] = [];
  let total = 0;
  for (let offset = 0; offset < REPORT_LIMIT; offset += REPORT_BATCH) {
    let query = admin.from("teko_orders")
      .select("created_at,customer_name,customer_phone,hoodie_color,quantity,total_quote_egp,status",
        {count: offset===0?"exact":undefined})
      .order("created_at",{ascending:false})
      .range(offset,offset+REPORT_BATCH-1);
    if (cutoff) query = query.gte("created_at",cutoff);
    const {data,error,count} = await query;
    if (error) throw Error("Reporting query failed");
    if (offset===0) total=count||0;
    rows.push(...((data||[]) as ReportingRow[]));
    if ((data||[]).length<REPORT_BATCH) break;
  }
  return {rows,total,partial:total>rows.length};
}
function quote(row: ReportingRow) {
  const value=Number(row.total_quote_egp||0);
  return Number.isFinite(value)&&value>0?value:0;
}
function customerGroup(rows: ReportingRow[]) {
  const grouped=new Map<string,{
    phone:string;name:string;orders:number;activeOrders:number;
    quoteEGP:number;latestOrderAt:string;
  }>();
  for(const order of rows){
    const phone=order.customer_phone;
    if(!phone)continue;
    let item=grouped.get(phone);
    if(!item){
      item={phone,name:order.customer_name||"بدون اسم",orders:0,
        activeOrders:0,quoteEGP:0,latestOrderAt:order.created_at};
      grouped.set(phone,item);
    }
    item.orders++;
    if(order.status!=="cancelled")item.quoteEGP+=quote(order);
    if(["new","reviewing","in_production","ready"].includes(order.status))item.activeOrders++;
  }
  return [...grouped.values()].sort((a,b)=>b.latestOrderAt.localeCompare(a.latestOrderAt));
}
function summary(rows: ReportingRow[],total: number,partial: boolean,days: number) {
  const counts: Record<string,number>=Object.fromEntries(STATUS.map(s=>[s,0]));
  let quoteEGP=0,deliveredQuoteEGP=0,qty=0,nonCancelled=0;
  const daily=new Map<string,number>(),colorCounts=new Map<string,number>();
  const today=new Date();
  for(let d=6;d>=0;d--){
    const date=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()-d));
    daily.set(date.toISOString().slice(0,10),0);
  }
  for(const row of rows){
    if(counts[row.status]!==undefined)counts[row.status]++;
    if(row.status!=="cancelled"){
      nonCancelled++;
      quoteEGP+=quote(row);
      qty+=Math.max(0,Number(row.quantity)||0);
      if(row.status==="delivered")deliveredQuoteEGP+=quote(row);
      const color=String(row.hoodie_color||"غير محدد").slice(0,50);
      colorCounts.set(color,(colorCounts.get(color)||0)+1);
    }
    const date=String(row.created_at).slice(0,10);
    if(daily.has(date))daily.set(date,(daily.get(date)||0)+1);
  }
  const round=(n: number)=>Math.round(n*100)/100;
  return {
    periodDays:days,totalOrders:total,coveredOrders:rows.length,partial,
    statusCounts:counts,uniqueCustomers:new Set(rows.map(r=>r.customer_phone).filter(Boolean)).size,
    quotedTotalEGP:round(quoteEGP),
    deliveredQuotedEGP:round(deliveredQuoteEGP),
    averageQuoteEGP:nonCancelled?round(quoteEGP/nonCancelled):0,
    totalPieces:qty,
    dailyOrders:[...daily].map(([date,count])=>({date,count})),
    popularColors:[...colorCounts].sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([color,count])=>({color,count})),
  };
}

// V30 private storage monitor. Bucket-level file bytes are NOT the same as
// Supabase's project-wide averaged GB-hours billing/usage.
const STORAGE_FREE_QUOTA_BYTES = 1000000000; // Free plan 1 GB; configurable guidance, not billing API
const STORAGE_BATCH = 250;
const STORAGE_SCAN_LIMIT = 5000;
const STORAGE_PAGE_SIZE = 25;
const STORAGE_BULK_DELETE_LIMIT = 500;
const ZIP_NAME = /^[a-f0-9-]{36}\.zip$/;
const ZIP_PATH = /^orders\/[a-f0-9-]{36}\.zip$/;
type StorageZip = {path:string;name:string;sizeBytes:number|null;createdAt:string;ageDays:number|null};
function zipName(value: unknown): value is string {
  return typeof value==="string"&&ZIP_NAME.test(value);
}
async function storageInventory(admin: ReturnType<typeof adminClient>) {
  const files:StorageZip[]=[];
  let scanComplete=false,examined=0,unknownSizeCount=0;
  for(let offset=0;offset<STORAGE_SCAN_LIMIT;offset+=STORAGE_BATCH){
    const {data,error}=await admin.storage.from(BUCKET).list("orders",{
      limit:STORAGE_BATCH,offset,sortBy:{column:"created_at",order:"asc"},
    });
    if(error)throw Error("Cannot inspect private storage");
    const objects=data||[];
    examined+=objects.length;
    for(const item of objects){
      if(!item.id||!zipName(item.name))continue;
      const rawSize=item.metadata?.size ?? (item as {size?:unknown}).size;
      const sizeRaw=rawSize==null||rawSize===""?NaN:Number(rawSize);
      const sizeBytes=Number.isFinite(sizeRaw)&&sizeRaw>=0?sizeRaw:null;
      if(sizeBytes===null)unknownSizeCount++;
      const createdAt=String(item.created_at||"");
      const time=Date.parse(createdAt);
      files.push({
        path:"orders/"+item.name,name:item.name,sizeBytes,createdAt,
        ageDays:Number.isFinite(time)?Math.max(0,Math.floor((Date.now()-time)/86400000)):null,
      });
    }
    if(objects.length<STORAGE_BATCH){scanComplete=true;break;}
  }
  return {files,scanComplete,examined,unknownSizeCount};
}
function storageStats(inventory: Awaited<ReturnType<typeof storageInventory>>,page:number){
  const bytes=inventory.files.reduce((n,f)=>n+(f.sizeBytes||0),0);
  const count=inventory.files.length;
  const partial=!inventory.scanComplete||inventory.unknownSizeCount>0;
  return {
    bucket:BUCKET,usedBytes:bytes,quotaBytes:STORAGE_FREE_QUOTA_BYTES,
    freeEstimateBytes:partial?null:Math.max(0,STORAGE_FREE_QUOTA_BYTES-bytes),
    percentEstimate:partial?null:Math.round(bytes/STORAGE_FREE_QUOTA_BYTES*10000)/100,
    countedFiles:count,unknownSizeCount:inventory.unknownSizeCount,
    partial,limitNote:"This is the TEKO ZIP bucket only, not a Supabase billing or whole-project figure.",
    page,pageSize:STORAGE_PAGE_SIZE,
    files:inventory.files.slice(page*STORAGE_PAGE_SIZE,(page+1)*STORAGE_PAGE_SIZE),
  };
}
async function deletePrivateZips(admin: ReturnType<typeof adminClient>,input:Record<string,unknown>){
  if(input.acknowledgeLinksBreak!==true)throw Error("Explicit deletion acknowledgment missing");
  const mode=String(input.mode||"");
  if(mode==="selected"){
    if(input.confirmation!=="DELETE_SELECTED_ZIPS"||!Array.isArray(input.paths)||
       input.paths.length<1||input.paths.length>50)throw Error("Invalid selected deletion request");
    const paths=[...new Set(input.paths)];
    if(paths.length!==input.paths.length||paths.some(p=>typeof p!=="string"||!ZIP_PATH.test(p)))
      throw Error("Only files under orders/*.zip can be removed");
    const {error,data}=await admin.storage.from(BUCKET).remove(paths as string[]);
    if(error)throw Error("Could not delete selected files");
    const deleted=Array.isArray(data)?data.length:paths.length;
    console.log("TEKO storage manual deletion",JSON.stringify({mode:"selected",requested:paths.length,deleted}));
    return {mode,requested:paths.length,deleted,possiblyMore:false};
  }
  if(mode==="all"){
    if(input.confirmation!=="DELETE_ALL_ZIPS")throw Error("Invalid bulk deletion confirmation");
    let deleted=0,batches=0;
    // Bounded execution avoids Edge Function timeouts. Repeat if more files remain.
    while(deleted<STORAGE_BULK_DELETE_LIMIT&&batches<5){
      const {data,error}=await admin.storage.from(BUCKET).list("orders",{
        limit:100,offset:0,sortBy:{column:"created_at",order:"asc"},
      });
      if(error)throw Error("Cannot list storage for deletion");
      const files=(data||[]).filter(file=>file.id&&zipName(file.name));
      if(!files.length)break;
      const paths=files.map(file=>"orders/"+file.name);
      const {error:deleteError}=await admin.storage.from(BUCKET).remove(paths);
      if(deleteError)throw Error("Could not delete ZIP files");
      deleted+=paths.length;batches++;
      if((data||[]).length<100)break;
    }
    const possiblyMore=deleted>=STORAGE_BULK_DELETE_LIMIT;
    console.log("TEKO storage manual deletion",JSON.stringify({mode:"all",deleted,batches,possiblyMore}));
    return {mode,deleted,possiblyMore};
  }
  throw Error("Unsupported deletion mode");
}

Deno.serve(async req=>{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS"&&allowedOrigin(origin))return new Response(null,{status:204,headers:cors(origin)});
  if(!allowedOrigin(origin))return reply(origin,{error:"Forbidden origin"},403);
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
    if(action==="dashboard"){
      const days=Number(input.days);
      if(![7,30,90,0].includes(days))return reply(origin,{error:"Invalid reporting period"},400);
      const data=await readReportingRows(admin,days);
      return reply(origin,{dashboard:summary(data.rows,data.total,data.partial,days)});
    }
    if(action==="customers"){
      const page=Number(input.page)||0;
      if(!Number.isSafeInteger(page)||page<0||page>1000)
        return reply(origin,{error:"Invalid customer page"},400);
      const text=String(input.search||"").normalize("NFKC").trim().slice(0,60).toLowerCase();
      const data=await readReportingRows(admin,0);
      const all=customerGroup(data.rows);
      const matched=text?all.filter(customer=>
        customer.name.toLowerCase().includes(text)||customer.phone.includes(text)
      ):all;
      const start=page*PAGE_SIZE;
      return reply(origin,{
        customers:matched.slice(start,start+PAGE_SIZE),
        total:matched.length,page,pageSize:PAGE_SIZE,
        coveredOrders:data.rows.length,partial:data.partial
      });
    }
    if(action==="storage"){
      const page=Number(input.page ?? 0);
      if(!Number.isSafeInteger(page)||page<0||page>200)
        return reply(origin,{error:"Invalid storage page"},400);
      const inventory=await storageInventory(admin);
      return reply(origin,{storage:storageStats(inventory,page)});
    }
    if(action==="storageDelete"){
      try{
        const deletion=await deletePrivateZips(admin,input as Record<string,unknown>);
        return reply(origin,{ok:true,deletion});
      }catch(error){
        if(error instanceof Error&&/Invalid|Only files|Unsupported|acknowledgment/.test(error.message))
          return reply(origin,{error:"Invalid or unconfirmed deletion request"},400);
        throw error;
      }
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
        error:"ZIP unavailable; the file may have been deleted manually or after the retention period"
      },404);
      return reply(origin,{downloadUrl:data.signedUrl,expiresInSeconds:900});
    }
    return reply(origin,{error:"Unknown action"},400);
  }catch(error){
    console.error("TEKO owner orders",error instanceof Error?error.message:"unknown");
    return reply(origin,{error:"Service unavailable; check configuration"},500);
  }
});
