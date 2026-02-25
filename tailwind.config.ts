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
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "#0f1d3a",
        action: "#52CC83",
        cyan: "#6ec6ff",
        warning: "#ffb86b",
        danger: "#ff6d6d",
      },
      boxShadow: {
        soft: "0 22px 64px rgba(0, 10, 24, 0.42)",
        glow: "0 0 0 1px rgba(110,198,255,0.2), 0 16px 40px rgba(0, 0, 0, 0.35)",
      },
      fontFamily: {
        sans: ["var(--font-sora)", "var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "var(--font-sora)", "sans-serif"],
      },
      borderRadius: {
        xl2: "1rem",
        xl3: "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
