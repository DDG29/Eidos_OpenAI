// Copies runtime assets that live in node_modules into public/ (detect-gpu benchmarks: CSP forbids the CDN).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "node_modules", "detect-gpu", "dist", "benchmarks");
const dst = join(root, "public", "benchmarks");
if (existsSync(src)) {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log("[eidos] synced detect-gpu benchmarks → public/benchmarks");
}
