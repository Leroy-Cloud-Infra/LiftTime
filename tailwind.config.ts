import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./screens/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Microgramma", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
        data: ["var(--font-dm-mono)", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
