// pnpm shots — deterministic QA screenshots (spec 14.4) into qa/shots/<date>/<viewport>/.
// Usage: tsx scripts/shots.ts [baseUrl=http://localhost:3000] [only=<world id>|landing|theater|lab|reading|pitch]
// Shots mode (?shots=1) freezes time, twinkle and the cursor; every capture waits for the stage to report "stable".
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

const [base = "http://localhost:3000", only] = process.argv.slice(2);
const date = new Date().toISOString().slice(0, 10);
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const index = JSON.parse(readFileSync("public/worlds/index.json", "utf8")) as { worlds: { id: string }[] };
const worlds = [...new Set(index.worlds.map((w) => w.id))];
const want = (k: string) => !only || only === k;

async function stable(page: Page, extra = 900) {
  await page.waitForFunction(() => (window as unknown as { __EIDOS__?: { state: () => { stable: boolean } } }).__EIDOS__?.state().stable === true, null, { timeout: 25000 }).catch(() => undefined);
  await page.waitForTimeout(extra);
}

/** Scroll so section i sits at local progress s (0.5 = hold point, annotations visible). */
async function scrollTo(page: Page, i: number, s = 0.5) {
  await page.evaluate(
    ([i, s]) => {
      const sec = document.querySelector<HTMLElement>(`main [data-beat-index="${i}"]`);
      if (sec) window.scrollTo(0, sec.offsetTop + sec.offsetHeight * s - innerHeight * 0.45);
    },
    [i, s] as const,
  );
  await page.waitForTimeout(1300);
  await stable(page);
}

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
let count = 0;
for (const vp of VIEWPORTS) {
  const dir = `qa/shots/${date}/${vp.name}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // Hide the dev overlay badge if this runs against `pnpm dev`.
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.append(s);
    });
  });
  const shot = async (name: string) => {
    await page.screenshot({ path: `${dir}/${name}.png` });
    count++;
  };

  if (want("landing")) {
    await page.goto(`${base}/?shots=1`, { waitUntil: "load" });
    await page.waitForSelector(".mv[data-beat-index]");
    await stable(page, 2000);
    const n = await page.locator(".mv[data-beat-index]").count();
    for (let i = 0; i < n; i++) {
      await scrollTo(page, i, 0.5);
      await shot(`landing-${i}`);
    }
  }
  if (want("theater")) {
    await page.goto(`${base}/forja/demo-agujeros-negros?shots=1`, { waitUntil: "load" });
    // Five moments of the replay: ~4 s, 8 s, 12 s, 18 s and 26 s in.
    for (const [k, wait] of [[1, 4000], [2, 4000], [3, 4000], [4, 6000], [5, 8000]] as const) {
      await page.waitForTimeout(wait);
      await shot(`theater-${k}`);
    }
  }
  for (const id of worlds.filter((w) => want(w))) {
    await page.goto(`${base}/m/${id}?shots=1`, { waitUntil: "load" });
    await page.waitForSelector("main [data-beat-index]");
    await stable(page, 1500);
    const n = await page.locator("main [data-beat-index]").count();
    for (let i = 0; i < n; i++) {
      // Checks hold the gate: skip them for the walk-through (their own shot is taken first).
      await scrollTo(page, i, 0.5);
      await shot(`${id}-${String(i + 1).padStart(2, "0")}`);
      const skip = page.locator(`main [data-beat-index="${i}"] .check[data-status="pending"] .check-skip`);
      if (await skip.count()) {
        await skip.first().click();
        // Park the cursor off the content so hover never opens panels in later captures.
        await page.mouse.move(2, vp.height - 2);
      }
    }
  }
  if (want("reading")) {
    await page.goto(`${base}/m/transformer/leer`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${dir}/reading.png`, fullPage: true });
    count++;
  }
  if (want("lab") && !vp.mobile) {
    await page.goto(`${base}/lab?shots=1`, { waitUntil: "load" });
    await page.waitForTimeout(9000);
    await shot("lab");
  }
  if (want("pitch")) {
    await page.goto(`${base}/pitch?shots=1`, { waitUntil: "load" });
    await page.waitForSelector("main [data-beat-index]");
    const n = await page.locator("main [data-beat-index]").count();
    for (let i = 0; i < n; i++) {
      await scrollTo(page, i, 0.5);
      await shot(`pitch-${i + 1}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`✓ ${count} screenshots in qa/shots/${date}/`);
