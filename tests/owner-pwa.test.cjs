/* TEKO OWNER — standalone dashboard UX and PWA regression checks */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const src=p=>fs.readFileSync(path.join(root,p),"utf8");
const owner=src("owner.html");
const script=src("owner-pwa.js");
const theme=src("owner-theme.css");
const app=src("owner.js");
const adminNotif=src("owner-notifications.js");
const manifest=JSON.parse(src("owner.webmanifest"));
const storefrontManifest=JSON.parse(src("manifest.webmanifest"));

test("TEKO OWNER is a separate installable PWA, not a replacement for TEKO STORE",()=>{
 assert.equal(manifest.id,"./owner-console");
 assert.notEqual(manifest.id,storefrontManifest.id);
 assert.equal(manifest.start_url,"./owner.html");
 assert.equal(manifest.display,"standalone");
 assert.equal(manifest.lang,"ar");
 assert.equal(manifest.dir,"rtl");
 assert.equal(manifest.scope,storefrontManifest.scope);
 assert.equal(manifest.name.includes("TEKO OWNER"),true);
 assert.ok(Array.isArray(manifest.icons));
 assert.ok(manifest.icons.some(x=>x.sizes==="192x192"));
 assert.ok(manifest.icons.some(x=>x.sizes==="512x512"));
 for(const item of manifest.icons){
  assert.ok(fs.existsSync(path.join(root,item.src)),"Original TEKO app icon missing: "+item.src);
 }
 assert.equal(storefrontManifest.start_url,"./#home");
});
test("Owner page retains all existing privileged features and login hooks",()=>{
 const ids=[
  "loginPanel","loginForm","loginEmail","loginPassword","loginButton","configNotice",
  "appPanel","insightsPanel","ownerTabs","tabOrders","tabCustomers","tabStorage",
  "ordersPanel","ordersBody","searchOrders","filterStatus","filterForm","logoutButton",
  "customersPanel","customersBody","storagePanel","storageFilesBody",
  "deleteSelectedZips","deleteAllZips","storageConfirmPanel",
  "ownerNotificationToggle","ownerNotificationBadge","ownerNotificationList",
  "ownerNotificationReadAll","ownerNotificationPermission"
 ];
 for(const id of ids){
  assert.equal(owner.split('id="'+id+'"').length-1,1,id+" is missing or repeated");
 }
 assert.match(app,/admin.auth.getUser|TEKO_OWNER_CONFIG/);
 assert.ok(app.includes('window.TEKO_OWNER_NOTIFICATIONS_API=async'));
 assert.ok(adminNotif.includes('window.addEventListener("teko-owner-signin",start)'));
 assert.ok(!script.includes("SERVICE_ROLE_KEY"));
 assert.ok(!script.includes("localStorage"));
 assert.ok(!script.includes("ownerPassword"));
});
test("Dark TEKO branding loads as a separate presentation-only stylesheet",()=>{
 assert.match(owner,/<body class="owner-dashboard">/);
 assert.ok(owner.includes('href="owner-theme.css?v=51"'));
 assert.ok(owner.includes('href="owner.webmanifest?v=51"'));
 assert.match(theme,/--owner-bg:#0b0a0e/);
 assert.match(theme,/--owner-accent:#f62b4d/);
 assert.match(theme,/\.owner-hero/);
 assert.match(theme,/\.owner-sidebar/);
 assert.match(theme,/\.owner-install-modal/);
 assert.match(theme,/@media\(max-width:790px\)/);
 assert.match(theme,/#ordersBody td:nth-child\(1\)::before/);
 assert.match(theme,/#customersBody td:nth-child\(1\)::before/);
 assert.match(theme,/\.storage-files/);
});
test("Five interactive navigation areas connect to existing owner functionality",()=>{
 const ids=["ownerNavOverview","ownerNavOrders","ownerNavCustomers","ownerNavStorage","ownerNavAlerts"];
 for(const id of ids){
  assert.equal(owner.split('id="'+id+'"').length-1,1);
  assert.ok(script.includes(id));
 }
 assert.ok(script.includes('click("tabOrders")'));
 assert.ok(script.includes('click("tabCustomers")'));
 assert.ok(script.includes('click("tabStorage")'));
 assert.ok(script.includes('click("ownerNotificationToggle")'));
 assert.ok(script.includes('body.classList.add("owner-authenticated")'));
 assert.ok(script.includes('body.classList.remove("owner-authenticated")'));
});
test("PWA installation has native and manual guidance and registers network-only SW",()=>{
 for(const id of ["ownerInstallBtn","ownerInstallLabel","ownerInstallHelp","ownerInstallDescription",
  "ownerInstallClose","ownerInstallDone","ownerInstallSteps"]){
  assert.ok(owner.includes('id="'+id+'"'),id);
 }
 assert.ok(owner.includes('src="owner-pwa.js?v=51"'));
 for(const event of ["beforeinstallprompt","appinstalled","keydown","teko-owner-signin","teko-owner-signout"])
  assert.ok(script.includes(event));
 assert.match(script,/await prompt\.prompt\(\)/);
 assert.ok(script.includes("iPhone|iPad|iPod"));
 assert.ok(script.includes("Android"));
 assert.ok(script.includes('navigator.serviceWorker.register("./sw.js"'));
 const sw=src("sw.js");
 assert.ok(sw.includes('self.addEventListener("fetch"'));
 assert.ok(!sw.includes("caches.open("));
 assert.ok(!sw.includes("cache.put("));
});
test("Owner dashboard tabs still work when mobile navigation activates them",()=>{
 const els=new Map();
 const events={};
 function E(id){
  if(els.has(id))return els.get(id);
  const listeners=new Map();
  const el={id,hidden:false,classList:{values:new Set(),add(x){this.values.add(x);},remove(x){this.values.delete(x);},toggle(x,v){if(v)this.add(x);else this.remove(x);}},
   style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},
   removeAttribute(k){delete this.attributes[k]},
   addEventListener(name,fn){listeners.set(name,fn)},
   click(){listeners.get("click")?.({target:this})},
   scrollIntoView(){this.scrolled=true},
   replaceChildren(){},append(){},focus(){},disabled:false};
  els.set(id,el);return el;
 }
 const ctx={
  document:{
   body:E("body"),activeElement:E("previous"),
   getElementById:E,addEventListener:()=>{}
  },
  window:{
   navigator:{userAgent:"Mozilla/5.0 Chrome",platform:"Linux",maxTouchPoints:0,standalone:false,serviceWorker:null},
   matchMedia:()=>({matches:false}),
   addEventListener:(name,cb)=>{events[name]=cb},
   requestAnimationFrame:cb=>cb()
  },
  navigator:{serviceWorker:null},
  console
 };
 vm.runInNewContext(script,ctx);
 assert.ok(events["teko-owner-signin"]);
 assert.ok(events["teko-owner-signout"]);
 let orderClicks=0,customerClicks=0,storageClicks=0,alertClicks=0;
 for(const [id,cb] of [
  ["tabOrders",()=>{orderClicks++}],
  ["tabCustomers",()=>{customerClicks++}],
  ["tabStorage",()=>{storageClicks++}],
  ["ownerNotificationToggle",()=>{alertClicks++}]
 ])E(id).addEventListener("click",cb);
 E("tabStorage").hidden=false;
 events["teko-owner-signin"]();
 assert.equal(E("body").classList.values.has("owner-authenticated"),true);
 E("ownerNavOrders").click();E("ownerNavCustomers").click();
 E("ownerNavStorage").click();E("ownerNavAlerts").click();
 assert.deepEqual([orderClicks,customerClicks,storageClicks,alertClicks],[1,1,1,1]);
 events["teko-owner-signout"]();
 assert.equal(E("body").classList.values.has("owner-authenticated"),false);
});
