import { Html, Head, Main, NextScript } from 'next/document';

/**
 * مقدار اولیهٔ lang/dir همان پیش‌فرض اپ (فارسی) است؛ سمت کلاینت
 * I18nProvider آن را بر اساس زبان ذخیره‌شده یا زبان مرورگر عوض می‌کند.
 */
export default function Document() {
  return (
    <Html lang="fa" dir="rtl">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
