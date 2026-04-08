import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
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
