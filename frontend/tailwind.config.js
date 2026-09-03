/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0E0F12",
        surface: {
          DEFAULT: "#17181C",
          hover: "#26272C",
          input: "#17181C",
        },
        primary: {
          DEFAULT: "#FF5A36",
          hover: "#FF7556",
        },
        status: {
          pending: "#F5C842",
          scripted: "#5B8DEF",
          ready: "#3ED598",
          failed: "#FF4D4F",
          rendering: "#F5C842",
        },
        border: "rgba(255, 255, 255, 0.12)",
        ring: "rgba(255, 90, 54, 0.3)",
        text: {
          primary: "#f0f0f6",
          secondary: "#b8bcd2",
          muted: "#6d7196",
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
