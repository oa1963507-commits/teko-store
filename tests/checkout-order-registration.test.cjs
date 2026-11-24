/* TEKO STORE — order persistence regression tests: never confirm an unregistered checkout. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const code=p=>fs.readFileSync(path.join(root,p),"utf8");
const editor=code("app.js");
const cart=code("cart.js");
const edge=code("supabase/functions/teko-order-link/index.ts");

test("One ZIP checkout is only confirmed when database registration succeeds",()=>{
 assert.ok(editor.includes("const ORDER_DB_REGISTRATION=ORDER_CLOUD.databaseOrdersEnabled===true||ORDER_DB_TEST"));
 assert.ok(editor.includes("if(ORDER_DB_REGISTRATION&&result.registered!==true)"));
 assert.ok(editor.includes("let result;"));
 assert.ok(editor.includes("result=await supabaseAction('finish',finishPayload)"));
 assert.equal(editor.split("result=await supabaseAction('finish',finishPayload)").length-1,2,"One normal finish and one retry");
 assert.ok(editor.includes("cloudRemainingMs()<14000"),"Retried writes must be bounded");
 assert.ok(edge.includes('if (insertError.code === "23505")'));
 assert.ok(edge.includes('eq("storage_path", path)'));
});
test("Single hoodie checkout failure saves ZIP, never claims DB registration or auto-opens WhatsApp",()=>{
 const start=editor.indexOf("if(ORDER_CLOUD.enabled===true&&!ORDER_DB_TEST&&!cloudCancelRequested&&cloudPreparedZip)");
 const end=editor.indexOf("}else{",start);
 assert.ok(start>0&&end>start);
 const fallback=editor.slice(start,end);
 assert.ok(fallback.includes("saveBlob(cloudPreparedZip"));
 assert.ok(fallback.includes("غير مسجّل"));
 assert.ok(fallback.includes("if(tab&&!tab.closed)tab.close()"));
 assert.ok(!fallback.includes("recordOrder(code)"));
 assert.ok(!fallback.includes("tab.location.replace("));
 assert.ok(!fallback.includes("window.location.href="));
});
test("Cart order checkout failure retains cart and ZIP without falsely confirming an order",()=>{
 const start=cart.indexOf('if(!cloudCancelRequested&&zip){',cart.indexOf("async function submit()"));
 const end=cart.indexOf('}finally{',start);
 assert.ok(start>0&&end>start);
 const fallback=cart.slice(start,end);
 assert.ok(fallback.includes('saveBlob(zip,"TEKO-ORDER-"'));
 assert.ok(fallback.includes("غير مسجّل"));
 assert.ok(fallback.includes("if(tab&&!tab.closed)tab.close()"));
 assert.ok(!fallback.includes("tab.location.replace("));
 assert.ok(!fallback.includes("window.location.href="));
 assert.ok(cart.includes("السلة كما هي")||cart.includes("السلة محفوظة"));
});
test("No customer or private credentials are placed in public checkout JS",()=>{
 assert.ok(!editor.includes("SUPABASE_SERVICE_ROLE_KEY"));
 assert.ok(!cart.includes("SUPABASE_SERVICE_ROLE_KEY"));
 assert.ok(!editor.includes("TEKO_OWNER_UID"));
 assert.ok(!cart.includes("TEKO_OWNER_UID"));
});
