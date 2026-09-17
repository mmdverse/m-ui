import crypto from 'crypto';

/**
 * Encryption at rest for the credential material the panel has to store to do
 * its job: SSH passwords and private keys, proxy/`trojan` passwords, SOCKS5
 * credentials and the WireGuard client key.
 *
 * Why this exists: those values sat in MongoDB as plain text, so a database
 * dump (a backup, a mis-set `mongodb://` URI, or the wide-open port the compose
 * file used to publish) meant root access to every managed server. See the
 * audit report, finding P0-2.
 *
 * Design choices:
 *  - AES-256-GCM with a random 12-byte IV per value and the auth tag stored
 *    alongside, so tampering is detected rather than silently decrypted.
 *  - The key comes from `M_UI_ENCRYPTION_KEY` when set, otherwise it is derived
 *    (scrypt) from `JWT_SECRET` — one secret to rotate instead of two for the
 *    common case, with an explicit knob for people who want them separate.
 *  - `seal()` is idempotent and `open()` passes unsealed values through, so
 *    existing rows keep working and a migration can be run gradually.
 */

const PREFIX = 'enc:v1:';
const DEV_KEY = 'm-ui-dev-only-encryption-key';

function key(): Buffer {
  const explicit = process.env.M_UI_ENCRYPTION_KEY || '';
  if (explicit) return crypto.scryptSync(explicit, 'm-ui/enc/v1', 32);
  const jwt = process.env.JWT_SECRET || '';
  if (jwt) return crypto.scryptSync(jwt, 'm-ui/enc/v1', 32);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('M_UI_ENCRYPTION_KEY (or JWT_SECRET) is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[m-ui] no M_UI_ENCRYPTION_KEY/JWT_SECRET — using an insecure dev key');
  return crypto.scryptSync(DEV_KEY, 'm-ui/enc/v1', 32);
}

export function seal(plain: unknown): string {
  if (typeof plain !== 'string' || plain === '') return typeof plain === 'string' ? plain : '';
  if (plain.startsWith(PREFIX)) return plain; // already sealed — never double-wrap
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function open(value: unknown): string {
  if (typeof value !== 'string' || value === '') return typeof value === 'string' ? value : '';
  if (!value.startsWith(PREFIX)) return value; // pre-migration row — pass through
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key or tampered value: return empty rather than the ciphertext, so a
    // connection attempt fails loudly instead of authenticating with garbage.
    return '';
  }
}

