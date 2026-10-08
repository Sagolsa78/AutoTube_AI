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
        canvas: "#090B10",
        background: "#090B10",
        surface: {
          DEFAULT: "#10141C",
          hover: "#141923",
          input: "#0F1219",
        },
        elevated: {
          DEFAULT: "#171C26",
          hover: "#1D2330",
        },
        border: {
          DEFAULT: "#242A36",
          subtle: "#1B1F28",
          strong: "#353C4D",
        },
        primary: {
          DEFAULT: "#8B5CF6",
          hover: "#A78BFA",
          muted: "rgba(139, 92, 246, 0.12)",
        },
        accent: {
          DEFAULT: "#22D3EE",
          hover: "#67E8F9",
          muted: "rgba(34, 211, 238, 0.12)",
        },
        'brand-red': {
          DEFAULT: "#E6392F",
          hover: "#FF5045",
          active: "#CC2D24",
          muted: "rgba(230, 57, 47, 0.12)",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#AAB1C0",
          muted: "#697386",
        },
        success: {
          DEFAULT: "#34D399",
          muted: "rgba(52, 211, 153, 0.12)",
        },
        warning: {
          DEFAULT: "#F59E0B",
          muted: "rgba(245, 158, 11, 0.12)",
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
        'brand-glow': '0 0 24px rgba(230, 57, 47, 0.25)',
        'card-subtle': '0 2px 12px rgba(0, 0, 0, 0.4)',
        'dropdown': '0 8px 32px rgba(0, 0, 0, 0.65)',
      }
    },
  },
  plugins: [],
}
