# TEKO STORE — ربط مساحة Supabase الخاصة بملفات الطلبات

**الحالة:** Bucket اسمه `teko-orders` تم إنشاؤه من لوحة العميل، لكن ربط موقع TEKO STORE به **لم يُفعّل بعد**. الإرسال الحالي يعمل بالطريقة المؤقتة (تنزيل ZIP وإرفاقه يدويًا).

## تفاصيل المشروع

- Project ref: `kopsyfhpcilafuesgjti`
- URL العام: `https://kopsyfhpcilafuesgjti.supabase.co`
- Bucket: `teko-orders` خاص (Private)
- MIME type: `application/zip`
- Max size: 40 MB
- مدة روابط التحميل المستهدفة: 7 أيام
- حذف الملفات المستهدف: بعد مرور 7 أيام على الرفع

## ليه لازم Edge Function؟

مستودع GitHub Pages ثابت، ولو أضفنا مفتاح Supabase السري في HTML أو JS هيقدر أي زائر يرفعه ويستنزف المساحة. بدلًا من ذلك، نستخدم `teko-order-link` لإصدار رابط رفع مؤقت لا يعمل إلا بعد تحقق Cloudflare Turnstile. ثم يرفع المتصفح ZIP مباشرة لمساحة Storage الخاصة، وبعد تأكيد الرفع يطلب رابط تحميل موقّع.

**ملاحظة:** رابط رفع Signed URL صالح ساعتين من إصدار Supabase، ولا يسمح بالاطلاع على ملفات أخرى.

## الخطوة التالية في حساب Supabase

1. افتح مشروع `teko-store`.
2. ادخل إلى **Edge Functions** من القائمة الجانبية.
3. اضغط **Deploy a new function** ثم **Via Editor**.
4. اسم الوظيفة: `teko-order-link`.
5. انسخ كود `supabase/functions/teko-order-link/index.ts` الموجود في GitHub إلى محرر Supabase، وانشره.
6. من إعدادات الوظيفة، اجعل **Verify JWT = OFF** لأن الزوار ليسوا مسجلين في Supabase. رمز Turnstile والتحقق داخل الكود هم الحماية من الطلبات العشوائية.
7. من **Edge Functions > Secrets** أضف:
   - `TURNSTILE_SECRET`: المفتاح السري لـ Cloudflare Turnstile، بعد إنشاء Widget للدومين `oa1963507-commits.github.io`.
   - `TEKO_HMAC_SECRET`: قيمة عشوائية قوية مختلفة عن Secret Turnstile، لا تقل عن 32 حرفًا.
8. لا ترسل الـSecrets في المحادثة ولا تضعها في GitHub. المتصفح يحتاج فقط الـ**Site Key العام** من Turnstile.

**لم يتم نشر الوظيفة إلى حساب Supabase بعد.** إنشاء الملفات على GitHub فقط لا يقوم بالنشر الآلي هناك.

## الحذف بعد 7 أيام

الوثائق الحالية للـBucket Lifecycle في Supabase تدعم انتهاء **النسخ القديمة من الملفات**، لكنها لا تدعم حذف النسخة الحالية تلقائيًا. لذلك جهزنا وظيفة `teko-orders-cleanup` للحذف عبر Storage API، وهي لا تعمل إلا بطلب يحمل قيمة `TEKO_CRON_SECRET` السرية. بعد نشر الوظيفة نضيف مهمة يومية من Supabase Cron تستدعيها؛ لا تعتمد على حذف صفوف storage.objects مباشرة.

## التفعيل على المتجر

بعد اختبار وظائف رفع وتوقيع الروابط على Supabase، يتم تشغيل التكامل من الموقع. **لا نفعّله قبل إعداد الأسرار والتحقق الأمني وتجربة الرفع والتنزيل.**

المتجر سيظل يستخدم زرًا واحدًا: **تجهيز ومشاركة الطلب على واتساب**. زر الموقع سيتولى إنشاء ZIP ورفعه والحصول على الرابط، ولن يرسل للمالك رابط تنزيل وهميًا.
