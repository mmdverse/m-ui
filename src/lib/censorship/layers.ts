/**
 * فرادادهٔ لایه‌ها: معنای هر سازوکار، شدت پیش‌فرض و اینکه شبیه‌ساز آن را
 * واقعاً اجرا می‌کند یا نه. متنِ نمایشی از i18n می‌آید (`world.layer.<id>`).
 */
import type { Layer, LayerKind } from './types';

export interface LayerMeta {
  id: LayerKind;
  /** پیش‌فرض شدت (هر کشور می‌تواند بازنویسی کند). */
  severity: Layer['severity'];
  /** شبیه‌ساز پایتون این لایه را واقعاً تصمیم می‌گیرد؟ */
  simulated: boolean;
  /** زیرساخت مشترک با کدام کشورها. */
  families: string[];
}

export const LAYER_META: Record<LayerKind, LayerMeta> = {
  dns_poison: { id: 'dns_poison', severity: 4, simulated: false, families: ['gfi', 'tspu'] },
  dns_doh_block: { id: 'dns_doh_block', severity: 3, simulated: false, families: ['gfi'] },
  http_host_inject: { id: 'http_host_inject', severity: 4, simulated: false, families: ['gfi'] },
  sni_block: { id: 'sni_block', severity: 5, simulated: true, families: ['gfi', 'tspu', 'ja4'] },
  sni_whitelist: { id: 'sni_whitelist', severity: 5, simulated: true, families: ['whitelist', 'tspu'] },
  ech_drop: { id: 'ech_drop', severity: 3, simulated: true, families: ['tspu'] },
  reassembly: { id: 'reassembly', severity: 4, simulated: true, families: ['tspu'] },
  proto_whitelist: { id: 'proto_whitelist', severity: 5, simulated: false, families: ['whitelist', 'gfi'] },
  proto_fingerprint: { id: 'proto_fingerprint', severity: 5, simulated: true, families: ['tspu', 'gfi', 'ja4'] },
  fep_detect: { id: 'fep_detect', severity: 5, simulated: true, families: ['gfi', 'whitelist'] },
  active_probe: { id: 'active_probe', severity: 5, simulated: false, families: ['gfi', 'tspu'] },
  // عمداً شبیه‌سازی *نمی‌شود*: در آزمایشگاه، XTLS/Vision با padding خودش
  // همان رکوردهای ~۱۲۰۰ بایتیِ یک ClientHello درونی را تولید می‌کند (اندازه‌گیری
  // `testenv/censor/fingerprints-measured.json` و لاگ world-matrix)، پس هر
  // قاعدهٔ «پنجرهٔ اندازه» هم ترافیک عادی را می‌بندد و هم قابل اعتبارسنجی نیست.
  // تشخیص واقعی آماری/زمانی است؛ ما فقط *گزارش* می‌کنیم، شبیه‌سازی نه.
  tls_in_tls: { id: 'tls_in_tls', severity: 4, simulated: false, families: ['gfi'] },
  quic_sni: { id: 'quic_sni', severity: 4, simulated: true, families: ['gfi'] },
  quic_v1_fingerprint: { id: 'quic_v1_fingerprint', severity: 4, simulated: true, families: ['tspu'] },
  udp_filter: { id: 'udp_filter', severity: 3, simulated: false, families: ['gfi', 'tspu', 'whitelist'] },
  ip_block: { id: 'ip_block', severity: 4, simulated: false, families: ['gfi', 'tspu', 'ja4', 'whitelist'] },
  ja4_fingerprint: { id: 'ja4_fingerprint', severity: 4, simulated: true, families: ['ja4'] },
  ml_flow: { id: 'ml_flow', severity: 4, simulated: false, families: ['gfi', 'tspu'] },
};

export function layer(id: LayerKind, override?: Partial<Layer>): Layer {
  const meta = LAYER_META[id];
  return {
    id,
    severity: meta.severity,
    confidence: 'measured',
    evidence: '',
    simulated: meta.simulated,
    ...override,
  };
}

/** برچسب ترجمه‌شدهٔ یک لایه. */
export function layerKey(id: LayerKind): string {
  return `world.layer.${id}`;
}
