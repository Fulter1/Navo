# Navo 2.1 — Intelligent Calm OS جاهز

هذه نسخة جاهزة للتشغيل مبنية فوق Navo 2.0.

## أهم ما تم تنفيذه
- Performance System: وضع رسوم تلقائي + Low Graphics للأجهزة الضعيفة.
- Adaptive Blur: تخفيف البلور والظلال حسب الجهاز.
- AI Pulse داخل الداشبورد: اقتراحات ذكية حسب المهام والجلسات.
- Smart Brain Dump محسن: تصنيف المهام حسب الأولوية والمساحة.
- Focus Room 2.1: Deep Mode + Focus Lock + Breathing Rings.
- Keyboard Shortcuts داخل Focus: Space إيقاف، Enter تشغيل، Esc Deep Mode.
- Viral Share Cards: بطاقة أسبوعية قابلة للتحميل SVG.
- Sound Design خفيف: نغمات UI ناعمة مولدة محليًا.
- Dynamic Ambience: يتغير الجو حسب وقت اليوم.
- Mobile Native Feel: تحسينات لمس وجوال وBottom sheet خفيف.
- Command Palette أقوى: /deep /summary /graphics بجانب أوامر 2.0.
- Brand Personality: نصوص أهدأ وتجربة أقرب لمنتج SaaS.

## التشغيل
1. افتح المجلد في VS Code.
2. شغل Live Server على index.html.
3. لا تفتح index.html مباشرة من file:// عشان PWA و Service Worker.

## Supabase
- عدل navo-config.js ببيانات مشروعك.
- شغل SUPABASE_SETUP.sql مرة واحدة في Supabase SQL Editor.

## ملاحظة مهمة
الـ AI هنا Local Smart Engine بدون API خارجي. لو تبغى AI حقيقي بـ OpenAI/Gemini نضيف Backend آمن لاحقًا حتى لا ينكشف مفتاح API في المتصفح.
