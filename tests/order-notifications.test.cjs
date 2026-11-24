/* TEKO V50: native JS + security regression tests for order notifications. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const api=read("supabase/functions/teko-order-notifications/index.ts");
const customer=read("customer-notifications.js");
const owner=read("owner-notifications.js");
const dashboard=read("owner.js");
const order=read("app.js");
const index=read("index.html");
const customerHtml=read("tracking.html");
const ownerHtml=read("owner.html");

test("Both customer and owner notifications have dedicated interfaces",()=>{
 for(const [html,id] of [
  [index,"customerOrdersNav"],
  [customerHtml,"trackingOrders"],
  [customerHtml,"enableCustomerAlerts"],
  [ownerHtml,"ownerNotificationToggle"],
  [ownerHtml,"ownerNotificationBadge"],
  [ownerHtml,"ownerNotificationList"],
  [ownerHtml,"ownerNotificationReadAll"]
 ])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(index.includes('src="customer-notifications.js?v=50"'));
 assert.ok(ownerHtml.includes('src="owner-notifications.js?v=50"'));
 assert.ok(index.includes('src="app.js?v=50"'));
});
test("All six order statuses remain represented and no status checks are removed",()=>{
 for(const s of ["new","reviewing","in_production","ready","delivered","cancelled"]){
  assert.ok(customer.includes(s));
  assert.ok(owner.includes(s));
  // API returns stored statuses and avoids a duplicate client-side authorization enum.
 }
 assert.ok(dashboard.includes('call("status",{id:order.id,status:to})'));
});
test("The backend checks owner identity and does not expose private orders to anonymous callers",()=>{
 assert.match(api,/db\.auth\.getUser\(token\)/);
 assert.match(api,/TEKO_OWNER_UID/);
 assert.match(api,/allowedOwnerOrigin|OWNER_ORIGINS|ORIGINS/);
 assert.match(api,/if\(!await authorizedOwner\(req,db\)\)/);
 assert.ok(api.includes('action==="ownerFeed"||action==="ownerRead"'));
 assert.ok(!customer.includes("TEKO_OWNER_UID"));
 assert.ok(!customer.includes("SERVICE_ROLE_KEY"));
 assert.ok(!index.includes("sb_secret_"));
});
test("Tracking secret is 256-bit, hashed server-side, and never placed in URLs",()=>{
 assert.ok(customer.includes("new Uint8Array(32)"));
 assert.ok(customer.includes("crypto.getRandomValues"));
 assert.ok(api.includes('crypto.subtle.digest("SHA-256"'));
 assert.ok(api.includes('crypto.subtle.sign("HMAC"'));
 assert.ok(api.includes('safeEqual(expected,proof)'));
 assert.ok(!/location\.hash.*trackingToken|searchParams\.set\(.trackingToken/.test(customer));
 assert.ok(customer.includes('method:"POST"'));
 assert.ok(api.includes('Cache-Control'));
});
test("Customer tracking is bound only after verified successful database registration",()=>{
 assert.ok(order.includes('if(ORDER_DB_REGISTRATION&&result.registered===true&&window.TEKO_CUSTOMER_NOTIFICATIONS)'));
 assert.ok(order.includes('window.TEKO_CUSTOMER_NOTIFICATIONS.bind('));
 assert.ok(order.includes('proof:request.proof,code'));
 assert.ok(order.includes('catch{'));
 assert.ok(api.includes('select("id,order_code").eq("storage_path",path).eq("order_code",code)'));
 assert.ok(api.includes(".insert({order_id:order.id,token_hash:tokenHash})"));
});
test("Client only stores its own capability token after backend activation",async()=>{
 const saved=new Map(),posts=[];
 const fakeStorage={
  getItem:k=>saved.get(k)??null,
  setItem:(k,v)=>saved.set(k,v)
 };
 const page={
  getElementById:()=>null,
  addEventListener:()=>{},
  visibilityState:"visible"
 };
 const win={isSecureContext:true,addEventListener:()=>{}};
 const context={window:win,document:page,localStorage:fakeStorage,crypto:webcrypto,
  setInterval:()=>0,setTimeout,clearTimeout,Notification:undefined,
  fetch:async(url,options)=>{
   posts.push(JSON.parse(options.body));
   return {ok:true,json:async()=>({tracking:true,code:"TK-1234567890"})};
  }
 };
 vm.runInNewContext(customer,context);
 assert.equal(typeof win.TEKO_CUSTOMER_NOTIFICATIONS.bind,"function");
 const proof={path:"orders/12345678-1234-1234-1234-123456789abc.zip",size:1234,
  expires:Date.now()+60000,proof:"f".repeat(64),code:"TK-1234567890"};
 assert.equal(await win.TEKO_CUSTOMER_NOTIFICATIONS.bind(proof),true);
 assert.equal(posts.length,1);
 assert.equal(posts[0].action,"bind");
 assert.match(posts[0].trackingToken,/^[a-f0-9]{64}$/);
 const savedOrder=JSON.parse(saved.get("teko-customer-tracking-v1"))[0];
 assert.equal(savedOrder.code,proof.code);
 assert.equal(savedOrder.token,posts[0].trackingToken);
 assert.equal(savedOrder.unread,0);
});
test("Owner notifications observe authenticated sign in and out and read state",()=>{
 assert.ok(dashboard.includes('new Event("teko-owner-signin")'));
 assert.ok(dashboard.includes('new Event("teko-owner-signout")'));
 assert.ok(dashboard.includes('window.TEKO_OWNER_NOTIFICATIONS_API=async'));
 assert.ok(owner.includes('window.addEventListener("teko-owner-signin",start)'));
 assert.ok(owner.includes('window.addEventListener("teko-owner-signout",stop)'));
 assert.ok(owner.includes('("ownerRead"'));
 assert.ok(api.includes("owner_read_at"));
});
