import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [
    forms,
    typography,
    daisyui,
  ],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#3b82f6",
          secondary: "#6366f1",
          accent: "#8b5cf6",
          neutral: "#1f2937",
          "base-100": "#ffffff",
          info: "#3b82f6",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
    ],
    styled: true,
    base: true,
    utils: true,
    logs: false,
    rtl: false,
  },
};
