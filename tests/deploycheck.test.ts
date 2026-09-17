import { describe, expect, it } from 'vitest';
import { isListening, isMicrosocksMissing } from '../src/lib/deploycheck';

/**
 * رگرسیون واقعی: چک قبلی `stdout.includes('LISTENING')` بود و «NOT_LISTENING»
 * هم آن را راضی می‌کرد، پس یک پروکسی مرده «موفق» گزارش می‌شد.
 */
describe('deploycheck — خواندن نتیجهٔ اسکریپت راه‌اندازی', () => {
  it('«NOT_LISTENING» هرگز موفق حساب نمی‌شود', () => {
    expect(isListening('NOT_LISTENING\n')).toBe(false);
    expect(isListening('NOT_LISTENING')).toBe(false);
    expect(isListening('\nNOT_LISTENING\n\n')).toBe(false);
  });

  it('«LISTENING» در هر جای خروجی (با فاصله و خط اضافه) پذیرفته می‌شود', () => {
    expect(isListening('LISTENING')).toBe(true);
    expect(isListening('  LISTENING  \n')).toBe(true);
    expect(isListening('sudo: a password is required\nNOT_LISTENING\n')).toBe(false);
  });

  it('خروجی خالی یا نامربوط موفق نیست', () => {
    expect(isListening('')).toBe(false);
    expect(isListening('ssh: connect to host failed')).toBe(false);
  });

  it('نصب: فقط خط دقیق MICROSOCKS_MISSING نشانهٔ نبودن بسته است', () => {
    expect(isMicrosocksMissing('MICROSOCKS_MISSING\n')).toBe(true);
    expect(isMicrosocksMissing('/usr/bin/microsocks\n')).toBe(false);
    expect(isMicrosocksMissing('')).toBe(false);
  });
});
