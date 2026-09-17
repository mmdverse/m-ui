/**
 * موتور ارزیابی: «اگر با این برنامه از این کشور وصل شوی، کدام لایه‌های فیلتر
 * می‌گیرندت و چه چیزی جبرانش می‌کند؟»
 *
 * خروجی این ماژول را صفحهٔ «اطلس فیلترینگ» و تست‌ها استفاده می‌کنند. هیچ‌چیز
 * اینجا شبکه صدا نمی‌زند؛ کاملاً خالص و قابل تست است.
 */
import { countryKey, FILTER_LISTS, PROFILES } from './countries';
import { JA4_ALLOWLIST, MEASURED_FINGERPRINTS } from './fingerprints';
import { PLAN_ORDER, PLANS } from './plans';
import type { CountryId, LayerKind, PlanId, Verdict } from './types';
import type { Plan } from './plans';

export type Coverage = 'covered' | 'partial' | 'exposed' | 'na';

export interface CoverageRow {
  layer: LayerKind;
  severity: number;
  confidence: 'measured' | 'reported' | 'heuristic';
  simulated: boolean;
  coverage: Coverage;
  /** بهترین برنامهٔ دیگر که این لایه را کامل پوشش می‌دهد. */
  fixedBy?: PlanId;
}

export interface PlanAssessment {
  country: CountryId;
  plan: Plan;
  score: number;
  /** جریمهٔ خام (بدون سقف ۱۰۰) — برای مقایسهٔ دقیق طرح‌هایی که هر دو صفر می‌شوند. */
  penalty: number;
  verdict: Verdict;
  rows: CoverageRow[];
  /** لایه‌هایی که دست‌نخورده مانده‌اند و شدت ۴ یا ۵ دارند. */
  blockers: LayerKind[];
  /** چند توصیهٔ عملی، به‌ترتیب اهمیت. */
  actions: string[];
}

export interface AssessOptions {
  /** آیا دامنهٔ REALITY از فهرست SNI مجاز کشور انتخاب شده؟ */
  sniWhitelisted?: boolean;
  /** آیا سرور پشت CDN است؟ */
  behindCdn?: boolean;
}

const WEIGHT_EXPOSED = 5;
const WEIGHT_PARTIAL = 3;

function isUdpPlan(plan: Plan): boolean {
  return plan.transport === 'udp' || plan.transport === 'quic' || plan.security === 'wg' || plan.security === 'awg';
}

/**
 * لایه‌هایی که دربارهٔ «خودِ پروتکل» نیستند و هر تونل رمزنگاری‌شده‌ای پوشششان
 * می‌دهد (DNS و HTTP داخل تونل می‌روند، پس DPI بیرونی چیزی نمی‌بیند).
 */
const TUNNEL_SIDE_LAYERS: LayerKind[] = ['dns_poison', 'dns_doh_block', 'http_host_inject'];

function resolve(country: CountryId, plan: Plan, layer: LayerKind, opts: AssessOptions): Coverage {
  const list = FILTER_LISTS[country];
  const declared = plan.covers.includes(layer) ? 'covered' : plan.partial.includes(layer) ? 'partial' : 'exposed';

  // این‌ها دربارهٔ تفکیک طرح نیستند: DNS و HTTP هر تونلی داخل خودش می‌رود.
  if (TUNNEL_SIDE_LAYERS.includes(layer)) return 'na';

  if (layer === 'proto_whitelist') {
    // وایت‌لیست پروتکلی: فقط TCPِ شبیه‌TLS/HTTP رد می‌شود، UDP و SSH می‌افتند.
    if (plan.tlsShaped && !isUdpPlan(plan) && plan.protocol !== 'ssh') return 'covered';
    if (isUdpPlan(plan)) return 'exposed';
    return declared === 'covered' ? 'partial' : declared;
  }

  if (layer === 'udp_filter') {
    // فیلتر UDP برای طرحی که UDP نمی‌فرستد بی‌اثر است.
    return isUdpPlan(plan) ? declared : 'covered';
  }

  if (layer === 'quic_sni' || layer === 'quic_v1_fingerprint') {
    // بازرسی QUIC فقط وقتی معنا دارد که طرح اصلاً UDP بفرستد.
    return isUdpPlan(plan) ? declared : 'covered';
  }

  if (layer === 'sni_block' && opts.sniWhitelisted && plan.security === 'reality') return 'covered';

  if (layer === 'sni_whitelist') {
    if (opts.sniWhitelisted && plan.security === 'reality') return 'covered';
    if (plan.transport === 'ws' && opts.behindCdn) return 'partial';
    return declared;
  }

  if (layer === 'ip_block' && opts.behindCdn && (plan.transport === 'ws' || plan.transport === 'xhttp')) {
    return 'covered';
  }

  if (layer === 'ja4_fingerprint') {
    // امارات اثرانگشت ClientHello را با دیتابیس مقایسه می‌کند: پروفایل مرورگر
    // رد می‌شود، پروفایل ناشناس نه. مقایسه روی JA4 است چون JA3 برای کروم
    // ناپایدار است و هر اتصال هش تازه‌ای می‌دهد (اندازه‌گیری‌شده).
    const ja4 = plan.clientFingerprint ? MEASURED_FINGERPRINTS[plan.clientFingerprint]?.ja4 : undefined;
    if (!ja4) return 'partial'; // کلاینت اصلاً ClientHello نمی‌فرستد
    return JA4_ALLOWLIST.includes(ja4) ? 'covered' : 'exposed';
  }

  if (layer === 'active_probe') {
    // فقط طرح‌هایی که در برابر پروب «جواب واقعی» می‌دهند امن‌اند.
    const probeSafe = ['reality-vision', 'reality-vision-frag', 'reality-xhttp', 'ws-tls-cdn', 'ss2022-tls-plugin'];
    if (!probeSafe.includes(plan.id)) return isUdpPlan(plan) ? 'partial' : 'exposed';
  }

  if (layer === 'reassembly') {
    // TSPU هم TCP-segment و هم TLS-record را بازچینش می‌کند؛ فقط ترکیب دو لایه می‌گذرد.
    return plan.id === 'reality-vision-frag' ? 'covered' : plan.id === 'reality-vision' ? 'exposed' : declared;
  }

  return declared;
}

export function verdictOf(score: number): Verdict {
  if (score >= 85) return 'resilient';
  if (score >= 65) return 'usable';
  if (score >= 45) return 'fragile';
  return 'blocked';
}

/** بهترین برنامه‌ای (غیر از خودش) که لایه را کامل می‌پوشاند. */
function bestFixer(country: CountryId, layer: LayerKind, except: PlanId, opts: AssessOptions): PlanId | undefined {
  for (const id of PLAN_ORDER) {
    if (id === except) continue;
    if (resolve(country, PLANS[id], layer, opts) === 'covered') return id;
  }
  return undefined;
}

export function assess(country: CountryId, planId: PlanId, opts: AssessOptions = {}): PlanAssessment {
  const profile = PROFILES[country];
  const plan = PLANS[planId];
  let penalty = 0;
  const rows: CoverageRow[] = [];
  const blockers: LayerKind[] = [];

  for (const l of profile.layers) {
    const coverage = resolve(country, plan, l.id, opts);
    if (coverage === 'exposed' && l.severity >= 4) blockers.push(l.id);
    if (coverage === 'exposed') penalty += l.severity * WEIGHT_EXPOSED;
    else if (coverage === 'partial') penalty += l.severity * WEIGHT_PARTIAL;
    rows.push({
      layer: l.id,
      severity: l.severity,
      confidence: l.confidence,
      simulated: l.simulated,
      coverage,
      fixedBy: coverage === 'exposed' ? bestFixer(country, l.id, planId, opts) : undefined,
    });
  }

  // پورتِ مستقیم‌بسته یا پروتکل مرده: سقف امتیاز.
  const portBlocked = (FILTER_LISTS[country].portsBlocked || []).includes(plan.port);
  if (portBlocked) penalty += 40;

  const score = Math.max(0, 100 - penalty);
  rows.sort((a, b) => b.severity - a.severity || a.layer.localeCompare(b.layer));

  const actions: string[] = [];
  for (const b of blockers.slice(0, 4)) {
    const fix = bestFixer(country, b, planId, opts);
    actions.push(fix ? `world.act.cover:${b}:${fix}` : `world.act.manual:${b}`);
  }
  if (portBlocked) actions.unshift('world.act.port');
  if (rows.some((r) => r.layer === 'sni_whitelist' && r.coverage === 'exposed')) actions.push('world.act.whitelistSni');

  return { country, plan, score, penalty, verdict: verdictOf(score), rows, blockers, actions };
}

export function rank(country: CountryId, opts: AssessOptions = {}): PlanAssessment[] {
  return PLAN_ORDER.map((id) => assess(country, id, opts)).sort(
    (a, b) => b.score - a.score || PLAN_ORDER.indexOf(a.plan.id) - PLAN_ORDER.indexOf(b.plan.id),
  );
}

export function best(country: CountryId, opts: AssessOptions = {}): PlanAssessment {
  return rank(country, opts)[0];
}

/** کلید i18n نام کشور — برای استفاده در UI. */
export function countryLabelKey(country: CountryId): string {
  return countryKey(country);
}

// ── تولید کانفیگ واقعی ─────────────────────────────────────────────────────

export interface PlanParams {
  /** آدرس سرور برای کلاینت (یا آدرس لبه در صورت CDN). */
  server: string;
  port: number;
  uuid: string;
  /** دامنهٔ واقعی که TLS/REALITY با آن ساخته می‌شود. */
  sni: string;
  publicKey?: string;
  privateKey?: string;
  shortId?: string;
  path?: string;
  password?: string;
  /** آدرس مقصد REALITY روی سرور (پیش‌فرض: خودِ sni). */
  dest?: string;
}

export interface Snippet {
  language: 'json' | 'yaml' | 'ini' | 'sh';
  /** کانفیگ سرور و کلاینت، آمادهٔ کپی. */
  text: string;
  /** تنظیمات حیاتی که بدون آن‌ها پوشش لایه‌ها از دست می‌رود. */
  mustHave: string[];
}

/**
 * تکه‌سازی واقعی در Xray ≥25 (اندازه‌گیری‌شده روی 26.3.27):
 *  - کلید قدیمی `streamSettings.fragment` بی‌صدا نادیده گرفته می‌شود؛ باید
 *    `streamSettings.finalmask.tcp[].type = "fragment"` باشد.
 *  - نام فیلدها `length` و `delay` است (نه `lengths`/`delays`: با آن‌ها Xray
 *    با خطای «LengthMin can't be 0» بالا نمی‌آید).
 *  - بدون `delay`، همهٔ رکوردها در یک سگمنت TCP می‌روند (نصفِ راه) و فقط
 *    تکه‌سازی لایهٔ رکورد داریم؛ با `delay` هر رکورد سگمنت جدا می‌شود.
 *    برای قاعدهٔ ECH روسیه «هر دو» لازم است → پس delay الزامی است.
 */
const FINALMASK_FRAGMENT = {
  tcp: [
    {
      type: 'fragment',
      settings: { packets: 'tlshello', length: '100-200', delay: '10-20', maxSplit: '4-8' },
    },
  ],
};

function tlsFingerprint(plan: Plan): Record<string, unknown> {
  const common: Record<string, unknown> = { serverName: 'SNI_HERE', fingerprint: 'chrome' };
  return common;
}

function realityClient(plan: Plan, p: PlanParams): object {
  return {
    protocol: 'vless',
    settings: {
      vnext: [
        {
          address: p.server,
          port: p.port,
          users: [
            {
              id: p.uuid,
              encryption: 'none',
              flow: plan.flow || '',
            },
          ],
        },
      ],
    },
    streamSettings: {
      network: plan.transport === 'xhttp' ? 'xhttp' : 'tcp',
      security: 'reality',
      ...(plan.transport === 'xhttp'
        ? { xhttpSettings: { path: p.path || '/x', mode: 'stream-up', host: p.sni } }
        : {}),
      realitySettings: {
        serverName: p.sni,
        fingerprint: 'chrome',
        publicKey: p.publicKey || 'PBK_HERE',
        shortId: p.shortId || 'SID_HERE',
        spiderX: '',
      },
      ...(plan.id === 'reality-vision-frag' ? { finalmask: FINALMASK_FRAGMENT } : {}),
    },
  };
}

function realityServer(plan: Plan, p: PlanParams): object {
  return {
    inbound: {
      listen: '0.0.0.0',
      port: p.port,
      protocol: 'vless',
      settings: { clients: [{ id: p.uuid, flow: plan.flow || '' }], decryption: 'none' },
      streamSettings: {
        network: plan.transport === 'xhttp' ? 'xhttp' : 'tcp',
        security: 'reality',
        ...(plan.transport === 'xhttp' ? { xhttpSettings: { path: p.path || '/x', mode: 'stream-up' } } : {}),
        realitySettings: {
          show: false,
          dest: p.dest || `${p.sni}:443`,
          xver: 0,
          serverNames: [p.sni],
          privateKey: p.privateKey || 'PRIV_HERE',
          shortIds: [p.shortId || 'SID_HERE'],
        },
      },
    },
  };
}

function wsClient(plan: Plan, p: PlanParams): object {
  const base: Record<string, unknown> = {
    address: p.server,
    port: p.port,
    path: p.path || '/ws',
  };
  if (plan.protocol === 'trojan') {
    return {
      protocol: 'trojan',
      settings: { servers: [{ ...base, password: p.password || 'PASS_HERE' }] },
      streamSettings: {
        network: 'tcp',
        security: 'tls',
        tlsSettings: { serverName: p.sni, fingerprint: 'chrome' },
      },
    };
  }
  if (plan.protocol === 'shadowsocks') {
    return {
      protocol: 'shadowsocks',
      settings: {
        servers: [{ address: p.server, port: p.port, method: '2022-blake3-aes-128-gcm', password: p.password || 'PASS_HERE' }],
      },
      streamSettings: {
        network: 'tcp',
        security: 'tls',
        tlsSettings: { serverName: p.sni, fingerprint: 'chrome' },
        sockopt: { dialerProxy: '', tcpNoDelay: true },
      },
      // در عمل این طرح با پلاگین v2ray-plugin در کلاینت اجرا می‌شود.
    };
  }
  return {
    protocol: 'vless',
    settings: { vnext: [{ address: p.server, port: p.port, users: [{ id: p.uuid, encryption: 'none' }] }] },
    streamSettings: {
      network: 'ws',
      security: plan.security === 'tls' ? 'tls' : 'none',
      wsSettings: { path: p.path || '/ws', headers: { Host: p.sni } },
      ...(plan.security === 'tls' ? { tlsSettings: { serverName: p.sni, fingerprint: 'chrome' } } : {}),
    },
  };
}

export function snippet(planId: PlanId, p: PlanParams): Snippet {
  const plan = PLANS[planId];
  const mustHave: string[] = [];

  if (plan.security === 'reality') {
    mustHave.push('streamSettings.realitySettings.fingerprint = chrome', 'flow = xtls-rprx-vision');
    if (plan.id === 'reality-vision-frag') {
      mustHave.push(
        'finalmask.tcp[0] = {type: fragment, length: 100-200, delay: 10-20} — both the record split and the delay are required',
        'streamSettings.fragment is ignored by Xray >= 25: it must be finalmask',
      );
    }
    if (plan.transport === 'xhttp') mustHave.push('xhttpSettings.mode = stream-up');
    return {
      language: 'json',
      text: JSON.stringify({ server: realityServer(plan, p), client: realityClient(plan, p) }, null, 2),
      mustHave,
    };
  }
  if (plan.protocol === 'hysteria2') {
    mustHave.push('obfs.type = salamander', 'TLS cert with a real domain', 'UDP must survive the path');
    if (plan.id === 'hy2-obfs-unknownver') {
      mustHave.push('first Initial must use an unassigned QUIC version (client-side support required)');
    }
    const yaml = [
      'listen: :443',
      p.password ? `auth:\n  type: password\n  password: ${p.password}` : 'auth:\n  type: password\n  password: PASS_HERE',
      'obfs:\n  type: salamander\n  salamander:\n    password: OBFS_HERE',
      `tls:\n  cert: /etc/ssl/${p.sni}.crt\n  key: /etc/ssl/${p.sni}.key`,
      '# client: server=host:443, tls.sni=' + p.sni + ', obfs=salamander',
      plan.id === 'hy2-obfs-unknownver' ? '# client must send an unversioned first Initial (quic-go integration)' : '',
    ]
      .filter(Boolean)
      .join('\n');
    return { language: 'yaml', text: yaml, mustHave };
  }
  if (plan.security === 'awg') {
    mustHave.push('Jc/Jmin/Jmax junk packets', 'S1/S2 + H1-H4 magic-header randomisation');
    const ini = [
      '[Interface]',
      `PrivateKey = ${p.privateKey || 'PRIV_HERE'}`,
      'Address = 10.66.66.2/32',
      'Jc = 4',
      'Jmin = 40',
      'Jmax = 70',
      'S1 = 30',
      'S2 = 40',
      'H1 = 1234567',
      'H2 = 2345678',
      'H3 = 3456789',
      'H4 = 4567890',
      '[Peer]',
      `Endpoint = ${p.server}:${p.port}`,
      'AllowedIPs = 0.0.0.0/0, ::/0',
    ].join('\n');
    return { language: 'ini', text: ini, mustHave };
  }
  if (plan.protocol === 'wireguard' || plan.protocol === 'openvpn' || plan.protocol === 'ssh') {
    mustHave.push('world.warn.none');
    return {
      language: 'sh',
      text: `# ${plan.label}\n# ${plan.tech}\n# ${plan.tricks.length ? plan.tricks.join(', ') : 'no obfuscation layer'}`,
      mustHave,
    };
  }
  mustHave.push('streamSettings.tlsSettings.fingerprint = chrome');
  return { language: 'json', text: JSON.stringify({ client: wsClient(plan, p) }, null, 2), mustHave };
}

/** آیا کانفیگ این طرح در نسخهٔ فعلی Xray قابل‌اجراست؟ (بقیه متن راهنما می‌گیرند.) */
export function isXrayNative(planId: PlanId): boolean {
  const p = PLANS[planId];
  return ['vless', 'vmess', 'trojan', 'shadowsocks', 'socks5'].includes(p.protocol) && !['udp', 'quic'].includes(p.transport);
}
