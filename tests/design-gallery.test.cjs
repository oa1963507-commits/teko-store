/* TEKO STORE public gallery regressions. Use: node --test tests/design-gallery.test.cjs */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
const catalog=JSON.parse(source("catalog/gallery.json"));
const html=source("index.html"),cart=source("cart.js"),editor=source("app.js");
const gallery=source("design-gallery.js"),style=source("design-gallery.css");

test("The gallery is a shared public JSON catalog, not a localStorage-only library",()=>{
 assert.equal(catalog.version,1);
 assert.ok(Array.isArray(catalog.items));
 assert.ok(catalog.items.length>=4);
 assert.ok(gallery.includes('fetch("catalog/gallery.json"'));
 assert.ok(!/\b(localStorage|sessionStorage|indexedDB)\b/.test(gallery));
 assert.ok(!/\b(?:supabase\.storage|supabase\.functions|serviceRole)\b/i.test(gallery));
});
test("Every starter design matches the four existing TEKO typography items",()=>{
 const expected=[["g1","TEKO BOLD","TEKO"],["g2","STREET ENERGY","STREET"],["g3","YOUR STYLE","YOUR STYLE"],["g4","NO LIMITS","NO LIMITS"]];
 assert.deepEqual(catalog.items.map(x=>[x.id,x.title,x.text]),expected);
 assert.equal(new Set(catalog.items.map(x=>x.id)).size,catalog.items.length);
 assert.ok(catalog.items.every(x=>x.kind==="text"&&x.category&&x.font));
});
test("Page exposes searchable filters, preview and add-to-studio buttons",()=>{
 for(const id of ["galleryPage","gallerySearch","galleryCategories","publicGalleryGrid","galleryDetail","galleryPreviewUse"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(gallery.includes("search.addEventListener"));
 assert.ok(gallery.includes("renderCategories()"));
 assert.ok(gallery.includes('window.TEKO_GALLERY_USE(item)'));
 assert.ok(html.includes('href="#gallery" data-route="gallery"'));
 assert.ok(html.includes('src="design-gallery.js?v=48"'));
 assert.ok(html.includes('href="design-gallery.css?v=48"'));
});
test("Gallery route is distinct from legacy #designs studio tab",()=>{
 assert.ok(cart.includes('place==="gallery"?"gallery"'));
 assert.ok(cart.includes('routeName==="gallery"?"gallery"'));
 assert.ok(cart.includes('$("galleryPage").hidden=screen!=="gallery"'));
 assert.ok(cart.includes('if(place==="designs")'));
 assert.ok(html.includes('id="designs"'));
});
test("Product design selection preserves the existing hoodie and cart",()=>{
 assert.ok(editor.includes("window.TEKO_GALLERY_USE=async"));
 assert.ok(editor.includes("addDesign({kind:'image'"));
 assert.ok(editor.includes("addDesign({kind:'text'"));
 assert.ok(editor.includes("window.addEventListener('teko-gallery-updated',renderGallery)"));
 assert.ok(cart.includes('window.TEKO_CART='));
 assert.ok(editor.includes("const PRINT_LIMITS={width:40,height:60}"));
 assert.ok(!gallery.includes("indexedDB"));
});
test("Mobile grid and four tabs remain responsive",()=>{
 assert.ok(html.includes('data-route="gallery"><span class="dock-icon"'));
 assert.match(style,/\.mobile-dock\{grid-template-columns:repeat\(4/);
 assert.match(style,/@media\(max-width:850px\)/);
 assert.match(style,/\.gallery-grid-public/);
});
