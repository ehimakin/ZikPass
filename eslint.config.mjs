import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  {
    // public/ocr and public/pdf are third-party engine builds vendored at install time.
    ignores: [".next/**", ".next-sprint6-*/**", "node_modules/**", "next-env.d.ts", "scripts/**", "public/ocr/**", "public/pdf/**"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["lib/server/**/*.ts", "lib/client/**/*.ts", "components/**/*.{ts,tsx}"], rules: { "no-restricted-imports": ["error", { patterns: ["**/demo-rp/**"] }] } }
];

export default eslintConfig;
