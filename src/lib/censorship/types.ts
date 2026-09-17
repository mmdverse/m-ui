/**
 * مدل چندکشوریِ فیلترینگ — لایه‌های سانسور، پروفایل کشورها و برنامه‌های عبور.
 *
 * هر چیزی که در این پوشه هست از رفتارِ *اندازه‌گیری‌شدهٔ* فیلترها آمده، نه از
 * شنیده‌ها. هر لایه یک برچسب `confidence` دارد و یک ارجاع `evidence` که به
 * `SOURCES` اشاره می‌کند؛ اگر چیزی حدس است، صریح «heuristic» علامت خورده.
 */

export type Verdict = 'resilient' | 'usable' | 'fragile' | 'blocked';

/** چقدر به این لایه اطمینان داریم. */
export type Confidence = 'measured' | 'reported' | 'heuristic';

/** خانوادهٔ فیلتر: معماری‌های شناخته‌شدهٔ سانسور. */
export type Family = 'gfi' | 'tspu' | 'whitelist' | 'ja4' | 'open';

/** شناسهٔ لایه‌های سانسور — هر کدام یک سازوکار مستقل. */
export type LayerKind =
  | 'dns_poison'
  | 'dns_doh_block'
  | 'http_host_inject'
  | 'sni_block'
  | 'sni_whitelist'
  | 'ech_drop'
  | 'reassembly'
  | 'proto_whitelist'
  | 'proto_fingerprint'
  | 'fep_detect'
  | 'active_probe'
  | 'tls_in_tls'
  | 'quic_sni'
  | 'quic_v1_fingerprint'
  | 'udp_filter'
  | 'ip_block'
  | 'ja4_fingerprint'
  | 'ml_flow';

/** شناسهٔ کشور/منطقهٔ هدف. */
export type CountryId = 'ir' | 'ru' | 'cn' | 'tm' | 'by' | 'ae' | 'kz' | 'tr' | 'pk' | 'sa' | 'open';

/** شناسهٔ برنامهٔ عبور (پروتکل + انتقال + ترفندها). */
export type PlanId =
  | 'reality-vision'
  | 'reality-vision-frag'
  | 'reality-xhttp'
  | 'ws-tls-cdn'
  | 'trojan-tls'
  | 'ss2022-tls-plugin'
  | 'vmess-ws-tls'
  | 'amneziawg'
  | 'wireguard'
  | 'openvpn-tcp'
  | 'hy2-obfs'
  | 'hy2-obfs-unknownver'
  | 'ssh-tunnel'
  | 'ss2022-plain'
  | 'vmess-tcp-plain';

export interface Layer {
  id: LayerKind;
  /** ۱ = آزاردهنده، ۵ = کشنده در صورت بی‌توجهی. */
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: Confidence;
  /** ارجاع به `SOURCES` در countries.ts. */
  evidence: string;
  /** آیا شبیه‌سازِ ما این لایه را واقعاً اجرا می‌کند یا فقط مدل شده؟ */
  simulated: boolean;
}

export interface CountryProfile {
  id: CountryId;
  family: Family;
  /** نام سیستم فیلتر (TSPU، GFW، ...) برای نمایش. */
  system: string;
  layers: Layer[];
  /** چند برداشتِ کلیدی که در UI به‌عنوان نکته نشان داده می‌شود (کلید i18n). */
  notes: string[];
}

/** داده‌های خامِ فیلتر که هم مدل TS و هم شبیه‌سازِ پایتون از آن تغذیه می‌کنند. */
export interface FilterList {
  /** نمونه‌ای از دامنه‌هایی که با SNI مسدود می‌شوند. */
  sniBlocked: string[];
  /** اگر پر باشد: فقط همین SNI ها مجازند (حالت وایت‌لیست). */
  sniAllowOnly?: string[];
  /** پورت‌هایی که مستقیماً بسته‌اند. */
  portsBlocked?: number[];
  /** بازه/دامنه‌های آی‌پی که reputation شان بد است. */
  asnBlocked?: string[];
  quic?: {
    /** فقط این نسخه‌های QUIC بازرسی می‌شوند. */
    versions: string[];
    /** حداقل اندازهٔ payload برای تریگر (بایت). */
    minPayload: number;
    dports: number[];
  };
  ech?: {
    /** ECH فقط وقتی همراه این SNI ها باشد کشنده است. */
    triggerSni: string[];
    /** آیا فقط با ترکیب دو لایهٔ تکه‌سازی می‌شود عبور کرد؟ */
    needsBothSplits: boolean;
  };
  fep?: {
    /** اگر ۶ بایت اول printable باشند، معاف است. */
    printablePrefix: number;
    /** نسبت ASCII چاپی. */
    asciiFraction: number;
    /** بیشترین رشتهٔ پیوستهٔ ASCII چاپی. */
    asciiRun: number;
    /** نسبت بیت‌های یک (popcount/len) — تست زبرِ آنتروپی. */
    popcountMin: number;
    popcountMax: number;
  };
  /**
   * امارات: تصمیم لایهٔ اثرانگشت.
   *  - `ja4Allow` فهرست JA4های اندازه‌گیری‌شده است (`testenv/censor/fpmeasure.py`).
   *  - `ja4Names` نگاشت JA4 → نام پروفایل برای UI و لاگ.
   *  - `browserLikeOnly` فالبکِ ساختاری است، برای وقتی دیتابیس در دسترس نیست.
   */
  ja4?: { ja4Allow?: string[]; ja4Names?: Record<string, string>; browserLikeOnly?: boolean };
  tlsInTls?: { minFirstRecord: number; maxFirstRecord: number; headerMax: number; defeatedBy: PlanId[] };
}

export interface RulesDocument {
  version: number;
  generatedFrom: string;
  lists: Record<CountryId, FilterList>;
  /** لایه‌های هر کشور — شبیه‌ساز فقط همین‌ها را اجرا می‌کند تا مدل و آزمون جدا نشوند. */
  countryLayers: Record<CountryId, LayerKind[]>;
  countrySystem: Record<CountryId, { system: string; family: Family }>;
  /** لایه‌هایی که شبیه‌ساز باید واقعاً بتواند مسدود کند (نگهبانِ واگرایی). */
  simulatedLayers: Record<CountryId, LayerKind[]>;
  fingerprints: {
    /** اولین بستهٔ WireGuard: نوع ۱ و طول ثابت. */
    wireguardInitLength: number;
    wireguardMsgType: number;
    openvpnOpcodes: number[];
    /** شمارهٔ نسخه‌های QUIC که شبیه‌ساز می‌تواند رمزگشایی کند. */
    quicDecryptable: string[];
  };
  /** حدس‌های آماریِ GFW برای ترافیک کاملاً رمزنگاری‌شده. */
  activeProbe: { suspiciousFirstPacketMin: number; entropyThreshold: number; probeTypes: string[] };
}

export interface Source {
  /** عنوان منبع (انگلیسی، همان‌طور که منتشر شده). */
  label: string;
  url: string;
  kind: 'paper' | 'report' | 'issue' | 'vendor';
}
