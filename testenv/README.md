# testenv — محیط تست محلی

ابزارهای این پوشه برای تست واقعی پنل روی یک ماشین نوشته شده‌اند (بدون سرور
بیرونی): سرور و کانفیگ را خودشان می‌سازند، با SSH واقعی وصل می‌شوند و پروکسی
را بالا می‌آورند.

## اجرا

```bash
# ۱) دیتابیس موقت (mongodb-memory-server روی پورت ۲۷۰۹۹)
npm install --no-save mongodb-memory-server
node testenv/mongo-server.js &

# ۲) پنل با همان تنظیمات
PORT=3010 MONGODB_URI=mongodb://127.0.0.1:27099/mui \
JWT_SECRET=test-secret-for-local-run M_UI_ENCRYPTION_KEY=test-enc-key-please-rotate \
ADMIN_USERNAME=admin ADMIN_PASSWORD=SuperSecret123 npm run dev

# ۳) اتصال SSH محلی که هارنس به‌عنوان «سرور» استفاده می‌کند
sudo useradd -m -s /bin/bash sshtest && echo 'sshtest:TestPass123' | sudo chpasswd
echo 'sshtest ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/sshtest
sudo mkdir -p /run/sshd && sudo /usr/sbin/sshd -p 2222 -o PasswordAuthentication=yes -o UsePAM=no

# ۴) هارنس (با E2E=1 استقرار واقعی + ترافیک از داخل پروکسی هم آزمایش می‌شود)
bash testenv/verify-fixes.sh
E2E=1 bash testenv/verify-fixes.sh
```

## فایل‌ها

| فایل | کار |
|---|---|
| `verify-fixes.sh` | هارنس اصلی؛ سرور/کانفیگ خودش را می‌سازد و همهٔ فیکس‌های M1–M17 را می‌آزماید |
| `negative-deploy-check.py` | تست منفیِ چک استقرار: پورت اشغال ⇒ ۵۰۰ `api.deployFailed` |
| `mongo-server.js` | مونگو روی ۲۷۰۹۹ (در حافظه؛ با هر ری‌استارت داده پاک می‌شود و ادمین از env ساخته می‌شود) |
| `validate-iran-profiles.sh` + `validate-profile.ts` | اعتبارسنجی پروفایل‌های ضدسانسور با Xray واقعی |
| `validate-iran-profiles.log` | خروجی همان اجرا (شاهد M13) |
| `add-api-keys.py` | ابزار یک‌بارمصرف برای افزودن کلیدهای `api.*` به پنج دیکشنری |

## باینری Xray

`testenv/bin/` در گیت نیست (۵۶ مگابایت). برای اجرای اعتبارسنجی پروفایل‌ها،
Xray هم‌نسخهٔ همان چیزی که در `docs/iran-censorship.md` آمده را دستی بگذارید:

```bash
mkdir -p testenv/bin
curl -L -o testenv/bin/x.zip https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-linux-64.zip
unzip -o testenv/bin/x.zip -d testenv/bin && chmod +x testenv/bin/xray
bash testenv/validate-iran-profiles.sh
```
