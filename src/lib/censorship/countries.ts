/**
 * پروفایل کشورها + فهرست‌های فیلتر.
 *
 * این فایل «دادهٔ حقیقت» است: هم موتور ارزیابی TS از آن می‌خواند، هم شبیه‌سازِ
 * پایتون (از طریق `rules.json` که با تست تولید می‌شود) — پس مدل و آزمون هرگز از
 * هم جدا نمی‌افتند.
 *
 * فهرست دامنه‌ها «نمونه» است نه فهرست کامل: فقط برای این‌که شبیه‌ساز چیزی برای
 * مسدود کردن داشته باشد و تست‌ها معنادار شوند.
 */
import { JA4_ALLOWLIST, JA4_NAMES } from './fingerprints';
import { layer } from './layers';
import type { CountryId, CountryProfile, FilterList, RulesDocument, Source } from './types';

export const SOURCES: Record<string, Source> = {
  'tspu-imc22': {
    label: 'TSPU: Russia’s Decentralized Censorship System (IMC’22)',
    url: 'https://ensa.fi/papers/tspu-imc22.pdf',
    kind: 'paper',
  },
  'foci25': {
    label: 'ECH in Censorship Circumvention (FOCI 2025) — RU drops ECH to Cloudflare',
    url: 'https://www.petsymposium.org/foci/2025/foci-2025-0016.pdf',
    kind: 'paper',
  },
  'n4p-490': {
    label: 'net4people #490 — RU SNI whitelist mode + checkers (hyperion-cs)',
    url: 'https://github.com/net4people/bbs/issues/490',
    kind: 'issue',
  },
  'gfw-fep': {
    label: 'How the GFW Detects and Blocks Fully Encrypted Traffic (USENIX Sec’23)',
    url: 'https://www.usenix.org/system/files/usenixsecurity23-wu-mingshi.pdf',
    kind: 'paper',
  },
  'gfw-ss': {
    label: 'How China Detects and Blocks Shadowsocks (IMC’20) — probes after entropy/length',
    url: 'https://gfw.report/publications/imc20/en/',
    kind: 'paper',
  },
  'gfw-quic': {
    label: 'Exposing and Circumventing SNI-based QUIC Censorship of the GFW (USENIX Sec’25)',
    url: 'https://gfw.report/publications/usenixsecurity25/en/',
    kind: 'paper',
  },
  'gfw-regional': {
    label: 'A Wall Behind A Wall: Emerging Regional Censorship in China (SP’25)',
    url: 'https://gfw.report/publications/sp25/en/',
    kind: 'paper',
  },
  'xray-4113': {
    label: 'XHTTP: Beyond REALITY (Xray-core #4113) — up/down split vs single-connection heuristics',
    url: 'https://github.com/XTLS/Xray-core/discussions/4113',
    kind: 'issue',
  },
  'iran-2507': {
    label: 'Iran’s stealth blackout: four cooperating filter layers (arXiv 2507.14183)',
    url: 'https://arxiv.org/pdf/2507.14183',
    kind: 'paper',
  },
  'iran-2603': {
    label: 'Post-shutdown allowlist persisted; UDP selectively filtered (arXiv 2603.28753)',
    url: 'https://arxiv.org/html/2603.28753v1',
    kind: 'paper',
  },
  'miaan': {
    label: 'Miaan: Iran’s Stealth Blackout Report — protocol whitelisting',
    url: 'https://miaan.org/',
    kind: 'report',
  },
  'fbk-acf': {
    label: 'FBK/ACF “Access Denied” (Mar 2026) — TSPU is in-path & stateful, DC ASNs scored',
    url: 'https://fbk.info/files/acf-internet-report-EN.pdf',
    kind: 'report',
  },
  'raccoon': {
    label: 'RaccoonLine/securityledger 2026 — WG identified, fresh servers blocked within hours',
    url: 'https://securityledger.com/',
    kind: 'report',
  },
  'measured-xray': {
    label: 'Own measurement: Xray 26.3.27 ClientHello fingerprints (testenv/censor/fpmeasure.py)',
    url: 'https://github.com/XTLS/Xray-core',
    kind: 'report',
  },
  'measured-lab': {
    label: 'Own measurement: world-matrix end-to-end lab (testenv/world-matrix.py, testenv/censor/)',
    url: 'https://github.com/XTLS/Xray-core/issues/6724',
    kind: 'report',
  },
  'vpnsmith': {
    label: 'Anti-DPI 2026 — per-country DPI table, AmneziaWG params, ML flow classification',
    url: 'https://www.vpnsmith.com/en/blog/anti-dpi-vpn-bypass-2026',
    kind: 'vendor',
  },
  'fexyn': {
    label: 'VLESS REALITY protocol guide — protocol/blocking matrix per country',
    url: 'https://fexyn.com/blog/vless-reality-protocol-guide',
    kind: 'vendor',
  },
  'bypasscore': {
    label: 'Bypassing YouTube throttling in RU 2026 — TSPU SNI inspection, zapret strategies',
    url: 'https://bypasscore.com/blog/bypass-youtube-blocking-russia-2026',
    kind: 'vendor',
  },
  'tor': {
    label: 'Tor Project — connecting from censored regions (CN/RU/TM/BY guidance)',
    url: 'https://support.torproject.org/tor-browser/circumvention/connecting-from-censored-regions/',
    kind: 'report',
  },
  'geedge': {
    label: 'GFW-derived DPI (Geedge TSG) exported to MM/PK/ET/KZ under Belt & Road',
    url: 'https://corpus.lantern.io/techniques/fully-encrypted-detect/',
    kind: 'report',
  },
};

/** فهرست‌های خام فیلتر — منبع مشترک TS و شبیه‌ساز. */
export const FILTER_LISTS: Record<CountryId, FilterList> = {
  ir: {
    sniBlocked: ['x.com', 'twitter.com', 'instagram.com', 'facebook.com', 'youtube.com', 'telegram.org'],
    portsBlocked: [25],
    asnBlocked: ['digitalocean', 'linode', 'vultr'],
  },
  ru: {
    sniBlocked: ['instagram.com', 'facebook.com', 'x.com', 'signal.org'],
    asnBlocked: ['cloudflare', 'ovh', 'hetzner', 'digitalocean'],
    quic: { versions: ['1'], minPayload: 1001, dports: [443] },
    ech: { triggerSni: ['cloudflare-ech.com', 'cloudflare.com'], needsBothSplits: true },
  },
  cn: {
    sniBlocked: [
      'google.com',
      'youtube.com',
      'facebook.com',
      'x.com',
      'wikipedia.org',
      'telegram.org',
      'whatsapp.com',
      'signal.org',
      'instagram.com',
    ],
    asnBlocked: ['digitalocean', 'linode', 'vultr', 'choopa'],
    fep: {
      printablePrefix: 6,
      asciiFraction: 0.5,
      asciiRun: 6,
      popcountMin: 0.45,
      popcountMax: 0.55,
    },
    quic: { versions: ['1'], minPayload: 1200, dports: [443] },
    tlsInTls: { minFirstRecord: 280, maxFirstRecord: 700, headerMax: 120, defeatedBy: ['reality-vision', 'reality-xhttp'] },
  },
  tm: {
    sniBlocked: ['youtube.com', 'facebook.com', 'instagram.com', 'telegram.org'],
    sniAllowOnly: ['.tm', 'yandex.ru', 'mail.ru', 'vk.com', 'ok.ru'],
    asnBlocked: ['digitalocean', 'hetzner', 'ovh', 'vultr', 'linode', 'amazon', 'google'],
    fep: { printablePrefix: 6, asciiFraction: 0.5, asciiRun: 6, popcountMin: 0.45, popcountMax: 0.55 },
  },
  by: {
    sniBlocked: ['instagram.com', 'facebook.com', 'x.com', 'tiktok.com'],
    asnBlocked: ['ovh', 'hetzner'],
  },
  ae: {
    sniBlocked: ['signal.org', 'discord.com'],
    // فهرست از اندازه‌گیری واقعی ClientHelloهای Xray ساخته شده
    // (testenv/censor/fpmeasure.py → fingerprints.ts). کلید JA4 است نه JA3:
    // کروم ترتیب extension را در هر اتصال عوض می‌کند (۱۵ اتصال → ۱۵ JA3).
    ja4: { ja4Allow: JA4_ALLOWLIST, ja4Names: JA4_NAMES },
    portsBlocked: [],
  },
  kz: {
    sniBlocked: ['facebook.com', 'instagram.com', 'x.com', 'tiktok.com'],
    ech: { triggerSni: ['cloudflare-ech.com', 'cloudflare.com'], needsBothSplits: true },
    asnBlocked: ['hetzner', 'ovh'],
  },
  tr: {
    sniBlocked: ['instagram.com', 'wikipedia.org'],
  },
  pk: {
    sniBlocked: ['x.com', 'tiktok.com', 'wikipedia.org'],
    asnBlocked: ['digitalocean', 'vultr'],
  },
  sa: {
    sniBlocked: ['signal.org', 'discord.com'],
  },
  open: { sniBlocked: [] },
};

/** ویژگی‌های ساختاری که شبیه‌ساز برای قضاوت دربارهٔ اثرانگشت به کار می‌برد. */
export const FINGERPRINTS: RulesDocument['fingerprints'] = {
  wireguardInitLength: 148,
  wireguardMsgType: 1,
  openvpnOpcodes: [0x38, 0x48, 0x50, 0x58],
  quicDecryptable: ['1'],
};

export const ACTIVE_PROBE_MODEL: RulesDocument['activeProbe'] = {
  suspiciousFirstPacketMin: 200,
  entropyThreshold: 7.5,
  probeTypes: ['replay', 'random-12', 'random-1024', 'http-404', 'tls', 'quic', 'ackless'],
};

export const RULES_VERSION = 1;

/** سندِ قواعدی که شبیه‌ساز پایتون مصرف می‌کند (تست، هم‌خوانی‌اش را تضمین می‌کند). */
export function rulesDocument(): RulesDocument {
  const countryLayers = {} as RulesDocument['countryLayers'];
  const countrySystem = {} as RulesDocument['countrySystem'];
  const simulatedLayers = {} as RulesDocument['simulatedLayers'];
  for (const [id, profile] of Object.entries(PROFILES)) {
    countryLayers[id as CountryId] = profile.layers.map((l) => l.id);
    countrySystem[id as CountryId] = { system: profile.system, family: profile.family };
    simulatedLayers[id as CountryId] = profile.layers.filter((l) => l.simulated).map((l) => l.id);
  }
  return {
    version: RULES_VERSION,
    generatedFrom: 'src/lib/censorship/countries.ts',
    lists: FILTER_LISTS,
    fingerprints: FINGERPRINTS,
    activeProbe: ACTIVE_PROBE_MODEL,
    countryLayers,
    countrySystem,
    simulatedLayers,
  };
}

/**
 * پروفایل‌ها. شدت‌ها از منابع بالاست؛ هر جا شاهد ضعیف‌تر بوده، `confidence` را
 * پایین آورده‌ایم تا کاربر بداند کدام ادعا محکم است و کدام نه.
 */
export const PROFILES: Record<CountryId, CountryProfile> = {
  ir: {
    id: 'ir',
    family: 'gfi',
    system: 'NGFW / «سپهر»',
    notes: ['whitelist-mode', 'dc-asn', 'udp-risk'],
    layers: [
      layer('dns_poison', { evidence: 'iran-2507' }),
      layer('http_host_inject', { severity: 3, evidence: 'iran-2507' }),
      layer('sni_block', { severity: 4, evidence: 'iran-2507' }),
      layer('proto_whitelist', { evidence: 'miaan' }),
      layer('active_probe', { severity: 3, evidence: 'raccoon' }),
      layer('proto_fingerprint', { severity: 4, evidence: 'raccoon' }),
      layer('udp_filter', { severity: 4, evidence: 'iran-2603' }),
      layer('ip_block', { severity: 3, evidence: 'iran-2507' }),
    ],
  },
  ru: {
    id: 'ru',
    family: 'tspu',
    system: 'TSPU / RKN',
    notes: ['reassembly-pair', 'dc-asn', 'whitelist-mode'],
    layers: [
      layer('sni_block', { evidence: 'bypasscore' }),
      layer('ech_drop', { severity: 3, confidence: 'measured', evidence: 'foci25' }),
      layer('reassembly', { evidence: 'foci25' }),
      layer('quic_v1_fingerprint', { evidence: 'tspu-imc22' }),
      layer('udp_filter', { severity: 3, evidence: 'foci25' }),
      layer('proto_fingerprint', { evidence: 'raccoon' }),
      layer('ip_block', { evidence: 'fbk-acf' }),
      layer('sni_whitelist', { severity: 4, confidence: 'reported', evidence: 'n4p-490' }),
      layer('ml_flow', { severity: 3, confidence: 'reported', evidence: 'vpnsmith' }),
    ],
  },
  cn: {
    id: 'cn',
    family: 'gfi',
    system: 'GFW',
    notes: ['fep-five-rules', 'dc-asn', 'udp-risk'],
    layers: [
      layer('dns_poison', { evidence: 'gfw-regional' }),
      layer('dns_doh_block', { severity: 3, confidence: 'reported', evidence: 'vpnsmith' }),
      layer('sni_block', { evidence: 'gfw-regional' }),
      layer('proto_fingerprint', { evidence: 'fexyn' }),
      layer('fep_detect', { evidence: 'gfw-fep' }),
      layer('active_probe', { evidence: 'gfw-ss' }),
      layer('tls_in_tls', { severity: 4, confidence: 'heuristic', evidence: 'xray-4113' }),
      layer('quic_sni', { evidence: 'gfw-quic' }),
      layer('udp_filter', { severity: 3, evidence: 'gfw-quic' }),
      layer('ip_block', { evidence: 'vpnsmith' }),
      layer('ml_flow', { confidence: 'reported', evidence: 'vpnsmith' }),
    ],
  },
  tm: {
    id: 'tm',
    family: 'whitelist',
    system: 'وایت‌لیست کامل',
    notes: ['whitelist-mode', 'domain-fronting', 'dc-asn'],
    layers: [
      layer('proto_whitelist', { evidence: 'vpnsmith' }),
      layer('sni_whitelist', { severity: 4, confidence: 'reported', evidence: 'tor' }),
      layer('fep_detect', { confidence: 'reported', evidence: 'vpnsmith' }),
      layer('ip_block', { evidence: 'vpnsmith' }),
      layer('active_probe', { severity: 4, confidence: 'reported', evidence: 'raccoon' }),
    ],
  },
  by: {
    id: 'by',
    family: 'tspu',
    system: 'Belpak / مدل روسی',
    notes: ['legacy-tspu', 'udp-risk'],
    layers: [
      layer('sni_block', { severity: 4, confidence: 'reported', evidence: 'vpnsmith' }),
      layer('proto_fingerprint', { severity: 4, confidence: 'reported', evidence: 'vpnsmith' }),
      layer('ip_block', { severity: 3, confidence: 'reported', evidence: 'tor' }),
      layer('udp_filter', { severity: 2, confidence: 'reported', evidence: 'vpnsmith' }),
    ],
  },
  ae: {
    id: 'ae',
    family: 'ja4',
    system: 'Etisalat / du DPI',
    notes: ['ja4-browser-like', 'voip-blocks'],
    layers: [
      layer('ja4_fingerprint', { confidence: 'measured', evidence: 'measured-xray' }),
      layer('proto_fingerprint', { severity: 4, confidence: 'reported', evidence: 'vpnsmith' }),
      layer('sni_block', { severity: 3, confidence: 'reported', evidence: 'vpnsmith' }),
      layer('udp_filter', { severity: 3, confidence: 'reported', evidence: 'vpnsmith' }),
      layer('ip_block', { severity: 2, confidence: 'reported', evidence: 'vpnsmith' }),
    ],
  },
  kz: {
    id: 'kz',
    family: 'tspu',
    system: 'KZ DPI (نسخهٔ صادرشدهٔ GFW/TSPU)',
    notes: ['exported-stack', 'reassembly-pair'],
    layers: [
      layer('sni_block', { severity: 4, confidence: 'reported', evidence: 'geedge' }),
      layer('ech_drop', { confidence: 'reported', evidence: 'foci25' }),
      layer('ip_block', { severity: 3, confidence: 'reported', evidence: 'geedge' }),
      layer('udp_filter', { severity: 2, confidence: 'reported', evidence: 'geedge' }),
    ],
  },
  tr: {
    id: 'tr',
    family: 'ja4',
    system: 'BTK',
    notes: ['incident-only'],
    layers: [
      layer('sni_block', { severity: 3, confidence: 'reported', evidence: 'fexyn' }),
      layer('proto_fingerprint', { severity: 3, confidence: 'reported', evidence: 'fexyn' }),
      layer('udp_filter', { severity: 2, confidence: 'reported', evidence: 'fexyn' }),
    ],
  },
  pk: {
    id: 'pk',
    family: 'ja4',
    system: 'PTA',
    notes: ['exported-stack'],
    layers: [
      layer('sni_block', { severity: 4, confidence: 'reported', evidence: 'fexyn' }),
      layer('proto_fingerprint', { confidence: 'reported', evidence: 'fexyn' }),
      layer('ip_block', { severity: 3, confidence: 'reported', evidence: 'geedge' }),
      layer('udp_filter', { severity: 3, confidence: 'reported', evidence: 'geedge' }),
    ],
  },
  sa: {
    id: 'sa',
    family: 'ja4',
    system: 'CITC',
    notes: ['voip-blocks', 'incident-only'],
    layers: [
      layer('proto_fingerprint', { severity: 3, confidence: 'reported', evidence: 'fexyn' }),
      layer('sni_block', { severity: 3, confidence: 'reported', evidence: 'fexyn' }),
      layer('udp_filter', { severity: 3, confidence: 'reported', evidence: 'fexyn' }),
    ],
  },
  open: {
    id: 'open',
    family: 'open',
    system: 'بدون فیلتر سازمانی',
    notes: [],
    layers: [],
  },
};

export const COUNTRY_ORDER: CountryId[] = ['ir', 'ru', 'cn', 'tm', 'by', 'ae', 'kz', 'tr', 'pk', 'sa', 'open'];

export function countryKey(id: CountryId): string {
  return `world.country.${id}`;
}
