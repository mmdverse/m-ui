// این فایل تولید شده است — دست نزن.
// منبع: testenv/censor/fpmeasure.py  (اندازه‌گیری واقعی ClientHelloهای Xray 26.3.27)
// بازتولید: python3 testenv/censor/fpmeasure.py --cert <cert> --write-ts
//
// نکتهٔ مهم: JA3 برای uTLS/chrome در هر اتصال عوض می‌شود (کروم ترتیب extension را
// تصادفی می‌کند) — ۱۵ اتصال، ۱۵ JA3. پس مبنای تصمیم JA4 است که پایدار است.


export type MeasuredFingerprint = {
  name: string;
  ja4: string;
  ja4Variants: number;
  ja3: string;
  ja3Variants: number;
  grease: boolean;
  alpn: string[];
  extensions: number;
  sigAlgs: number;
  browser: boolean;
};

/** اثرانگشت‌های اندازه‌گیری‌شده (کلید = مقدار `tlsSettings.fingerprint`). */
export const MEASURED_FINGERPRINTS: Record<string, MeasuredFingerprint> = {
  "default": { name: "default", ja4: "t13d1516h2_8daaf6152771_8ee26baaef31", ja4Variants: 1, ja3: "6797ce6db45eeb7bcb760b3ce4651f52", ja3Variants: 3, grease: true, alpn: ["h2", "http/1.1"], extensions: 18, sigAlgs: 8, browser: true },
  "chrome": { name: "chrome", ja4: "t13d1516h2_8daaf6152771_8ee26baaef31", ja4Variants: 1, ja3: "d1d680ad6880f2a3700340b121b4c4b0", ja3Variants: 3, grease: true, alpn: ["h2", "http/1.1"], extensions: 18, sigAlgs: 8, browser: true },
  "firefox": { name: "firefox", ja4: "t13d1715h2_5b57614c22b0_a06ecb99ca30", ja4Variants: 1, ja3: "7704a11cf87dfcf33080b90ce11d5527", ja3Variants: 1, grease: false, alpn: ["h2", "http/1.1"], extensions: 15, sigAlgs: 11, browser: true },
  "safari": { name: "safari", ja4: "t13d2013h2_a09f3c656075_2ee3dc641d29", ja4Variants: 1, ja3: "ecdf4f49dd59effc439639da29186671", ja3Variants: 1, grease: true, alpn: ["h2", "http/1.1"], extensions: 15, sigAlgs: 10, browser: true },
  "ios": { name: "ios", ja4: "t13d2613h2_2802a3db6c62_a7cb7461f8a0", ja4Variants: 1, ja3: "656b9a2f4de6ed4909e157482860ab3d", ja3Variants: 1, grease: true, alpn: ["h2", "http/1.1"], extensions: 15, sigAlgs: 11, browser: true },
  "android": { name: "android", ja4: "t12d120700_d34a8e72043a_ba336a2cc70c", ja4Variants: 1, ja3: "6c0f0a346dcd84cb4b97a0d9382c53fd", ja3Variants: 1, grease: false, alpn: [], extensions: 7, sigAlgs: 9, browser: true },
  "edge": { name: "edge", ja4: "t13d1515h2_8daaf6152771_d2a542b11920", ja4Variants: 1, ja3: "b32309a26951912be7dba376398abc3b", ja3Variants: 1, grease: true, alpn: ["h2", "http/1.1"], extensions: 17, sigAlgs: 8, browser: true },
  "360": { name: "360", ja4: "t12d2010s2_0bf03fa604e3_b8ffd2d1c0e3", ja4Variants: 1, ja3: "c405bbbe31c0e53ac4c8448355b2af5b", ja3Variants: 1, grease: false, alpn: ["spdy/2", "spdy/3", "spdy/3.1", "http/1.1"], extensions: 10, sigAlgs: 8, browser: false },
  "qq": { name: "qq", ja4: "t13d1516h2_8daaf6152771_300703f211b6", ja4Variants: 1, ja3: "cd08e31494f9531f560d64c695473da9", ja3Variants: 1, grease: true, alpn: ["h2", "http/1.1"], extensions: 18, sigAlgs: 8, browser: false },
  "random": { name: "random", ja4: "t13d1515h2_8daaf6152771_d2a542b11920", ja4Variants: 3, ja3: "b32309a26951912be7dba376398abc3b", ja3Variants: 3, grease: true, alpn: ["h2", "http/1.1"], extensions: 17, sigAlgs: 8, browser: false },
  "randomized": { name: "randomized", ja4: "t13d1710h2_6fb5bf16457f_c9d69dff1e9a", ja4Variants: 3, ja3: "38efeddef86b31e1f45946b26fd08b95", ja3Variants: 3, grease: false, alpn: ["h2", "http/1.1"], extensions: 10, sigAlgs: 10, browser: false },
};

/** JA4هایی که مدل «مرورگر» می‌داند — کلید تصمیم لایهٔ امارات. */
export const JA4_ALLOWLIST: string[] = [
  "t13d1516h2_8daaf6152771_8ee26baaef31", // default
  "t13d1516h2_8daaf6152771_8ee26baaef31", // chrome
  "t13d1715h2_5b57614c22b0_a06ecb99ca30", // firefox
  "t13d2013h2_a09f3c656075_2ee3dc641d29", // safari
  "t13d2613h2_2802a3db6c62_a7cb7461f8a0", // ios
  "t12d120700_d34a8e72043a_ba336a2cc70c", // android
  "t13d1515h2_8daaf6152771_d2a542b11920", // edge
];

/** JA4 → نام کلاینت، برای UI و لاگ شبیه‌ساز. اولویت با پروفایلِ مرورگر است. */
export const JA4_NAMES: Record<string, string> = {
  "t13d1516h2_8daaf6152771_8ee26baaef31": "chrome",
  "t13d1715h2_5b57614c22b0_a06ecb99ca30": "firefox",
  "t13d2013h2_a09f3c656075_2ee3dc641d29": "safari",
  "t13d1515h2_8daaf6152771_d2a542b11920": "edge",
  "t13d2613h2_2802a3db6c62_a7cb7461f8a0": "ios",
  "t12d120700_d34a8e72043a_ba336a2cc70c": "android",
  "t12d2010s2_0bf03fa604e3_b8ffd2d1c0e3": "360",
  "t13d1516h2_8daaf6152771_300703f211b6": "qq",
  "t13d1710h2_6fb5bf16457f_c9d69dff1e9a": "randomized",
};

/** نمونه‌های JA3 — شاهدِ ناپایداری (در تصمیم‌گیری استفاده نمی‌شوند). */
export const JA3_SAMPLES: Record<string, string> = {
  "default": "6797ce6db45eeb7bcb760b3ce4651f52",
  "chrome": "d1d680ad6880f2a3700340b121b4c4b0",
  "firefox": "7704a11cf87dfcf33080b90ce11d5527",
  "safari": "ecdf4f49dd59effc439639da29186671",
  "ios": "656b9a2f4de6ed4909e157482860ab3d",
  "android": "6c0f0a346dcd84cb4b97a0d9382c53fd",
  "edge": "b32309a26951912be7dba376398abc3b",
  "360": "c405bbbe31c0e53ac4c8448355b2af5b",
  "qq": "cd08e31494f9531f560d64c695473da9",
  "random": "b32309a26951912be7dba376398abc3b",
  "randomized": "38efeddef86b31e1f45946b26fd08b95",
};
