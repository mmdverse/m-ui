# فیلترینگ ایران — مهندسی معکوس و پروفایل‌های عبور در m-ui

این سند خروجی مرحلهٔ M13 است: اول روش‌های فیلترینگ از منابع وب/رسانه‌ای جمع شده، بعد رفتار واقعی کلاینت‌ها اندازه‌گیری و روی سورس کد مهندسی معکوس شده، و در آخر همان یافته‌ها به کد تبدیل شده‌اند (`src/lib/evasion.ts` + تست‌ها + اسکریپت اعتبارسنجی).

خلاصه در یک خط: **فیلتر ایران روی یک گیت‌وی مرکزی، چهار لایه روی هم می‌گذارد (DNS → HTTP DPI → SNI → whitelist پروتکل)؛ هر چیزی که در لایهٔ TLS شبیه یک سایت واقعی نباشد حذف می‌شود. پاسخ امروز: VLESS + REALITY + Vision روی ۴۴۳.**

---

## ۱) مدل چهارلایه‌ای فیلترینگ

| لایه | کاری که می‌کند | نشانهٔ قابل‌مشاهده |
|---|---|---|
| DNS | آلودگی پاسخ؛ دامنه‌های سانسورشده به `10.10.34.0/24` (صفحهٔ بلاک) می‌روند | «درخواست شما توسط سیستم فیلترینگ…» |
| HTTP DPI | تزریق 403 یا `TCP RST` روی هاست/کلیدواژه — **حساس به حروف بزرگ/کوچک** | کلمهٔ انگلیسی با حرف بزرگ از فیلتر رد می‌شود |
| TLS/SNI | ریست بلافاصله بعد از `ClientHello` | قطعی قبل از هر بایتی داده |
| Whitelist پروتکل | فقط DNS/HTTP/HTTPS عبور می‌کند؛ بقیه (SSH، OpenVPN، MQTT، هر TCP/UDP ناشناس) **بی‌صدا حذف** می‌شود | اتصال وصل نمی‌شود یا تایم‌اوت می‌خورد |

منابع: مقالهٔ «Iran's Stealth Blackout» (arXiv 2507.14183، تیر ۱۴۰۴) + گزارش ژانویهٔ ۲۰۲۶ + گزارش‌های OONI/Miaan از قطعی‌ها. نکتهٔ مهم گزارش‌ها: BGP بالاست و خبری از قطع کامل نیست؛ فیلتر «نامرئی» است.

**وضعیت ۲۰۲۶:** WireGuard با همان handshake ثابت ۱۴۸ بایتی ظرف چند ساعت شناسایی و IP بلاک می‌شود؛ OpenVPN مدل‌های قدیمی‌ترش سال‌هاست بسته است؛ UDP انتخابی فیلتر/محدود می‌شود (پس QUIC و Hysteria2 بی‌ریسک نیستند)؛ و در ناآرامی‌ها همهٔ ترافیک رمزنگاری‌شده throttled می‌شود. روی سمت مقابل: **probe فعال** — IPهای مشکوک را خودشان TLS می‌زنند و اگر سروری با گواهی جعلی جواب دهد، IP بلاک می‌شود.

## ۲) ترتیب مقاومت پروتکل‌ها (جمع‌بندی منابع)

1. **VLESS + REALITY + Vision** — بالاترین امتیاز؛ گواهی از یک سایت واقعی «قرض» گرفته می‌شود، Vision هم اثرانگشت طول/زمان‌بندی «TLS داخل TLS» را با padding پویا می‌پوشاند. نرخ شناسایی گزارش‌شده <۵٪ و دوام چندماهه.
2. NaiveProxy / CDN-fronting (کلادفلر) — بازهٔ IP کلادفلر در ایران عملاً بلاک نمی‌شود؛ گزینهٔ پشتیبان عالی.
3. Shadowsocks-2022 (AEAD) — با روش‌های ۲۰۲۲ (blake3/chacha20-poly1305) هنوز عبور می‌کند؛ نسخه‌های قدیمی نه.
4. Hysteria2/TUIC — روی QUIC؛ تا وقتی UDP باز باشد خوب است، ولی در whitelist می‌افتد.
5. AmneziaWG — بهترین انتخاب موبایل (نویز روی handshake وگارد)؛ جایگزین وگارد ساده.
6. VMess/Trojan — قدیمی‌ترها قابل‌تشخیص‌تر؛ فقط پشت TLS/REALITY.
7. WireGuard / OpenVPN / SSH تونل — عملاً مرده.

## ۳) چه چیزی در m-ui کد شده

`src/lib/evasion.ts` هر یافته را به یک قانون قابل‌آزمون تبدیل می‌کند:

- **DNS/SNI فیلترشده** به‌عنوان مقصد REALITY → `fail` (چون `ClientHello` با آن SNI همان لحظه RST می‌خورد). لیست `SNI_AVOID` و لیست سبز `SNI_GOOD`.
- **پورت** — ۴۴۳ امتیاز مثبت (مسدودکردنش تجارت خود ایران را می‌خواباند)، پورت‌های 22/1194/51820/8388/… → `fail`.
- **بدون TLS** (به‌غیر از SS-2022 که طراحی‌اش «ناشناس‌مانند» است) → `fail`، چون whitelist بقیه را حذف می‌کند.
- **REALITY بدون `flow=xtls-rprx-vision`** → هشدار (امضای طول بسته‌ها برمی‌گردد).
- **اثرانگشت uTLS** — `chrome` توصیه، `random/randomized/go` هشدار (تغییر هر اتصال خودش بی‌قاعدگی است).
- **شکل کلید** — `pbk` باید ۴۳ کاراکتر base64url از `xray x25519` باشد و `shortId` هکس و ≤۱۶ کاراکتر؛ وگرنه کلاینت اصلاً بالا نمی‌آید (این را با اجرای واقعی xray پیدا کردیم، بخش ۵).
- پروتکل‌های QUIC → هشدار UDP + توصیه به داشتن یک گزینهٔ TCP کنارشان.

خروجی: `assessForIran(cfg)` با امتیاز ۰–۱۰۰، رأی (`resilient/usable/fragile/blocked`) و برای هر ایراد **راه‌حل ماشینی** (`fix: { field: value }`)، به‌همراه `recommendedDefaults(protocol)`.

تست‌ها: `tests/evasion.test.ts` — ۱۳ تست (کل مجموعه: ۴۰ تست).

## ۴) اعتبارسنجی با کلاینت واقعی (اندازه‌گیری‌شده، نه ادعا)

Xray-core **26.3.27** روی همین ماشین؛ اسکریپت: `testenv/validate-iran-profiles.sh` و خروجی خام در `testenv/validation-iran-profiles.log`.

| پروفایل | رأی evasion.ts | امتیاز | اعتبار کانفیگ در xray |
|---|---|---|---|
| vless (reality+vision) | resilient | ۱۰۰ | accepted |
| vmess (reality) | usable | ۷۶ | accepted |
| trojan | resilient | ۱۰۰ | accepted |
| shadowsocks | usable | ۸۸ | accepted |
| socks5 | resilient | ۱۰۰ | accepted |
| hysteria2 | usable | ۸۸ | پروتکل xray نیست |

آزمون سرتاسری REALITY (سرور و کلاینت واقعی، مقصد TLS1.3 محلی):

```
tunnel traffic      : HTTP 200            ← ترافیک واقعی از داخل تونل
cert verification   : uConn.Verified=true ← کلاینت گواهی جعلی را با HMAC(AuthKey) تأیید کرد
client hello        : X25519MLKEM768      ← اثرانگشت chrome از key share پساکوانتومی استفاده می‌کند (REALITY پشتیبانی می‌کند)
```

و آزمون **ضدپروب** (همان چیزی که در ایران سرورهای آماتور را بلاک می‌کند): یک `openssl s_client` بدون کلید معتبر به پورت REALITY زدیم و پاسخ این بود:

```
subject=C=US, ST=WA, L=Redmond, O=Microsoft Corporation, CN=www.microsoft.com
issuer =C=US, O=Microsoft Corporation, CN=Microsoft TLS G2 RSA CA OCSP 04
```

یعنی probe همان گواهی واقعی سایتِ قرض‌گرفته‌شده را می‌بیند و هیچ نشانه‌ای از تونل نمی‌ماند.

## ۵) مهندسی معکوس خودِ اجرا (چرا REALITY در تست اول وصل نشد)

در تست اول با کلید و shortId درست، handshake رد شد. برای پیدا کردن دلیل، سراغ سورس رفتیم: سرور REALITY در نسخهٔ ۲۶ از ماژول `github.com/xtls/reality` می‌آید (`go.mod` → `v0.0.0-20260322125925`). در `tls.go` همان ماژول، شرط‌ها **به‌ترتیب** بررسی می‌شوند و همین، جدول دیباگ دست ما می‌دهد:

| پیام خطا در لاگ سرور | معنای واقعی | کاری که باید بکنی |
|---|---|---|
| `failed to read client hello` | ClientHello ناقص/بریده | مشکل شبکه یا MTU |
| `unsupported TLS version` | TLS 1.2 یا پایین‌تر | اثرانگشت uTLS را درست کن |
| `server name mismatch: X` | SNI کلاینت در `serverNames` سرور نیست | لیست سرور را کامل کن |
| `authentication failed or validation criteria not met` | کلید عمومی/`shortId`/زمان جفت نیست | `xray x25519 -i priv` و ساعت سیستم |
| `target sent incorrect server hello or handshake incomplete` | مقصد جواب درست نداد | `dest` را عوض کن |
| `handshake did not complete successfully` | auth **درست** بود ولی handshake نهایی تمام نشد | مقصد/شبکهٔ میانی |

نکات ریزِ همین بررسی که در مستندات رسمی کم پیدا می‌شوند:

- سرور REALITY برای **هر** اتصال اول به `dest` وصل می‌شود (mirror) و همان جا گواهی واقعی را می‌گیرد؛ اگر این مسیر در شبکهٔ میانی خراب شود، همهٔ کلاینت‌ها رد می‌شوند — دقیقاً همان چیزی که در سندباکس ما با مقصد خارجی رخ داد و با مقصد محلی حل شد.
- کلاینت گواهی سرور را با `HMAC-SHA512(AuthKey, cert.PublicKey)` مقایسه می‌کند؛ پس «کلید عمومی» صرفاً یک رمز نیست، مبنای تأیید گواهی است.
- auth در `SessionId` می‌رود: `[verX, verY, verZ, 0, timestamp(4B), shortId(8B)]` — پس **ساعت کلاینت و سرور** بخشی از پروتکل است.
- `xray x25519` جفت کلید می‌دهد؛ کلید عمومی فقط با `xray x25519 -i <private>` درست مشتق می‌شود. اجرای دوبارهٔ دستور بدون `-i` یک جفت *دیگر* می‌دهد و همان اشتباهی است که تونل را بی‌صدا خراب می‌کند.

## ۶) روش عملی برای کاربر m-ui

```bash
# سرور
xray x25519                       # یک‌بار؛ PrivateKey → سرور، Password(PublicKey) → کلاینت
# inbound: vless + tcp + reality, dest=<سایت فیلترنشده>:443, serverNames=[همان سایت],
#          shortIds=[هکس تصادفی], clients[].flow=xtls-rprx-vision
# client : publicKey=<از همان دستور>، fingerprint=chrome، spiderX=/، flow=xtls-rprx-vision
```

چک‌لیست ۳۰ ثانیه‌ای:
1. پورت **۴۴۳** (یا ۸۴۴۳) — نه ۲۲، نه ۱۱۹۴، نه ۵۱۸۲۰.
2. SNI = یک دامنهٔ **فیلترنشده** با TLS1.3 + X25519 + h2 (لیست سبز در `evasion.ts`).
3. `flow=xtls-rprx-vision` روی tcp.
4. `fingerprint=chrome` و `spiderX` یکتا برای هر کلاینت.
5. یک گزینهٔ پشتیبان روی CDN کلادفلر داشته باش که با قطع شدن اولی سریع جایگزین شود.

## ۷) منابع

- arXiv 2507.14183 — «Iran's Stealth Blackout» (چهار لایه، whitelist پروتکل، حساسیت حروف در HTTP DPI)
- arXiv 2603.28753 — تحلیل قطعی ژانویهٔ ۲۰۲۶ + گزارش‌های OONI
- miaan.org — گزارش قطعی (SSH/VPN/P2P، شکستن TLS fragmentation بعد از برگشت موبایل، SS روی ۵۳/۴۴۳)
- securityledger.com (می ۲۰۲۶) — WireGuard شناسایی‌شده، probe فعال، VLESS+REALITY پایدار
- vpnsmith.com / fexyn.com — جدول مقاومت پروتکل‌ها، SS-2022 برای ایران
- XTLS/REALITY + XTLS/Xray-examples («Serverless for Iran»: fragmentation/desync بدون سرور)
- سورس Xray-core 26.3.27 و `xtls/reality` (جدول خطاها و منطق auth در بخش ۵)
