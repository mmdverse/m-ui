/**
 * کاتالوگِ «برنامه‌های عبور» — هر برنامه یک ترکیب مشخص از پروتکل/انتقال/ترفند
 * است، با این اطلاعات: کدام لایه‌ها را پوشش می‌دهد، کدام‌ها را نیمه‌کاره، و
 * کدام‌ها را دست‌نخورده باقی می‌گذارد.
 *
 * پوشش‌ها ادعای تبلیغاتی نیستند: هر پوشش باید در `testenv/world-matrix.py`
 * یا تست‌های شبیه‌ساز شاهد داشته باشد (ستون `simulated` لایه‌ها).
 */
import type { LayerKind, PlanId } from './types';

export interface Plan {
  id: PlanId;
  /** نام روی وایر (نام‌های فنی ترجمه نمی‌شوند). */
  label: string;
  protocol: string;
  transport: string;
  security: string;
  flow?: string;
  port: number;
  /** ترفندهایی که در کانفیگ واقعی اعمال می‌شود. */
  tricks: string[];
  covers: LayerKind[];
  partial: LayerKind[];
  /** آیا همهٔ ترافیک روی TLS استاندارد است (برای معافیت FEP). */
  tlsShaped: boolean;
  /**
   * مقدار `tlsSettings.fingerprint` که کلاینت واقعی می‌فرستد؛ همان کلید
   * `MEASURED_FINGERPRINTS` است. جاهایی که کلاینت اصلاً ClientHello نمی‌فرستد
   * (WireGuard/SSH/UDP) تعریف نشده.
   */
  clientFingerprint?: string;
  /** توضیح یک‌خطی برای UI (انگلیسی، فنی). */
  tech: string;
}

const T = (l: LayerKind[]) => l;

export const PLANS: Record<PlanId, Plan> = {
  'reality-vision': {
    id: 'reality-vision',
    label: 'VLESS + REALITY + Vision',
    protocol: 'vless',
    transport: 'tcp',
    security: 'reality',
    flow: 'xtls-rprx-vision',
    port: 443,
    tricks: ['uTLS chrome fingerprint', 'borrowed real certificate', 'Vision padding'],
    covers: T(['sni_block', 'active_probe', 'ja4_fingerprint', 'tls_in_tls', 'fep_detect', 'proto_fingerprint']),
    partial: T(['ml_flow', 'ip_block', 'sni_whitelist', 'reassembly']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'Handshake is a real TLS handshake to a real site; Vision removes the nested-TLS length pattern.',
  },
  'reality-vision-frag': {
    id: 'reality-vision-frag',
    label: 'VLESS + REALITY + Vision + fragment',
    protocol: 'vless',
    transport: 'tcp',
    security: 'reality',
    flow: 'xtls-rprx-vision',
    port: 443,
    tricks: ['finalmask tlshello (TLS-record split + delay → separate TCP segments)', 'uTLS chrome fingerprint', 'Vision padding'],
    covers: T([
      'sni_block',
      'active_probe',
      'ja4_fingerprint',
      'tls_in_tls',
      'fep_detect',
      'proto_fingerprint',
      'ech_drop',
      'reassembly',
    ]),
    partial: T(['ml_flow', 'ip_block', 'sni_whitelist']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'FinalMask fragmentation splits the ClientHello into 100–200 byte TLS records spaced by 10–20 ms: record split + TCP split, the pair TSPU cannot reassemble.',
  },
  'reality-xhttp': {
    id: 'reality-xhttp',
    label: 'VLESS + XHTTP (stream-up) + REALITY',
    protocol: 'vless',
    transport: 'xhttp',
    security: 'reality',
    port: 443,
    tricks: ['up/down split across flows', 'HTTP/2-shaped framing', 'POST body streaming'],
    covers: T(['sni_block', 'active_probe', 'ja4_fingerprint', 'tls_in_tls', 'fep_detect', 'ml_flow', 'proto_fingerprint']),
    partial: T(['ip_block', 'udp_filter', 'sni_whitelist', 'quic_sni']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'Upload and download live in different flows, so single-connection TLS-in-TLS heuristics lose their grip.',
  },
  'ws-tls-cdn': {
    id: 'ws-tls-cdn',
    label: 'VLESS + WebSocket + TLS (behind CDN)',
    protocol: 'vless',
    transport: 'ws',
    security: 'tls',
    port: 443,
    tricks: ['CDN IP in front', 'real cert', 'host/path camouflage', 'HTTP/1.1 upgrade'],
    covers: T(['fep_detect', 'active_probe', 'ip_block', 'sni_block']),
    partial: T(['ml_flow', 'tls_in_tls', 'ja4_fingerprint', 'proto_whitelist']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'Traffic terminates at a CDN edge with a legitimate certificate; your origin IP never appears.',
  },
  'trojan-tls': {
    id: 'trojan-tls',
    label: 'Trojan + TLS',
    protocol: 'trojan',
    transport: 'tcp',
    security: 'tls',
    port: 443,
    tricks: ['real cert', 'password auth inside TLS'],
    covers: T(['fep_detect', 'proto_fingerprint', 'ja4_fingerprint']),
    partial: T(['tls_in_tls', 'sni_block', 'ml_flow', 'ip_block']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'Plain HTTPS-looking stream, but a probe gets a certificate/response that no real site would give.',
  },
  'ss2022-tls-plugin': {
    id: 'ss2022-tls-plugin',
    label: 'Shadowsocks-2022 + v2ray-plugin (WS+TLS)',
    protocol: 'shadowsocks',
    transport: 'ws',
    security: 'tls',
    port: 443,
    tricks: ['AEAD inside a TLS-wrapped WS tunnel', 'plugin handshake looks like HTTP upgrade'],
    covers: T(['fep_detect', 'proto_fingerprint', 'active_probe', 'ja4_fingerprint']),
    partial: T(['tls_in_tls', 'sni_block', 'ip_block', 'ml_flow']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'Naked SS-2022 is pure entropy from byte zero; the TLS plugin is what keeps it out of the FEP net.',
  },
  'vmess-ws-tls': {
    id: 'vmess-ws-tls',
    label: 'VMess + WebSocket + TLS',
    protocol: 'vmess',
    transport: 'ws',
    security: 'tls',
    port: 443,
    tricks: ['legacy protocol', 'WS upgrade'],
    covers: T(['fep_detect', 'ip_block']),
    partial: T(['active_probe', 'ml_flow', 'ja4_fingerprint', 'tls_in_tls']),
    tlsShaped: true,
    clientFingerprint: 'chrome',
    tech: 'Works, but VMess’s probe response and traffic shape are old news to modern filters.',
  },
  amneziawg: {
    id: 'amneziawg',
    label: 'AmneziaWG',
    protocol: 'wireguard',
    transport: 'udp',
    security: 'awg',
    port: 51820,
    tricks: ['Jc/Jmin/Jmax junk packets', 'S1/S2 + H1–H4 magic-header randomisation'],
    covers: T(['proto_fingerprint', 'ja4_fingerprint', 'fep_detect']),
    partial: T(['udp_filter', 'ip_block', 'ml_flow']),
    tlsShaped: false,
    tech: 'WireGuard with the fixed 148-byte initiation broken up and the message types hidden.',
  },
  wireguard: {
    id: 'wireguard',
    label: 'WireGuard (plain)',
    protocol: 'wireguard',
    transport: 'udp',
    security: 'wg',
    port: 51820,
    tricks: [],
    covers: T([]),
    partial: T(['ja4_fingerprint']),
    tlsShaped: false,
    tech: 'A 148-byte initiation with message type 1 — the single easiest VPN signature to match.',
  },
  'openvpn-tcp': {
    id: 'openvpn-tcp',
    label: 'OpenVPN (TCP/443)',
    protocol: 'openvpn',
    transport: 'tcp',
    security: 'none',
    port: 443,
    tricks: ['TCP mode to look like a web port'],
    covers: T([]),
    partial: T(['ip_block']),
    tlsShaped: false,
    tech: 'Port 443 does not help: the handshake opcodes are inspected, not the port number.',
  },
  'hy2-obfs': {
    id: 'hy2-obfs',
    label: 'Hysteria2 + obfs (salamander)',
    protocol: 'hysteria2',
    transport: 'quic',
    security: 'tls',
    port: 443,
    tricks: ['obfs password', 'QUIC version 1', 'UDP-only'],
    covers: T(['fep_detect', 'proto_fingerprint']),
    partial: T(['sni_block', 'ml_flow', 'ip_block']),
    tlsShaped: false,
    tech: 'Fast on lossy links, but QUIC v1 Initials over 1000 bytes are exactly what TSPU drops.',
  },
  'hy2-obfs-unknownver': {
    id: 'hy2-obfs-unknownver',
    label: 'Hysteria2 + obfs + unknown-version Initial',
    protocol: 'hysteria2',
    transport: 'quic',
    security: 'tls',
    port: 443,
    tricks: ['first Initial uses an unsupported QUIC version', 'obfs padding'],
    covers: T(['fep_detect', 'proto_fingerprint', 'quic_v1_fingerprint', 'quic_sni']),
    partial: T(['udp_filter', 'ml_flow', 'ip_block', 'sni_block']),
    tlsShaped: false,
    tech: 'An unversioned first Initial is undecryptable, so version-based rules and SNI parsing both miss.',
  },
  'ssh-tunnel': {
    id: 'ssh-tunnel',
    label: 'SSH tunnel (-R / -L over 443)',
    protocol: 'ssh',
    transport: 'tcp',
    security: 'none',
    port: 443,
    tricks: ['port fallback'],
    covers: T(['fep_detect']),
    partial: T(['ip_block']),
    tlsShaped: false,
    tech: 'The banner gives it away instantly, and whitelist filters drop SSH regardless of port.',
  },
  'ss2022-plain': {
    id: 'ss2022-plain',
    label: 'Shadowsocks-2022 (no plugin)',
    protocol: 'shadowsocks',
    transport: 'tcp',
    security: 'none',
    port: 8388,
    tricks: [],
    covers: T([]),
    partial: T(['ja4_fingerprint']),
    tlsShaped: false,
    tech: 'Every byte is random: it fails the FEP exemption list by construction.',
  },
  'vmess-tcp-plain': {
    id: 'vmess-tcp-plain',
    label: 'VMess + TCP (no TLS)',
    protocol: 'vmess',
    transport: 'tcp',
    security: 'none',
    port: 8080,
    tricks: [],
    covers: T([]),
    partial: T([]),
    tlsShaped: false,
    tech: 'Fully encrypted from the first payload with no protocol fingerprint to hide behind.',
  },
};

export const PLAN_ORDER: PlanId[] = [
  'reality-vision-frag',
  'reality-vision',
  'reality-xhttp',
  'ws-tls-cdn',
  'ss2022-tls-plugin',
  'trojan-tls',
  'hy2-obfs-unknownver',
  'amneziawg',
  'vmess-ws-tls',
  'hy2-obfs',
  'ssh-tunnel',
  'wireguard',
  'openvpn-tcp',
  'ss2022-plain',
  'vmess-tcp-plain',
];

/** برنامه‌هایی که در فهرست «از اینها پرهیز کن» نمایش داده می‌شوند. */
export const DEPRECATED_PLANS: PlanId[] = ['wireguard', 'openvpn-tcp', 'ss2022-plain', 'vmess-tcp-plain', 'ssh-tunnel'];

export function planKey(id: PlanId): string {
  return `world.plan.${id}`;
}
