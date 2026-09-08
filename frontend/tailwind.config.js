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
        canvas: "#0A0B0D",
        background: "#0A0B0D",
        surface: {
          DEFAULT: "#111318",
          hover: "#171A20",
          input: "#14171E",
        },
        elevated: {
          DEFAULT: "#171A20",
          hover: "#20242D",
        },
        border: {
          DEFAULT: "#262A32",
          subtle: "#1C1F26",
          strong: "#353A45",
        },
        'brand-red': {
          DEFAULT: "#E6392F",
          hover: "#FF5045",
          active: "#CC2D24",
          muted: "rgba(230, 57, 47, 0.12)",
        },
        text: {
          primary: "#F3F1EC",
          secondary: "#A7ABB4",
          muted: "#737984",
        },
        success: {
          DEFAULT: "#32C48D",
          muted: "rgba(50, 196, 141, 0.12)",
        },
        warning: {
          DEFAULT: "#E8B04B",
          muted: "rgba(232, 176, 75, 0.12)",
        },
        danger: {
          DEFAULT: "#E5484D",
          muted: "rgba(229, 72, 77, 0.12)",
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
