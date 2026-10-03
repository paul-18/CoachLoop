import parser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";
export default [
  { ignores: ["dist/**", "vendor/**", "node_modules/**"] },
  { files: ["**/*.{ts,tsx,mjs,cjs}"], languageOptions: { parser, ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { "@typescript-eslint": ts, "react-hooks": hooks }, rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }], "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn", "react-hooks/set-state-in-effect": "error", "@typescript-eslint/no-require-imports": "off" } },
  { files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"], rules: { "@typescript-eslint/no-unused-vars": "off", "react-hooks/set-state-in-effect": "off" } },
];
