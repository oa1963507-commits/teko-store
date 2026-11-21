
# TEKO STORE — تشغيل لينك ZIP في رسالة واتساب

تم إعداد التكامل في المستودع، لكنه يحتاج حساب Cloudflare لإطلاق خدمة التخزين.

## (1) Cloudflare R2 — مساحة تخزين خاصة
- افتح https://dash.cloudflare.com/
- أنشئ R2 bucket باسم teko-orders واختر Standard Storage.
- حافظ على إعداد Private؛ لا تفعل الوصول العام إلى الـbucket.
- أضف Lifecycle Rule لحذف الملفات ذات البادئة orders/ بعد 30 يومًا.

## (2) Cloudflare Turnstile
- أنشئ Turnstile Widget لنطاق oa1963507-commits.github.io
- احتفظ بمفتاح Site Key العام، ومفتاح Secret Key السري؛ لا ترفعه إلى GitHub.

## (3) نشر Worker
من جذر مستودع teko-store، بعد تسجيل الدخول بـNode.js وWrangler:

    npx wrangler login
    npx wrangler deploy --config cloudflare/wrangler.json

ثم أدخل الأسرار في إعدادات Cloudflare، باستخدام:

    npx wrangler secret put TURNSTILE_SECRET --config cloudflare/wrangler.json
    npx wrangler secret put DOWNLOAD_SIGNING_SECRET --config cloudflare/wrangler.json

DOWNLOAD_SIGNING_SECRET قيمة عشوائية مستقلة قوية، وليست نفس مفتاح Turnstile.
يمكن توليدها محليًا بواسطة Node.js:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

لا ترفع الأسرار إلى GitHub مطلقًا.

## (4) توصيل واجهة المتجر
افتح ملف order-cloud-config.js في GitHub وضع البيانات العامة فقط:
- workerUrl: رابط Worker الحقيقي، وهو HTTPS عادةً على نطاق workers.dev.
- turnstileSiteKey: المفتاح العام لـTurnstile.

ثم Commit واستنى نشر GitHub Pages واضغط Ctrl+F5.
لا تضع TURNSTILE_SECRET أو DOWNLOAD_SIGNING_SECRET أو أي API token داخل JavaScript العامة.

## (5) تجربة الطلب
- اختار تصميمًا، واملأ اسم العميل ورقمه والكمية.
- أكمل التحقق الأمني Turnstile في قسم الطلب.
- اضغط تجهيز الطلب وفتح واتساب.
- يتم تجهيز ZIP بالموكابات الأربع والتصميمات الأصلية والتفاصيل.
- يُرفع ZIP إلى R2 ثم يُضاف رابط التحميل الموقّع إلى رسالة واتساب.
- عند فشل الرفع يتوقف إرسال الرابط، ويظل تنزيل ZIP يدويًا متاحًا.

## الأمان والخصوصية
- ملفات العملاء لا تُنشر في مستودع GitHub.
- مخزن R2 خاص ولا يلزمه دومين عام.
- رابط التنزيل مؤقت وموقّع؛ أي شخص لديه الرابط يمكنه تنزيل ملفات الطلب حتى انتهاء صلاحيته.
- الرابط ينتهي خلال 30 يومًا، لكن حذف الملفات الفعلي يعتمد على Lifecycle Rule التي تفعّلها في R2.
- يلزم تحقق Turnstile لاستقبال كل رفع؛ الحد الافتراضي 20 ميجابايت.
- الحصص المجانية في Cloudflare ليست ضمانًا لعدم وجود رسوم لو تجاوز الاستخدام الحدود.

## ملفات التكامل
- cloudflare/src/index.js — Worker للرفع وتنزيل ZIP.
- cloudflare/wrangler.json — إعدادات Cloudflare العامة.
- order-cloud-config.js — رابط Worker ومفتاح Turnstile العام فقط.
- app.js وindex.html — تشغيل رفع الملف وإدراج رابط التحميل في واتساب.

**تنبيه:** تفعيل GitHub Pages وحده لا ينشر Worker. لا يوجد رابط تحميل تلقائي فعال حتى نشر Worker وتهيئة R2 وTurnstile.
