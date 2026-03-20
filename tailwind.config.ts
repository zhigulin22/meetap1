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
        accent: "#0a0818",
        action: "#7c3aed",
      },
      boxShadow: {
        soft: "0 22px 64px rgba(109, 40, 217, 0.3)",
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
