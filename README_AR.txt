نسخة Navo Ultimate Ready

الملفات الصحيحة:
- index.html: الصفحة الرئيسية
- style.css: تصميم مرتب + تحسينات فخمة
- app.js: وظائف الموقع + التحسينات الجديدة
- navo-config.js: إعدادات Supabase
- SUPABASE_SETUP.sql: شغله مرة واحدة داخل Supabase SQL Editor
- manifest.webmanifest + sw.js: دعم PWA
- assets/: الشعار والأيقونة

وش أضفت لك:
1) Dashboard أفضل وفيه Quick Actions وساعات منتجة.
2) قائمة جانبية قابلة للتصغير على الكمبيوتر.
3) إعدادات ألوان الهوية، اللغة، رفع صورة البروفايل.
4) Export / Import للبيانات.
5) Focus Room بوضع Cinema وتأثيرات أنعم.
6) تحسينات تسجيل الدخول: loading state + shake عند الخطأ.
7) تحسين الجوال والـ safe area.
8) تحسينات micro interactions.

طريقة التشغيل:
- افتح المجلد في VS Code.
- شغل Live Server على index.html.
- عدل navo-config.js وحط بيانات Supabase لو تبي cloud sync.
- شغل SUPABASE_SETUP.sql في Supabase إذا ما شغلته قبل.

ملاحظة:
لو فتحت الملف مباشرة بدون Live Server ممكن service worker أو بعض الميزات ما تشتغل صح.
