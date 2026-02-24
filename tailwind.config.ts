import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "#000229",
        action: "#52CC83",
      },
      boxShadow: {
        soft: "0 22px 64px rgba(0, 2, 41, 0.4)",
      },
      fontFamily: {
        sans: ["var(--font-rubik)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "var(--font-rubik)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
