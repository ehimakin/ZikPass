import type { Config } from "tailwindcss";

// Tailwind's default opacity scale only defines multiples of 5 (plus 25/75/95),
// so bare `text-ink/72`-style classes for any other value silently generate no
// rule at all. This codebase uses arbitrary two-digit opacity values throughout
// (e.g. text-ink/72, text-mist/68), so fill in every integer 0-100 to match.
const fullOpacityScale = Object.fromEntries(
  Array.from({ length: 101 }, (_, value) => [value, String(value / 100)])
);

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      opacity: fullOpacityScale,
      colors: {
        ink: "#0E1726",
        mist: "#F4F6F0",
        lime: "#D7F171",
        teal: "#69E1C8",
        blush: "#F8C8B4"
      },
      boxShadow: {
        panel: "0 20px 60px rgba(14, 23, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
