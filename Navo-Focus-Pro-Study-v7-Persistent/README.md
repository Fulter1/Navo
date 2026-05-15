# Navo Admin Pro — Owner + Support + Telegram Ready

## الجديد
- رتبة Owner محمية
- Admin / User / Banned
- حماية من حذف نفسك أو إزالة رتبتك
- بحث وفلترة المستخدمين
- تفاصيل المستخدم: مهام + جلسات تركيز + تذاكر
- تعديل XP
- تغيير كلمة مرور المستخدم
- تذاكر دعم واقتراحات من داخل الموقع
- تبويب تذاكر في لوحة الأدمن
- سجل إداري Audit Logs
- Telegram Bot جاهز اختياريًا

## حساب Owner
username: Fulter
password: Fulter@12345

## التشغيل المحلي
```bash
npm install
npm start
```

## Render Environment
```txt
NODE_VERSION=20.18.1
OWNER_USERNAME=Fulter
OWNER_PASSWORD=Fulter@12345
ADMIN_USERNAME=Fulter
ADMIN_PASSWORD=Fulter@12345
JWT_SECRET=اكتب_رمز_سري_طويل
DATABASE_PATH=./data/navo.sqlite
```

## Telegram اختياري
```txt
TELEGRAM_BOT_TOKEN=توكن_البوت
TELEGRAM_ADMIN_CHAT_ID=ايدي_حسابك
```

Webhook:
```txt
https://YOUR_DOMAIN/api/telegram/webhook
```

ثم تضبطه من:
```txt
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook
```
