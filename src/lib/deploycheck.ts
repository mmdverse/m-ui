/**
 * نتیجهٔ اسکریپت راه‌اندازی پروکسی روی سرور را می‌خواند.
 *
 * چرا تابع جدا: چک قبلی `stdout.includes('LISTENING')` بود و رشتهٔ
 * «NOT_LISTENING» هم آن را درست می‌کرد — یعنی یک اجرای شکست‌خورده «موفق»
 * گزارش می‌شد. تطبیق باید خط‌به‌خط و دقیق باشد.
 */
export function isListening(stdout: string): boolean {
  return stdout
    .split('\n')
    .some((line) => line.trim() === 'LISTENING');
}

/** همان منطق برای مرحلهٔ نصب microsocks. */
export function isMicrosocksMissing(stdout: string): boolean {
  return stdout
    .split('\n')
    .some((line) => line.trim() === 'MICROSOCKS_MISSING');
}
