import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Screenshots dropped in for reading donor names off. Not source, and a
    // web page saved in there once brought its own minified JavaScript with
    // it, which eslint then reported thirteen errors in.
    "reciept-ss/**",
    "reciept-done/**",
  ]),
]);

export default eslintConfig;
