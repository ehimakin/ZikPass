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
        blush: "#F8C8B4",
        // Semantic tokens for the customer surface (see app/globals.css).
        canvas: "var(--zk-canvas)",
        card: "var(--zk-card)",
        sunken: "var(--zk-sunken)",
        "ink-surface": "var(--zk-ink-surface)",
        "zk-text": "var(--zk-text)",
        "zk-soft": "var(--zk-text-soft)",
        "zk-faint": "var(--zk-text-faint)",
        "on-ink": "var(--zk-text-on-ink)",
        line: "var(--zk-line)",
        "line-strong": "var(--zk-line-strong)",
        accent: "var(--zk-accent)",
        "accent-press": "var(--zk-accent-press)",
        positive: "var(--zk-positive)",
        "positive-bg": "var(--zk-positive-bg)",
        caution: "var(--zk-caution)",
        "caution-bg": "var(--zk-caution-bg)",
        critical: "var(--zk-critical)",
        "critical-bg": "var(--zk-critical-bg)",
        "info-bg": "var(--zk-info-bg)"
      },
      borderRadius: {
        "zk-sm": "var(--zk-r-sm)",
        "zk-md": "var(--zk-r-md)",
        "zk-lg": "var(--zk-r-lg)",
        "zk-xl": "var(--zk-r-xl)"
      },
      fontFamily: {
        zk: ["var(--zk-font-sans)"]
      },
      boxShadow: {
        panel: "0 20px 60px rgba(14, 23, 38, 0.08)",
        "zk-card": "var(--zk-shadow-card)",
        "zk-sheet": "var(--zk-shadow-sheet)",
        "zk-nav": "var(--zk-shadow-nav)"
      }
    }
  },
  plugins: []
};

export default config;
