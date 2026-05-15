# Navo Render Ready

مشروع Navo كامل مع:
- Node.js + Express
- SQLite Database
- تسجيل دخول / إنشاء حساب
- XP و Level
- مهام
- جلسات تركيز
- لوحة أدمن خاصة

## حساب الأدمن الافتراضي
username: Fulter
password: Fulter@12345

## تشغيل محلي
```bash
npm install
npm start
```

افتح:
```txt
http://localhost:3000
```

لوحة الأدمن:
```txt
http://localhost:3000/admin
```

## الرفع على Render
1. ارفع المشروع على GitHub
2. في Render اختر New Web Service
3. Build Command:
```bash
npm install
```
4. Start Command:
```bash
npm start
```
5. أضف Disk:
```txt
Mount Path: /data
```
6. Environment Variables:
```txt
ADMIN_USERNAME=Fulter
ADMIN_PASSWORD=Fulter@12345
JWT_SECRET=اكتب_رمز_سري_طويل
DATABASE_PATH=/data/navo.sqlite
```

## مهم
بعد أول تشغيل غير كلمة مرور الأدمن من متغيرات Render أو خليني أضيف لك صفحة تغيير كلمة المرور.
