import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        core: {
          bg: '#08070d',
          panel: '#11101a',
          line: '#2f2942',
          purple: '#8f5cff',
          cyan: '#6ee7ff',
          mint: '#8dffcc'
        }
      },
      boxShadow: {
        glow: '0 0 42px rgba(143, 92, 255, 0.28)'
      }
    }
  },
  plugins: []
};

export default config;
