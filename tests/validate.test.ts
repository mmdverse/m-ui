import { describe, expect, it } from 'vitest';
import { isObjectId, parsePort, clampText, fail } from '@/lib/validate';
import { PublicError } from '@/lib/errors';

function fakeRes() {
  const r: any = { code: 0, body: null };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
}

describe('validate (audit P1-6, P2-12)', () => {
  it('rejects malformed object ids', () => {
    expect(isObjectId('xyz')).toBe(false);
    expect(isObjectId('6aac09983df5a078253863f1')).toBe(true);
    expect(isObjectId(42)).toBe(false);
  });

  it('accepts only 1..65535 ports, and accepts numeric strings', () => {
    expect(parsePort(443)).toBe(443);
    expect(parsePort('8443')).toBe(8443);
    expect(parsePort(0)).toBeNull();
    expect(parsePort(65536)).toBeNull();
    expect(parsePort(999999)).toBeNull();
    expect(parsePort('abc')).toBeNull();
    expect(parsePort('')).toBeNull();
    expect(parsePort(22.5)).toBeNull();
  });

  it('clamps long input', () => {
    expect(clampText('x'.repeat(200), 120)).toHaveLength(120);
  });

  it('maps bad input to 400, unexpected failures to a generic 500', () => {
    const a = fakeRes();
    fail(a, Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' }));
    expect([a.code, a.body.error]).toEqual([400, expect.stringContaining('نامعتبر')]);

    const b = fakeRes();
    fail(b, new Error('MONGO_URI contains the password hunter2'));
    expect(b.code).toBe(500);
    expect(b.body.error).not.toContain('hunter2');

    const c = fakeRes();
    fail(c, new PublicError('sshpass نصب نیست', 501));
    expect([c.code, c.body.error]).toEqual([501, 'sshpass نصب نیست']);
  });
});
