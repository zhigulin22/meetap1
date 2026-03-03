import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/server/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-1-rgb) / <alpha-value>)",
        surface2: "rgb(var(--surface-2-rgb) / <alpha-value>)",
        surface3: "rgb(var(--surface-3-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        borderStrong: "rgb(var(--border-strong-rgb) / <alpha-value>)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        text2: "rgb(var(--text-2-rgb) / <alpha-value>)",
        text3: "rgb(var(--text-3-rgb) / <alpha-value>)",
        muted: "rgb(var(--text-2-rgb) / <alpha-value>)",
        accent: "rgb(var(--blue-rgb) / <alpha-value>)",
        action: "rgb(var(--mint-rgb) / <alpha-value>)",
        cyan: "rgb(var(--blue-rgb) / <alpha-value>)",
        warning: "rgb(var(--amber-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        blue: "rgb(var(--blue-rgb) / <alpha-value>)",
        mint: "rgb(var(--mint-rgb) / <alpha-value>)",
        amber: "rgb(var(--amber-rgb) / <alpha-value>)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        glow: "0 0 0 1px rgb(var(--blue-rgb) / 0.28), 0 16px 40px rgb(var(--blue-rgb) / 0.18)",
      },
      fontFamily: {
        sans: ["var(--font-sora)", "var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "var(--font-sora)", "sans-serif"],
      },
      borderRadius: {
        xl2: "var(--radius-md)",
        xl3: "var(--radius-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
