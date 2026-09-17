import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { I18nProvider } from '@/i18n';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <I18nProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐳</text></svg>" />
      </Head>
      <Component {...pageProps} />
    </I18nProvider>
  );
}
