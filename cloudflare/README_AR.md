# ربط TEKO STORE بـCloudflare مباشرة من المتصفح — بدون Terminal

الموقع الرئيسي سيظل على GitHub Pages. Cloudflare سيضيف خدمة تخزين ملفات الطلبات فقط.

## خطوات Cloudflare Dashboard (الطريقة المفضلة)
1. افتح https://dash.cloudflare.com وسجّل الدخول لحسابك.
2. من **R2 Object Storage** أنشئ bucket باسم **teko-orders**. اتركه **Private** بلا وصول عام، وأضف Lifecycle Rule بحذف الملفات داخل orders/ بعد 30 يوم.
3. افتح **Turnstile** وأنشئ Widget باسم **TEKO STORE**، بنطاق مسموح **oa1963507-commits.github.io**. انسخ **Site Key** العام واحتفظ بـ**Secret Key** داخل Cloudflare؛ لا ترسله في الشات أو GitHub.
4. افتح **Workers & Pages** ثم **Create application** ثم **Import a repository / Get started**، واسمح لـCloudflare GitHub App بالوصول إلى مستودع **oa1963507-commits/teko-store** فقط.
5. اختر المشروع **teko-store** والفرع **main**. اضبط **Root directory** إلى **cloudflare**؛ واسم Worker إلى **teko-order-files** (يجب أن يطابق اسم wrangler.json).
6. ضع **Deploy command** = `npx wrangler deploy`، واترك Build command فارغًا. اضغط **Save and Deploy**. وجود ملف `cloudflare/wrangler.json` يجعل الربط بـR2 متوقعًا من الإعدادات.
7. تحت Worker > **Settings > Variables & Secrets** أضف Secret باسم **TURNSTILE_SECRET** بقيمة مفتاح Turnstile Secret الحقيقي. أضف Secret آخر باسم **DOWNLOAD_SIGNING_SECRET** بقيمة عشوائية طويلة ومستقلة (32 بايت عشوائية على الأقل). **لا تضع السرّين في GitHub.**
8. تأكد أن Worker عنده R2 binding باسم **ORDERS_BUCKET** يشير إلى Bucket **teko-orders**. ملف wrangler.json يحتوي هذا التعريف مسبقًا. إن لم يظهر بعد النشر، راجع إعدادات Worker/R2.
9. انسخ **Worker URL** المنشور على `workers.dev`، وافتح ملف **order-cloud-config.js** في GitHub. ضع workerUrl = رابط Worker العام وturnstileSiteKey = Site Key العام. لا تدخل أي Secret فيه.
10. بعد Commit ونجاح نشر GitHub Pages، افتح TEKO STORE، وأكمل Turnstile ثم جرّب رفع طلب تجريبي. تأكد أن رسالة WhatsApp للمالك تحتوي على رابط ZIP حقيقي، وأنه يُنزل الملف ويفتحه بنجاح.

Cloudflare يدعم ربط GitHub تلقائيًا لتحديث Worker عند تعديلات المستودع. ضبط Root directory مهم لأن ملفات Worker داخل مجلد cloudflare وليس جذر الموقع.

**نقطة تحقق:** إذا لم تُنشأ مساحة R2 أو لم تُضف Secrets، قد يفشل النشر أو تُرجع خدمة الرفع خطأ 503. لا تعتبر الربط مكتملًا حتى تنجح عملية رفع وتجربة تنزيل ZIP. لا تدفع أو توافق على تغيير خطة مدفوعة دون مراجعة الأسعار.

---


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
