# 🐳 M-UI — پنل مدیریت حرفه‌ای VPN

> **پیشرفته‌ترین پنل مدیریت سرور و VPN** برای دور زدن فیلترینگ هوشمند
> پشتیبانی از **تانلینگ، مولتی سرور، TLS, WebSocket, gRPC, REALITY**
> ساخته شده برای اینترنت آزاد 🇮🇷

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb" />
  <img src="https://img.shields.io/badge/License-MIT-03a66d?style=for-the-badge" />
</p>

---

## ✨ قابلیت‌ها

### 🖥️ مدیریت سرورها
| ویژگی | توضیح |
|:------|:-------|
| ➕ **افزودن سرور** | پشتیبانی از SSH Password/Key |
| 🔌 **تست اتصال** | پینگ و بررسی وضعیت لحظه‌ای |
| 📊 **مانیتورینگ** | CPU, RAM, ترافیک, uptime |
| 🌍 **موقعیت جغرافیایی** | تفکیک ایران/خارج |

### 🔗 مدیریت کانفیگ‌ها
| ویژگی | توضیح |
|:------|:-------|
| 📡 **پروتکل‌ها** | VMess, VLESS, Trojan, Shadowsocks, SOCKS5, WireGuard |
| 🔀 **ترنسپورت** | TCP, KCP, WebSocket, HTTP, QUIC, gRPC |
| 🔒 **امنیت** | TLS, REALITY (X-UI هم نمی‌زنه!) |
| 🌐 **CDN** | پشتیبانی از Cloudflare CDN |
| 📋 **لینک اشتراک** | کپی لینک کانفیگ با یک کلیک |

### 🔀 تانلینگ پیشرفته
| ویژگی | توضیح |
|:------|:-------|
| 🔄 **Direct Tunnel** | فوروارد پورت ساده |
| 🔐 **SSH Tunnel** | تانل معکوس SSH برای دور زدن فیلترینگ |
| 🚀 **FRP** | تانلینگ حرفه‌ای با FRP |
| 🔗 **WireGuard** | تونل امن WireGuard |
| 🌍 **ایران → خارج** | اتصال سرور ایران به سرور خارج |

### 📊 داشبورد
| ویژگی | توضیح |
|:------|:-------|
| 📈 **نمودار ترافیک** | ۷ روز اخیر |
| 🟢 **وضعیت سرورها** | آنلاین/آفلاین |
| 📊 **آمار لحظه‌ای** | سرورها، کانفیگ‌ها، تانل‌ها |
| 👥 **کاربران** | مدیریت کاربران و فروشندگان |

---

## 🚀 شروع سریع

```bash
git clone https://github.com/mmdverse/m-ui.git
cd m-ui
npm install
cp .env.example .env.local
npm run dev
```

## 🐳 اجرا با Docker

```bash
docker run -d --name m-ui -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017/mui \
  mmdverse/m-ui
```

---

## 📁 ساختار پروژه

```
m-ui/
├── src/
│   ├── components/
│   │   └── Layout.tsx          # منوی کناری + قالب اصلی
│   ├── pages/
│   │   ├── index.tsx            # صفحه ورود
│   │   ├── dashboard.tsx        # داشبورد اصلی
│   │   ├── servers.tsx          # مدیریت سرورها
│   │   ├── configs.tsx          # کانفیگ‌ها
│   │   ├── tunnels.tsx          # تانلینگ
│   │   ├── users.tsx            # کاربران
│   │   ├── logs.tsx             # لاگ‌ها
│   │   ├── settings.tsx         # تنظیمات
│   │   └── api/                 # API routes
│   ├── lib/
│   │   ├── config.ts            # تنظیمات
│   │   └── db.ts                # مدل‌های دیتابیس
│   └── styles/
│       └── globals.css
├── .env.example
└── package.json
```

---

## 🔌 API Reference

| Method | Endpoint | توضیح |
|:------|:---------|:------|
| POST | /api/auth/login | ورود به پنل |
| GET | /api/system/stats | آمار سیستم |
| GET | /api/servers/list | لیست سرورها |
| POST | /api/servers/add | افزودن سرور |
| GET | /api/servers/test | تست اتصال سرور |
| GET | /api/configs/list | لیست کانفیگ‌ها |
| POST | /api/configs/add | کانفیگ جدید |
| GET | /api/tunnels/list | لیست تانل‌ها |
| POST | /api/tunnels/add | تانل جدید |

---

## 🔥 مقایسه با رقبا

| ویژگی | M-UI | X-UI | سنایی |
|:------|:----:|:----:|:-----:|
| ظاهر مدرن | ✅ | ❌ | ❌ |
| REALITY | ✅ | ✅ | ❌ |
| تانلینگ | ✅ | ❌ | ❌ |
| مولتی سرور | ✅ | ❌ | ❌ |
| پشتیبانی CDN | ✅ | ✅ | ❌ |
| داشبورد | ✅ | ❌ | ❌ |
| پنل مدیریت کاربران | ✅ | ❌ | ❌ |
| Docker | ✅ | ❌ | ❌ |
| بکاپ | ✅ | ❌ | ❌ |
| Open Source | ✅ | ✅ | ❌ |

---

## 📜 لایسنس
**MIT** — آزاد برای استفاده شخصی و تجاری

<p align="center">ساخته شده با ❤️ توسط <a href="https://t.me/llllxyz">Mohammad</a> | @llllxyz</p>
