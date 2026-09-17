<div align="center">

# 🐳 M-UI

**پنل مدیریت سرور و VPN — با دادهٔ واقعی، نه دمو**

[فارسی](#فارسی) · [English](#english) · [Русский](#русский) · [العربية](#العربية) · [中文](#中文)

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-67%20passing-brightgreen)
![Languages](https://img.shields.io/badge/languages-5%20(fa%20en%20ru%20ar%20zh)-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

</div>

---

<div dir="rtl">

## فارسی

**M-UI** یک پنل خودمیزبان برای مدیریت سرورها، کانفیگ‌های VPN و تانل‌هاست که روی
Next.js 14 ساخته شده. هیچ‌چیز نمایشی نیست: اتصال سرورها با SSH واقعی تست می‌شود،
آمار از `/proc` خود سرور خوانده می‌شود و پروکسی SOCKS5 واقعاً روی سرور نصب و اجرا
می‌شود. هر کانفیگ پیش از ساخت، با معیارهای **شبکهٔ واقعی ایران** سنجیده می‌شود تا
از روز اول فیلتر نشود.

### قابلیت‌ها

| قابلیت | وضعیت | توضیح |
|:------|:----:|:------|
| سرور و اتصال SSH | ✅ | رمز یا کلید SSH؛ تست اتصال واقعی پیش از ذخیره |
| پایش (CPU/RAM/load/uptime/ترافیک) | ✅ | پروب ssh2؛ مقادیر از `/proc` سرور؛ نمونه‌برداری دوره‌ای + نمودار ۷ روز |
| کانفیگ با UUID دائمی | ✅ | UUID/رمز یک‌بار تولید و ذخیره می‌شود؛ لینک ثابت می‌ماند |
| لینک اشتراک VMess/VLESS/Trojan/Shadowsocks | ✅ | با TLS، WebSocket، gRPC، HTTP، KCP، QUIC و CDN |
| REALITY | ✅ | فیلدهای `pbk`/`fp`/`sid` در فرم و داخل لینک |
| SOCKS5 با استقرار خودکار | ✅ | نصب و اجرای microsocks روی سرور با کاربر/رمز اختصاصی هر کانفیگ |
| WireGuard | ✅ | تولید کلید X25519 و فایل `.conf` کلاینت |
| تانل SSH Reverse | ✅ | اجرا/توقف واقعی با کلاینت OpenSSH |
| تانل Direct / FRP / WireGuard | 🧪 | ثبت می‌شوند، اجرا هنوز نه (در نقشهٔ راه) |
| مشاور اتصال | ✅ | امتیازدهی کانفیگ با رفتار مقیاس‌شدهٔ شبکهٔ ایران: SNIهای سوخته، پورت‌های مرده، اثر انگشت uTLS |
| داشبورد، رویدادها، کاربران و نقش‌ها | ✅ | JWT + bcrypt + محدودیت نرخ ورود؛ نقش‌ها واقعاً اعمال می‌شوند |
| امنیت داده | ✅ | رمزها و کلیدها با AES-256-GCM مهر می‌شوند و هیچ‌وقت از API برنمی‌گردند |
| چندزبانه | ✅ | فارسی، انگلیسی، روسی، عربی، چینی — با RTL/LTR خودکار |
| Docker | ✅ | `docker compose` از سورس (ایمیج آماده منتشر نشده) |

### راه‌اندازی سریع

```bash
git clone https://github.com/mmdverse/m-ui
cd m-ui
cp .env.example .env     # JWT_SECRET و ADMIN_PASSWORD را پر کنید
npm ci
npm run build && npm start
```

یا با داکر:

```bash
JWT_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD=یک-رمز-قوی MONGO_PASS=رمز-دیتابیس \
  docker compose up -d
```

پنل روی `http://localhost:3000` بالا می‌آید و اولین ادمین از متغیرهای محیطی ساخته می‌شود.

### مستندات

- [`docs/iran-censorship.md`](docs/iran-censorship.md) — مدل چهارلایه‌ای فیلترینگ ایران و مهندسی معکوس REALITY
- [`docs/theme.md`](docs/theme.md) — توکن‌های تم دارک لوکس و قواعد دیزاین
- [`docs/i18n.md`](docs/i18n.md) — ساختار چندزبانه و روش افزودن زبان تازه
- [`testenv/README.md`](testenv/README.md) — اجرای تست‌های واقعی روی ماشین خودتان

</div>

---

## English

**M-UI** is a self-hosted panel for servers, VPN configs and tunnels, built on
Next.js 14. Nothing here is a mock-up: servers are probed over real SSH, metrics
come from `/proc` on the machine itself, and a SOCKS5 proxy is genuinely
installed and started on the target server. Every config is scored against
**measured Iranian network behaviour** before you ship it.

### Features

- **Servers over real SSH** — password or key, tested before it is stored.
- **Monitoring** — CPU, RAM, load, uptime and traffic read from `/proc`, sampled
  on a cron, charted over the last seven days.
- **Configs with a permanent identity** — UUID/password generated once, so a
  share link never changes under your users.
- **Share links** — VMess, VLESS, Trojan, Shadowsocks with TLS, WebSocket, gRPC,
  HTTP, KCP, QUIC and CDN fronting; REALITY (`pbk`/`fp`/`sid`) included.
- **SOCKS5 auto-deploy** — installs and runs microsocks on the server with
  per-config credentials (`apt`/`dnf`/`yum`/`apk`).
- **WireGuard** — X25519 client keypair plus a valid `.conf`.
- **SSH reverse tunnels** — real start/stop through the OpenSSH client.
  (Direct / FRP / WireGuard tunnels are recorded, not executed yet.)
- **Censorship advisor** — scores a config against how Iranian networks actually
  filter: dead SNIs, blocked ports, unsafe uTLS fingerprints, QUIC handling.
- **Users and roles** — JWT, bcrypt, login rate limiting, enforced roles.
- **Secrets stay secret** — AES-256-GCM at rest, never echoed by the API.
- **Five languages** — Persian, English, Russian, Arabic, Chinese, with
  automatic RTL/LTR.
- **Docker** — `docker compose` from source.

### Quick start

```bash
git clone https://github.com/mmdverse/m-ui
cd m-ui
cp .env.example .env     # fill JWT_SECRET and ADMIN_PASSWORD
npm ci
npm run build && npm start
```

Or with Docker:

```bash
JWT_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD=strong-pass MONGO_PASS=db-pass \
  docker compose up -d
```

The panel listens on `http://localhost:3000`; the first admin is seeded from the
environment. Tests: `npm test` (67 unit tests, no network needed).

---

## Русский

**M-UI** — self-hosted панель для серверов, VPN-конфигов и туннелей на Next.js 14.
Всё настоящее: серверы проверяются по SSH, метрики берутся из `/proc`, а SOCKS5
действительно устанавливается и запускается на сервере. Каждый конфиг
оценивается по **реальному поведению иранских сетей** — чтобы он не умер в
первый день.

### Возможности

- **Серверы по SSH** — пароль или ключ, с реальной проверкой перед сохранением.
- **Мониторинг** — CPU, RAM, load, uptime и трафик из `/proc`, выборка по cron и
  график за семь дней.
- **Конфиги с постоянным UUID** — ссылка не меняется под пользователями.
- **Ссылки** — VMess, VLESS, Trojan, Shadowsocks с TLS, WebSocket, gRPC, HTTP,
  KCP, QUIC и CDN; поддержка REALITY (`pbk`/`fp`/`sid`).
- **Авторазвёртывание SOCKS5** — microsocks ставится и запускается на сервере
  со своими учётными данными для каждого конфига.
- **WireGuard** — клиентская пара X25519 и корректный `.conf`.
- **Обратные SSH-туннели** — реальный запуск и остановка через OpenSSH.
- **Советник по блокировкам** — оценка конфига по измеренному поведению сети:
  сожжённые SNI, закрытые порты, рискованные отпечатки uTLS.
- **Пользователи и роли** — JWT, bcrypt, ограничение попыток входа.
- **Секреты** — AES-256-GCM на диске, API их никогда не отдаёт.
- **Пять языков** — персидский, английский, русский, арабский, китайский; RTL/LTR
  автоматически.
- **Docker** — `docker compose` из исходников.

### Быстрый старт

```bash
git clone https://github.com/mmdverse/m-ui
cd m-ui
cp .env.example .env     # заполните JWT_SECRET и ADMIN_PASSWORD
npm ci
npm run build && npm start
```

Панель на `http://localhost:3000`, первый администратор создаётся из переменных
окружения. Тесты: `npm test`.

---

<div dir="rtl">

## العربية

**M-UI** لوحة تُستضاف ذاتياً لإدارة الخوادم وملفات VPN والأنفاق، مبنية على
Next.js 14. لا شيء هنا شكليّ: الاتصال بالخوادم يُختبر عبر SSH حقيقي، والإحصاءات
تُقرأ من `/proc` على الخادم نفسه، وبروكسي SOCKS5 يُثبَّت ويُشغَّل فعلاً على
الخادم. كل ملف يُقيَّم مقابل **سلوك الشبكة الإيرانية المقيس** قبل استخدامه.

### المزايا

- **الخوادم عبر SSH** — كلمة مرور أو مفتاح، مع اختبار اتصال حقيقي قبل الحفظ.
- **المراقبة** — CPU وRAM وload وuptime والحركة من `/proc`، بقياس دوري ومخطط
  لسبعة أيام.
- **ملفات بهوية ثابتة** — UUID يُولَّد مرة واحدة، فلا يتغيّر الرابط على المستخدمين.
- **روابط المشاركة** — VMess وVLESS وTrojan وShadowsocks مع TLS وWebSocket
  وgRPC وHTTP وKCP وQUIC وCDN، ودعم REALITY (`pbk`/`fp`/`sid`).
- **نشر SOCKS5 تلقائياً** — تثبيت وتشغيل microsocks على الخادم ببيانات دخول خاصة
  لكل ملف.
- **WireGuard** — توليد زوج مفاتيح X25519 وملف `.conf` صالح.
- **أنفاق SSH العكسية** — تشغيل وإيقاف حقيقيان عبر OpenSSH.
- **مستشار الاتصال** — تقييم الإعداد حسب السلوك المقيس: نطاقات محجوبة، منافذ
  مسدودة، بصمات uTLS خطرة، وتعامل الشبكة مع QUIC.
- **المستخدمون والأدوار** — JWT وbcrypt وتحديد محاولات الدخول.
- **الأسرار تبقى سرية** — تشفير AES-256-GCM ولا تُعاد أبداً عبر الـ API.
- **خمس لغات** — الفارسية والإنجليزية والروسية والعربية والصينية، مع RTL/LTR
  تلقائي.
- **Docker** — `docker compose` من المصدر.

### التشغيل السريع

```bash
git clone https://github.com/mmdverse/m-ui
cd m-ui
cp .env.example .env     # املأ JWT_SECRET و ADMIN_PASSWORD
npm ci
npm run build && npm start
```

اللوحة على `http://localhost:3000`، ويُنشأ أول مدير من متغيّرات البيئة.
الاختبارات: `npm test`.

</div>

---

## 中文

**M-UI** 是一个自托管的服务器 / VPN 配置 / 隧道管理面板，基于 Next.js 14。
这里没有演示数据：服务器通过真实 SSH 探测，指标直接读取服务器上的 `/proc`，
SOCKS5 代理是真的在目标服务器上安装并启动的。每个配置在交付前都会按
**实测的伊朗网络行为**评分。

### 功能

- **真实 SSH 服务器管理** — 支持密码或密钥，保存前先测试连接。
- **监控** — CPU、内存、load、uptime 与流量均读取 `/proc`，定时采样并绘制
  最近七天图表。
- **固定身份的配置** — UUID/密码只生成一次，分享链接不会在用户手里失效。
- **分享链接** — VMess、VLESS、Trojan、Shadowsocks，支持 TLS、WebSocket、
  gRPC、HTTP、KCP、QUIC 与 CDN，包含 REALITY（`pbk`/`fp`/`sid`）。
- **SOCKS5 自动部署** — 在服务器上安装并运行 microsocks，每个配置独立账号密码。
- **WireGuard** — 生成 X25519 客户端密钥对与可用的 `.conf`。
- **SSH 反向隧道** — 通过 OpenSSH 真实启动与停止。
- **抗封锁顾问** — 按实测行为给配置打分：被封锁的 SNI、不可用端口、危险的
  uTLS 指纹、QUIC 处理方式。
- **用户与角色** — JWT、bcrypt、登录限流，角色真正生效。
- **凭据安全** — 落盘使用 AES-256-GCM，接口永不回显。
- **五种语言** — 波斯语、英语、俄语、阿拉伯语、中文，自动 RTL/LTR。
- **Docker** — 从源码 `docker compose` 启动。

### 快速开始

```bash
git clone https://github.com/mmdverse/m-ui
cd m-ui
cp .env.example .env     # 填写 JWT_SECRET 与 ADMIN_PASSWORD
npm ci
npm run build && npm start
```

面板运行在 `http://localhost:3000`，首个管理员由环境变量创建。
测试：`npm test`。

---

## Project layout

```
src/
├── components/       Layout، LanguageSwitcher، ui
├── i18n/             fa (منبع حقیقت) + en/ru/ar/zh + core + provider
├── lib/              ssh · secrets · ratelimit · evasion · links · tunnel · monitor …
├── pages/            ۹ صفحه + API routes
└── styles/           تم دارک لوکس مونوکروم
docs/                 iran-censorship · theme · i18n
tests/                ۶۷ تست واحد (vitest)
testenv/              هارنس تست واقعی + اعتبارسنجی Xray
```

## Security

- رمز و کلید SSH با `AES-256-GCM` مهر می‌شوند (`M_UI_ENCRYPTION_KEY`) و هیچ
  مسیری آن‌ها را برنمی‌گرداند.
- ورود با محدودیت ۸ تلاش در ۱۰ دقیقه و زمان پاسخ یکسان برای کاربر ناموجود.
- نقش‌ها روی همهٔ روت‌های نوشتن اعمال می‌شوند؛ خطاها هرگز جزئیات داخلی را لو نمی‌دهند.
- در حالت `production` پنل بدون `JWT_SECRET` بالا نمی‌آید.

---

Made with ❤️ by [Mohammad](https://t.me/llllxyz) · ساخته شده با ❤️ توسط [Mohammad](https://t.me/llllxyz) · Сделано с ❤️ [Mohammad](https://t.me/llllxyz) · صُنع بـ ❤️ [Mohammad](https://t.me/llllxyz) · 由 ❤️ 制作 [Mohammad](https://t.me/llllxyz)

`M-UI · MIT`
