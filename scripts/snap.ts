// Quick screenshot helper for development: tsx scripts/snap.ts <url> <out.png> [width] [height] [waitMs] [js]
import { chromium } from "@playwright/test";

const [url = "http://localhost:3000/", out = "qa/snap.png", w = "1440", h = "900", wait = "2500", js = ""] = process.argv.slice(2);

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const logs: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(wait));
if (js) {
  const r = await page.evaluate(js);
  if (r !== undefined) console.log("eval:", JSON.stringify(r));
  await page.waitForTimeout(1200);
}
const state = await page.evaluate(() => (window as unknown as { __EIDOS__?: { state: () => unknown } }).__EIDOS__?.state());
await page.screenshot({ path: out });
console.log(JSON.stringify(state));
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
