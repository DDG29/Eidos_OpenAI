// pnpm lighthouse [baseUrl=http://localhost:3000] — Lighthouse on the production build (`pnpm build && pnpm start`).
// Runs desktop and mobile (simulated 4G) on the landing, a world and the Atlas with Playwright's Chromium, prints a
// table against the performance budgets and writes qa/lighthouse/summary.json plus the full JSON reports.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";

const base = process.argv[2] ?? "http://localhost:3000";
const pages = ["/", "/m/transformer", "/atlas"];
mkdirSync("qa/lighthouse", { recursive: true });

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--no-first-run"],
});
const rows: Record<string, unknown>[] = [];
try {
  for (const form of ["desktop", "mobile"] as const) {
    for (const path of pages) {
      const result = await lighthouse(
        base + path,
        { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] },
        form === "desktop" ? desktopConfig : undefined,
      );
      if (!result) throw new Error(`no result for ${path}`);
      const lhr = result.lhr;
      const name = `${form}-${path === "/" ? "landing" : path.replace(/\//g, "_").replace(/^_/, "")}`;
      writeFileSync(`qa/lighthouse/${name}.json`, typeof result.report === "string" ? result.report : JSON.stringify(lhr));
      const score = (k: string) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
      const num = (id: string) => lhr.audits[id]?.numericValue ?? NaN;
      rows.push({
        form,
        path,
        performance: score("performance"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        seo: score("seo"),
        lcpMs: Math.round(num("largest-contentful-paint")),
        cls: Math.round(num("cumulative-layout-shift") * 1000) / 1000,
        tbtMs: Math.round(num("total-blocking-time")),
      });
    }
  }
} finally {
  await chrome.kill();
}
writeFileSync("qa/lighthouse/summary.json", JSON.stringify({ ranAt: new Date().toISOString(), base, rows }, null, 2) + "\n");
console.log("form     page             perf  a11y  bp  seo   LCP      CLS    TBT");
for (const r of rows)
  console.log(
    `${String(r.form).padEnd(8)} ${String(r.path).padEnd(16)} ${String(r.performance).padStart(4)} ${String(r.accessibility).padStart(5)} ${String(r.bestPractices).padStart(3)} ${String(r.seo).padStart(4)}  ${String(r.lcpMs).padStart(6)} ms ${String(r.cls).padStart(6)} ${String(r.tbtMs).padStart(5)} ms`,
  );
console.log("\nBudgets (spec): LCP < 1.8 s desktop, < 2.8 s mobile 4G; CLS < 0.05.");
