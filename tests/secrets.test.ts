import { describe, expect, it, vi } from 'vitest';
import { seal, open } from '@/lib/secrets';

process.env.M_UI_ENCRYPTION_KEY = 'unit-test-key';

describe('secrets (audit P0-2)', () => {
  it('round-trips a value', () => {
    const sealed = seal('ssh-secret-kjh43');
    expect(sealed.startsWith('enc:v1:')).toBe(true);
    expect(sealed).not.toContain('ssh-secret');
    expect(open(sealed)).toBe('ssh-secret-kjh43');
  });

  it('is idempotent — sealing a sealed value never double-wraps', () => {
    const once = seal('abc');
    expect(seal(once)).toBe(once);
  });

  it('passes empty and non-string values through', () => {
    expect(seal('')).toBe('');
    expect(open('')).toBe('');
    expect(seal(undefined)).toBe('');
  });

  it('lets pre-migration plaintext rows keep working', () => {
    expect(open('plain-old-value')).toBe('plain-old-value');
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const sealed = seal('topsecret');
    const [head, iv, tag, data] = sealed.split(/[:.]/, 4);
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    expect(open(`enc:v1:${iv}.${tag}.${flipped.toString('base64')}`)).toBe('');
  });

  it('uses a fresh IV per value (same plaintext → different ciphertext)', () => {
    expect(seal('same')).not.toBe(seal('same'));
  });
});
