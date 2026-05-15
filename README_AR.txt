# Navo 2.0 — Launch Version

هذه نسخة الإطلاق الجديدة من Navo كـ Calm Productivity Operating System.

## الملفات
- index.html: Landing Page + Auth + App
- style.css: الهوية الجديدة + Motion System + Responsive + Landing
- app.js: وظائف التطبيق + AI UX + Onboarding + Auth Polish
- navo-config.js: إعدادات Supabase
- SUPABASE_SETUP.sql: قاعدة البيانات في Supabase
- manifest.webmanifest + sw.js: دعم PWA
- assets/: الشعار والأيقونة

## أهم الإضافات
1) Landing Page احترافية كاملة: Hero, Features, AI Layer, Screenshots, Pricing, Testimonials, Footer.
2) هوية Navo 2.0 الجديدة: Calm Productivity OS + Focus without noise.
3) Motion System: Scroll reveals, tilt mockup, smoother command palette, hover depth.
4) Auth UX: Remember me, password strength, forgot password UI, social login placeholders, loading skeleton.
5) Onboarding: اختيار أسلوب المستخدم أول مرة.
6) AI Brain Dump: تصنيف الأفكار إلى مهام مع أولوية ومساحة مناسبة.
7) Focus Room 2.0: Deep Mode + cinematic polish.
8) Empty States احترافية بدل الفراغ العادي.
9) Command Palette أقوى بأوامر /focus /task /brain /theme.
10) Mobile polish وتحسينات إطلاق.

## التشغيل
افتح المجلد في VS Code ثم شغل Live Server على index.html.

## Supabase
لو تبي Cloud Sync:
1) عدل navo-config.js وحط بيانات مشروع Supabase.
2) شغل SUPABASE_SETUP.sql داخل Supabase SQL Editor مرة واحدة.

## ملاحظة
لا تفتح index.html مباشرة من الملف؛ استخدم Live Server عشان PWA و Service Worker يشتغلون صح.
