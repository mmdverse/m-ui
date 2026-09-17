import { describe, expect, it, vi, afterEach } from 'vitest';
import { hit, reset, sweep } from '@/lib/ratelimit';

afterEach(() => vi.useRealTimers());

describe('login rate limit (audit P1-5)', () => {
  it('allows the window budget then blocks with a retry hint', () => {
    const key = 'login:1.2.3.4:admin-' + Math.random();
    for (let i = 0; i < 8; i++) expect(hit(key, 8, 10_000).allowed).toBe(true);
    const blocked = hit(key, 8, 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('opens the window again after it expires', () => {
    vi.useFakeTimers();
    const key = 'login:5.5.5.5:admin';
    for (let i = 0; i < 9; i++) hit(key, 8, 1000);
    expect(hit(key, 8, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(hit(key, 8, 1000).allowed).toBe(true);
  });

  it('reset() clears the counter after a successful login', () => {
    const key = 'login:9.9.9.9:admin';
    for (let i = 0; i < 9; i++) hit(key, 8, 10_000);
    reset(key);
    expect(hit(key, 8, 10_000).allowed).toBe(true);
  });

  it('sweep() drops expired buckets', () => {
    const key = 'login:8.8.8.8:admin';
    hit(key, 1, 1);
    sweep(Date.now() + 10);
    expect(hit(key, 1, 1000).remaining).toBe(0);
  });
});
