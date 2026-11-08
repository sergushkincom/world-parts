import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// Next.js 15 recommended ESLint setup. eslint-config-next 15 still ships
// legacy configs, so FlatCompat translates them into flat config.
// core-web-vitals = React, React Hooks, accessibility (jsx-a11y) and Next.js rules
// typescript      = typescript-eslint rules
// Docs: https://nextjs.org/docs/app/api-reference/config/eslint
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
