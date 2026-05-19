import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef1",
          200: "#d9dae0",
          300: "#b8bac4",
          400: "#8e919f",
          500: "#6b6e7c",
          600: "#4a4d59",
          700: "#33353f",
          800: "#1f2128",
          900: "#13141a",
          950: "#0a0b0f",
        },
        accent: {
          DEFAULT: "#7c5cff",
          soft: "#a48bff",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,.25), 0 8px 32px -8px rgba(124,92,255,.45)",
      },
      keyframes: {
        in: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { in: "in .15s ease-out" },
    },
  },
  plugins: [],
};
export default config;
