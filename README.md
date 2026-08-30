# 🐳 M-UI

پنل مدیریت سرور و VPN بر پایه Next.js 14. داده‌ها واقعی هستند: اتصال‌ها با SSH تست می‌شوند، آمار از خود سرورها خوانده می‌شود و همه APIها احراز هویت دارند.

## وضعیت قابلیت‌ها (صادقانه)

| قابلیت | وضعیت | توضیح |
|:------|:----:|:------|
| افزودن سرور (SSH Password/Key) | ✅ کامل | هر دو روش احراز هویت ذخیره و استفاده می‌شود |
| تست اتصال و پایش (CPU/RAM/load/uptime/ترافیک) | ✅ کامل | پروب واقعی با ssh2؛ مقادیر از `/proc` سرور خوانده می‌شود |
| مونیتور دوره‌ای و نمودار ترافیک | ✅ کامل | node-cron هر ۱۰ دقیقه نمونه می‌گیرد؛ نمودار از همین نمونه‌ها ساخته می‌شود |
| موقعیت جغرافیایی سرور | ✅ کامل | از IP تشخیص داده می‌شود (ip-api)؛ در صورت خطا برچسب دستی |
| کانفیگ با UUID دائمی | ✅ کامل | UUID و رمز روی سرور تولید و ذخیره می‌شوند |
| لینک اشتراک VMess / VLESS / Trojan / Shadowsocks | ✅ کامل | از همان UUID/رمز ذخیره‌شده ساخته می‌شود (مقدار ثابت ماندگار است) |
| TLS / WebSocket / HTTP / gRPC / KCP / QUIC در لینک | ✅ کامل | به‌صورت پارامتر استاندارد در لینک درمی‌آید (به شرط پیکربندی همین ترنسپورت روی سرور) |
| REALITY | ✅ کامل | فیلدهای pbk / fp / sid در فرم و در لینک‌های vless/vmess/trojan |
| CDN (دامنه به‌جای IP) | ✅ کامل | فیلد دامنه CDN به‌عنوان host لینک |
| تانل SSH Reverse | ✅ کامل | با کلاینت OpenSSH اجرا می‌شود (`ssh -N -R`)؛ شروع/توقف واقعی |
| تانل Direct / FRP / WireGuard | 🧪 در دست اجرا | در دیتابیس ثبت می‌شوند ولی هنوز اجرا نمی‌شوند |
| SOCKS5 / WireGuard (پروتکل کانفیگ) | 🧪 در دست اجرا | ثبت می‌شوند اما لینک اشتراک قابل تولید ندارند (نیازمند کلید/پروکسی واقعی) |
| داشبورد، لاگ فعالیت، کاربران و نقش‌ها | ✅ کامل | همه از داده واقعی؛ رمزها bcrypt و همه APIها پشت JWT |
| Docker | ✅ کامل | `docker compose` از سورس (ایمیج عمومی هنوز منتشر نشده) |

## نصب

```
git clone https://github.com/mmdverse/m-ui
cd m-ui
cp .env.example .env    # JWT_SECRET و ADMIN_PASSWORD را حتماً ست کنید
npm install
npm run dev
```

### راه‌اندازی Docker

```
JWT_SECRET=... ADMIN_PASSWORD=... docker compose up -d
```

## تنظیمات محیطی

| متغیر | توضیح |
|:------|:------|
| `MONGODB_URI` | آدرس MongoDB (پیش‌فرض `mongodb://localhost:27017/mui`) |
| `JWT_SECRET` | **الزامی** — بدون آن پنل در production اجرا نمی‌شود |
| `ADMIN_USERNAME` | نام کاربری ادمین اولیه (پیش‌فرض `admin`) |
| `ADMIN_PASSWORD` | **الزامی برای اولین اجرا** — فقط وقتی هنوز کاربری ساخته نشده استفاده می‌شود؛ حداقل ۸ کاراکتر |
| `MONITOR_INTERVAL` | عبارت cron مونیتور (پیش‌فرض هر ۱۰ دقیقه) |

## API

همه endpointها (به‌جز لاگین) به هدر `Authorization: Bearer <token>` نیاز دارند.

| Method | Endpoint | توضیح |
|:------|:---------|:------|
| POST | `/api/auth/login` | ورود و دریافت JWT |
| GET | `/api/auth/me` | کاربر جاری |
| GET/POST/DELETE | `/api/auth/users` | لیست / ایجاد / حذف کاربر (فقط admin) |
| POST | `/api/auth/change-password` | تغییر رمز خود کاربر |
| GET/POST | `/api/servers/list` · `/api/servers/add` · `/api/servers/test` · `/api/servers/delete` | سرورها |
| GET/POST | `/api/configs/list` · `/api/configs/add` · `/api/configs/link` · `/api/configs/delete` | کانفیگ‌ها و لینک اشتراک |
| GET/POST | `/api/tunnels/list` · `/api/tunnels/add` · `/api/tunnels/start` · `/api/tunnels/stop` · `/api/tunnels/delete` | تانل‌ها |
| GET | `/api/system/stats` · `/api/system/activity` | آمار داشبورد و رویدادها |

## امنیت

- هیچ secret هاردکدی در کد نیست؛ بدون `JWT_SECRET` در production پنل بالا نمی‌آید
- رمزهای کاربران فقط به‌صورت هش bcrypt ذخیره می‌شوند (APIها هرگز هش را برنمی‌گردانند)
- نقش‌ها: `admin` / `reseller` / `user` — مسیرهای حساس فقط برای admin
- صفحه‌ها بدون توکن معتبر به لاگین ریدایرکت می‌شوند

## محدودیت‌ها

- وضعیت تانل‌ها در حافظهٔ پروسه پنل است؛ بعد از ری‌استارت باید از UI دوباره شروع شوند
- تانل با رمز عبور SSH به `sshpass` روی سرور پنل نیاز دارد (با کلید SSH لازم نیست)
- پنل تک‌اینستنس است

## استک

Next.js 14 (Pages Router) · TypeScript · MongoDB (Mongoose) · ssh2 · OpenSSH · node-cron

## مجوز

MIT

---

ساخته شده با ❤️ توسط [Mohammad](https://t.me/llllxyz)
