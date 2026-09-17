/**
 * «خط لولهٔ ترانزیت» — همان چیزی که مدل را از «نظر» به «نقشهٔ اجرا» تبدیل می‌کند.
 *
 * ایدهٔ اصلی: از کشور سانسورشده (لبهٔ اول) فقط *یک* لبه دیده می‌شود. هرچه بعد
 * از آن است، بیرون از دید سانسور است. پس لبهٔ اول باید تنها چیزی را بفرستد که
 * مدل ما برای عبور لازم می‌داند (REALITY + Vision + تکه‌سازی واقعی)، و بقیهٔ
 * گره‌ها کار دیگری می‌کنند: توزیع، ورودی/خروجی، و مسیر خروج.
 *
 * چرا چند گره؟ چون در عمل سه چیز با هم لازم است و هیچ‌کدام جای دیگری را نمی‌گیرد:
 *   ۱) یک لبهٔ *ورودی* در کشوری که مسیرش پرترافیک است ولی خودِ ترافیک ما از
 *      دید سانسور مکانی که در آن هستیم «مشروع» به‌نظر برسد.
 *   ۲) یک یا چند *رله* برای توزیع ورودی‌ها (IP ورودی که بسوزد، برنچ عوض می‌شود
 *      بدون این‌که کاربر کانفیگ عوض کند).
 *   ۳) یک *خروج* نزدیک به مقصد نهایی.
 *
 * اندازه‌گیری سربار: `testenv/transit-lab.py` زنجیرهٔ واقعی Xray را روی همین
 * ماشین بالا می‌آورد (۱ گره و ۳ گره) و تأخیر افزوده به‌ازای هر گره را می‌سنجد؛
 * عدد در `testenv/transit-measured.json` ذخیره و در تست‌ها با همین فایل چک می‌شود.
 * توجه: این عدد «سربار پردازش هر گره» است، نه تأخیر جغرافیایی — آن یکی به
 * فاصلهٔ فیزیکی گره‌ها بستگی دارد و این‌جا قابل اندازه‌گیری نیست.
 */
import { JA4_NAMES, MEASURED_FINGERPRINTS } from './fingerprints';
import { assess, type PlanParams } from './engine';
import type { CountryId, PlanId } from './types';

export type HopRole = 'entry' | 'relay' | 'exit';

export interface HopLeg {
  /** طرحی که روی *این* پا اجرا می‌شود (`PLANS` در plans.ts). */
  plan: PlanId;
  port: number;
  /** تکه‌سازی واقعی لازم است؟ (پایی که از مرز سانسورشده می‌گذرد) */
  fragmented: boolean;
  /** ترفندهای اجباری این پا. */
  must: string[];
}

export interface Hop {
  id: string;
  role: HopRole;
  /** کشور گره — برای نمایش. */
  country: string;
  /** پایی که *به* این گره می‌رسد و برای گرهٔ قبلی/کاربر دیده می‌شود. */
  leg: HopLeg;
  /** سانسوری که این پا را می‌بیند. */
  observer: string;
  /** چرا این گره این‌جاست. */
  why: string;
  resources: { cpu: 'small' | 'medium'; ram: string; note: string };
}

export interface TransitPipeline {
  id: string;
  target: CountryId;
  hops: Hop[];
  /** چیزهایی که هرگز نباید اشتباه شود. */
  rules: string[];
}

/**
 * سربار اندازه‌گیری‌شدهٔ هر گره (میلی‌ثانیه) — از `testenv/transit-lab.py`.
 * اندازه‌گیری ما بین ۰.۲ تا ۶.۴ms در آمد؛ اختلاف از این است که آیا هزینهٔ
 * handshake هر گره هم داخل عدد هست یا نه. عدد محافظه‌کارانه (حالت پایدار) این‌جاست
 * و `tests/transit.test.ts` آن را با فایل اندازه‌گیری چک می‌کند.
 */
export const MEASURED_HOP_OVERHEAD_MS = 0.2;

/** مثل PlanParams، ولی UUID اختیاری است (نبودش = جای‌نگهدار). */
export type TransitParams = Omit<PlanParams, 'uuid'> & {
  /** دامنهٔ واقعی ورودی (SNI). */
  sni: string;
  /** پورت ورودی لبه. */
  entryPort?: number;
  /** شناسهٔ کاربر؛ پیش‌فرض جای‌نگهدار است. */
  uuid?: string;
  /** کلید خصوصی REALITY هر گره (پیش‌فرض: جای‌نگهدار). */
  realityPrivateKey?: string;
  /** کلید عمومی REALITY برای زنجیر کردن گره‌ها. */
  realityPublicKey?: string;
  /** shortId شانزده‌شانزدهی (پیش‌فرض: مقدار نمونهٔ معتبر). */
  shortId?: string;
}

/**
 * ساخت خط لوله برای یک کشور. اکنون فقط برای ایران معنا دارد: چون لبهٔ اول باید
 * هم‌زمان از وایت‌لیست پروتکلی، مود SNI و بازچینش TSPU عبور کند؛ بقیهٔ کشورها
 * با یک گره هم قابل مدیریت‌اند.
 */
export function buildPipeline(target: CountryId): TransitPipeline {
  const best = assess(target, 'reality-vision-frag');
  const chromeJa4 = MEASURED_FINGERPRINTS.chrome?.ja4 ?? '';
  const chromeName = JA4_NAMES[chromeJa4] ?? 'chrome';
  return {
    id: `transit-${target}`,
    target,
    hops: [
      {
        id: 'edge-1',
        role: 'entry',
        country: 'tr',
        leg: {
          plan: 'reality-vision-frag',
          port: 443,
          fragmented: true,
          must: [
            `streamSettings.realitySettings.fingerprint = ${chromeName}`,
            'flow = xtls-rprx-vision',
            'finalmask.tcp[0] = fragment{length:"100-200", delay:"10-20", maxSplit:"4-8"}',
            'streamSettings.fragment (کلید قدیمی) مرده است — بی‌صدا نادیده گرفته می‌شود',
          ],
        },
        observer: target,
        why: 'تنها پایی که سانسور کشور هدف می‌بیند؛ همهٔ لایه‌های شدت‌بالا این‌جا جبران می‌شوند.',
        resources: { cpu: 'small', ram: '512MB', note: 'ترافیک ورودی + رمزگشایی؛ نیازی به CPU سنگین نیست' },
      },
      {
        id: 'relay-1',
        role: 'relay',
        country: 'de',
        leg: { plan: 'reality-vision', port: 8443, fragmented: false, must: ['flow = xtls-rprx-vision'] },
        observer: 'open',
        why: 'IP ورودی سوختنی است: با سوختن، کاربر فقط آدرس رله را عوض می‌کند نه کانفیگش.',
        resources: { cpu: 'medium', ram: '1GB', note: 'پهنای باند مهم‌تر از CPU است' },
      },
      {
        id: 'exit-1',
        role: 'exit',
        country: 'nl',
        leg: { plan: 'reality-vision', port: 2053, fragmented: false, must: ['فیلتر DNS داخلی خاموش باشد'] },
        observer: 'open',
        why: 'خروجی نزدیک سرویس هدف؛ چیزی که کاربر می‌بیند (IP نهایی) این‌جاست.',
        resources: { cpu: 'medium', ram: '1GB', note: 'بافر TCP برای ویدیو' },
      },
    ],
    rules: [
      'هیچ کلید یا UUID واقعی داخل کانفیگ‌های تولیدی نیست — همه جا PLACEHOLDER.',
      'کلید خصوصیِ جای‌نگهدار خودش یک محافظ است: Xray با آن بالا نمی‌آید (rc=23)، پس کانفیگ ناتمام قابل اجرا نیست.',
      'هر گره باید پورت و SNI جانشین داشته باشد؛ وگرنه یک بلاک، کل زنجیره را می‌خواباند.',
      'REALITY در پورت غیر ۴۴۳ خودش زنگ خطر است: Xray خودش هم هشدار می‌دهد (serverNames را کامل بده).',
      `امتیاز مدل برای پای ورودی: ${best.score}/100 (${best.verdict})`,
    ],
  };
}

/** خط لوله سالم است؟ مشکلات را برمی‌گرداند (خالی = سالم). */
export function validatePipeline(p: TransitPipeline): string[] {
  const problems: string[] = [];
  const roles = p.hops.map((h) => h.role);
  if (roles[0] !== 'entry') problems.push('اولین گره باید entry باشد');
  if (!roles.includes('exit')) problems.push('گرهٔ خروج وجود ندارد');
  if (new Set(p.hops.map((h) => h.country)).size !== p.hops.length) {
    problems.push('دو گره در یک کشور = تک‌نقطه‌شکست جغرافیایی');
  }
  for (const hop of p.hops) {
    if (hop.leg.port < 1 || hop.leg.port > 65535) problems.push(`${hop.id}: پورت نامعتبر`);
    if (hop.role === 'entry' && !hop.leg.fragmented) problems.push('پای ورودی بدون تکه‌سازی از بازچینش TSPU رد نمی‌شود');
    if (hop.role === 'entry' && hop.observer === 'open') problems.push('پای ورودی باید ناظر داشته باشد؛ وگرنه مدل بی‌معنا است');
  }
  const entry = p.hops[0];
  const assessment = assess(p.target, entry.leg.plan);
  // فقط «بی‌دفاع» مهم است: لایه‌های 'na' (مثل DNS داخل تونل) و 'partial' جریمهٔ
  // کمتری دارند و خط لوله را نمی‌شکنند.
  const killers = assessment.rows.filter((r) => r.severity >= 4 && r.coverage === 'exposed');
  if (killers.length) problems.push(`پای ورودی این لایه‌ها را جبران نمی‌کند: ${killers.map((k) => k.layer).join(', ')}`);
  return problems;
}

/** کانفیگ گره‌ها + کانفیگ کلاینت. همهٔ رازها جای‌نگهدارند. */
export function hopConfigs(p: TransitPipeline, params: TransitParams) {
  const [entry, relay, exit] = p.hops;
  const uuid = params.uuid || 'PLACEHOLDER-UUID';
  const entryPort = params.entryPort ?? entry.leg.port;

  const vlessIn = (tag: string, flow?: string) => ({
    tag,
    listen: '0.0.0.0',
    port: 0, // در هر گره مقدار واقعی گذاشته می‌شود
    protocol: 'vless',
    settings: { clients: [{ id: uuid, ...(flow ? { flow } : {}) }], decryption: 'none' },
  });

  const shortId = params.shortId ?? 'a1b2c3d4';
  const privKey = params.realityPrivateKey ?? 'PLACEHOLDER-REALITY-PRIVATE-KEY';
  const pubKey = params.realityPublicKey ?? 'PLACEHOLDER-REALITY-PUBLIC-KEY';

  /** ورودی هر گره: REALITY روی ترمینال خودش. */
  const realityIn = (sni: string, dest: string) => ({
    network: 'tcp',
    security: 'reality',
    realitySettings: { show: false, dest, serverNames: [sni], privateKey: privKey, shortIds: [shortId] },
  });

  /** پایی که گره را به گرهٔ بعد زنجیر می‌کند: این‌جا فقط *کلید عمومی* می‌رود. */
  const chain = (toRelay: { host: string; port: number; sni: string }) => ({
    tag: 'to-next',
    protocol: 'vless',
    settings: { vnext: [{ address: toRelay.host, port: toRelay.port, users: [{ id: uuid, encryption: 'none', flow: 'xtls-rprx-vision' }] }] },
    streamSettings: {
      network: 'tcp',
      security: 'reality',
      realitySettings: { serverName: toRelay.sni, fingerprint: 'chrome', publicKey: pubKey, shortId, spiderX: '' },
    },
  });

  const entryCfg = {
    log: { loglevel: 'warning' },
    inbounds: [{ ...vlessIn('in-entry', 'xtls-rprx-vision'), port: entryPort, streamSettings: realityIn(params.sni, params.dest ?? params.sni + ':443') }],
    outbounds: [
      chain({ host: relay.id + '.example.net', port: relay.leg.port, sni: 'www.bing.com' }),
      { tag: 'block', protocol: 'blackhole' },
      { tag: 'direct', protocol: 'freedom' },
    ],
    routing: {
      rules: [
        // یک قاعدهٔ سادهٔ ضدسوءاستفاده: تورنت روی گرهٔ ورودی بسته است.
        { type: 'field', protocol: ['bittorrent'], outboundTag: 'block' },
        { type: 'field', inboundTag: ['in-entry'], outboundTag: 'to-next' },
      ],
    },
  };

  const relayCfg = {
    log: { loglevel: 'warning' },
    inbounds: [{ ...vlessIn('in-relay', 'xtls-rprx-vision'), port: relay.leg.port, streamSettings: realityIn('www.bing.com', 'www.bing.com:443') }],
    outbounds: [chain({ host: exit.id + '.example.net', port: exit.leg.port, sni: 'www.cloudflare.com' }), { tag: 'direct', protocol: 'freedom' }],
    routing: { rules: [{ type: 'field', inboundTag: ['in-relay'], outboundTag: 'to-next' }] },
  };

  const exitCfg = {
    log: { loglevel: 'warning' },
    inbounds: [{ ...vlessIn('in-exit'), port: exit.leg.port, streamSettings: realityIn('www.cloudflare.com', 'www.cloudflare.com:443') }],
    outbounds: [{ tag: 'direct', protocol: 'freedom', settings: { domainStrategy: 'UseIPv4' } }],
    routing: { rules: [{ type: 'field', inboundTag: ['in-exit'], outboundTag: 'direct' }] },
  };

  const client = {
    log: { loglevel: 'warning' },
    inbounds: [{ listen: '127.0.0.1', port: 1080, protocol: 'socks', settings: { auth: 'noauth', udp: true } }],
    outbounds: [
      {
        protocol: 'vless',
        settings: { vnext: [{ address: 'ENTRY.HOST.IP', port: entryPort, users: [{ id: uuid, encryption: 'none', flow: 'xtls-rprx-vision' }] }] },
        streamSettings: {
          // کلاینت فقط کلید عمومی REALITY را می‌داند؛ کلید خصوصی هرگز از سرور بیرون نمی‌رود.
          network: 'tcp',
          security: 'reality',
          realitySettings: {
            serverName: params.sni,
            fingerprint: 'chrome',
            publicKey: pubKey,
            shortId,
            spiderX: '',
          },
          tlsSettings: { fingerprint: 'chrome' },
          finalmask: {
            tcp: [{ type: 'fragment', settings: { packets: 'tlshello', length: '100-200', delay: '10-20', maxSplit: '4-8' } }],
          },
        },
      },
    ],
  };

  return { entry: entryCfg, relay: relayCfg, exit: exitCfg, client };
}

/** سربار تخمینی زنجیره (پردازش گره‌ها) — نه تأخیر جغرافیایی. */
export function pipelineOverheadMs(p: TransitPipeline): number {
  return Math.round((p.hops.length - 1) * MEASURED_HOP_OVERHEAD_MS * 10) / 10;
}
