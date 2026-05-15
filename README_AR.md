# Navo 3.0 — Structured Calm OS

هذه نسخة إعادة الهيكلة الكاملة للمشروع.

## وش تغير؟
- تم فصل CSS إلى ملفات منظمة داخل `styles/`.
- تم نقل JavaScript إلى `app/` مع حدود واضحة للـ core/runtime/services/ai/focus/dashboard.
- تم تنظيم الأصول داخل `assets/branding` و `assets/icons`.
- تم نقل إعدادات Supabase إلى `config/`.
- تم نقل SQL إلى `supabase/`.
- تم تحديث Service Worker ليتوافق مع الهيكلة الجديدة.
- تم إبقاء ملفات توافق مثل `style.css` و `navo-config.js` عشان ما ينكسر شيء لو عندك روابط قديمة.

## التشغيل
1. افتح المجلد في VS Code.
2. شغل Live Server على `index.html`.
3. لا تفتح الملف مباشرة من `file://`.

## أهم الملفات
- `index.html`: الواجهة الرئيسية.
- `styles/main.css`: يجمع ملفات التصميم.
- `app/main.js`: نقطة تشغيل JavaScript.
- `app/runtime/navo-runtime.js`: كود التطبيق الحالي محفوظ بدون كسر.
- `app/core/performance.js`: نظام الأداء المبكر.
- `config/navo-config.js`: إعدادات Supabase.
- `supabase/SUPABASE_SETUP.sql`: قاعدة البيانات.

## ملاحظة مهمة
هذه إعادة هيكلة آمنة: نقلنا ونظمنا المشروع بدون ما نكسر الوظائف الحالية. الخطوة الجاية تكون تفكيك `navo-runtime.js` تدريجيًا إلى modules أصغر.
