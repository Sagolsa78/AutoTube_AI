/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'sm': '640px',
      'md': '769px', // Tablet / desktop switchover exactly at > 768px
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
    extend: {
      colors: {
        canvas: "#08090C",
        background: "#08090C",
        surface: {
          DEFAULT: "#0F1117",
          hover: "#151821",
          elevated: "#151821",
          active: "#1B1F2A",
        },
        elevated: {
          DEFAULT: "#151821",
          hover: "#1B1F2A",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.07)",
          subtle: "rgba(255,255,255,0.04)",
          strong: "rgba(255,255,255,0.12)",
        },
        primary: {
          DEFAULT: "#A78BFA",
          hover: "#C4B5FD",
          muted: "rgba(167, 139, 250, 0.12)",
        },
        ai: {
          DEFAULT: "#A78BFA",
          hover: "#C4B5FD",
          muted: "rgba(167, 139, 250, 0.12)",
        },
        'brand-red': {
          DEFAULT: "#FF5A4F",
          hover: "#FF776D",
          active: "#E0483E",
          muted: "rgba(255, 90, 79, 0.12)",
        },
        text: {
          primary: "#F5F7FA",
          secondary: "#A6ADBA",
          muted: "#697180",
        },
        success: {
          DEFAULT: "#45D39C",
          muted: "rgba(69, 211, 156, 0.12)",
        },
        warning: {
          DEFAULT: "#F4B740",
          muted: "rgba(244, 183, 64, 0.12)",
        },
        danger: {
          DEFAULT: "#F87171",
          muted: "rgba(248, 113, 113, 0.12)",
        },
        info: {
          DEFAULT: "#5C8FE8",
          muted: "rgba(92, 143, 232, 0.12)",
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'brand-glow': '0 0 24px rgba(255, 90, 79, 0.25)',
        'ai-glow': '0 0 24px rgba(167, 139, 250, 0.25)',
        'card-subtle': '0 2px 12px rgba(0, 0, 0, 0.4)',
        'dropdown': '0 8px 32px rgba(0, 0, 0, 0.65)',
      }
    },
  },
  plugins: [],
}
