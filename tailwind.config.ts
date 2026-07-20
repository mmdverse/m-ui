import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: { primary: '#03a66d', dark: '#0d1117', card: '#1e1e2e', border: '#313244' },
    },
  },
  plugins: [],
};
export default config;
