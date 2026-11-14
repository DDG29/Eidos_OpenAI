// pnpm posters — Atlas posters (/posters/<id>.webp) and Open Graph cards (/og/<id>.jpg, /og/eidos.jpg).
// Usage: tsx scripts/posters.ts [baseUrl=http://localhost:3000] [worldId]
// Needs a running server (dev or `pnpm start`). Each world is opened in shots mode (frozen time, no cursor),
// scrolled to its `posterBeat`, the interface is hidden and the particle form is captured.
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import type { World } from "../src/lib/world/types";

const [base = "http://localhost:3000", only] = process.argv.slice(2);
mkdirSync("public/posters", { recursive: true });
mkdirSync("public/og", { recursive: true });
const index = JSON.parse(readFileSync("public/worlds/index.json", "utf8")) as { worlds: { id: string; language: string }[] };
const ids = [...new Set(index.worlds.map((w) => w.id))].filter((id) => !only || id === only);

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });

const HIDE_UI = `body > *:not(.stage-layer), .stage-layer ~ * { visibility: hidden !important; } nextjs-portal { display: none !important; }`;

async function stable(page: Page, extra = 1500) {
  await page.waitForFunction(() => (window as unknown as { __EIDOS__?: { state: () => { stable: boolean } } }).__EIDOS__?.state().stable === true, null, { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(extra);
}

async function openBeat(page: Page, id: string, beatId: string | undefined) {
  await page.goto(`${base}/m/${id}?shots=1`, { waitUntil: "load", timeout: 90000 });
  await page.waitForSelector("main [data-beat-index]", { timeout: 30000 });
  await stable(page, 800);
  const idx = await page.evaluate((b) => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>("main [data-beat-index]"));
    const i = Math.max(0, secs.findIndex((s) => s.querySelector(`#h-${b}`)));
    const s = secs[i]!;
    window.scrollTo(0, s.offsetTop + s.offsetHeight * 0.5 - innerHeight * 0.45);
    return i;
  }, beatId ?? "");
  await page.waitForTimeout(1800);
  await stable(page, 1800);
  return idx;
}

/** Crop to the lit part of the frame (the form) with some air around it, at a 16:10 aspect. */
async function cropToForm(png: Buffer, outW: number, outH: number): Promise<Buffer> {
  const img = sharp(png);
  const { width = 0, height = 0 } = await img.metadata();
  const { data, info } = await img.clone().greyscale().resize(Math.round(width / 4), Math.round(height / 4)).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[y * info.width + x]! > 70) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  if (x1 <= x0 || y1 <= y0) return sharp(png).resize(outW, outH, { fit: "cover" }).toBuffer();
  let cx = ((x0 + x1) / 2) * 4, cy = ((y0 + y1) / 2) * 4;
  let w = (x1 - x0) * 4 * 1.35, h = (y1 - y0) * 4 * 1.35;
  const aspect = outW / outH;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, width);
  h = Math.min(h, height, w / aspect);
  w = h * aspect;
  cx = Math.min(Math.max(cx, w / 2), width - w / 2);
  cy = Math.min(Math.max(cy, h / 2), height - h / 2);
  return sharp(png).extract({ left: Math.round(cx - w / 2), top: Math.round(cy - h / 2), width: Math.round(w), height: Math.round(h) }).resize(outW, outH).toBuffer();
}

for (const id of ids) {
  const w = JSON.parse(readFileSync(`public/worlds/${id}.json`, "utf8")) as World;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await openBeat(page, id, w.posterBeat);
  await page.addStyleTag({ content: HIDE_UI });
  await page.waitForTimeout(400);
  // A frame taken while the stage is still loading comes out black: wait and retake (a few tries at most).
  let frame = await page.screenshot();
  for (let tries = 0; tries < 4 && (await sharp(frame).stats()).channels.slice(0, 3).every((c) => c.mean < 6); tries++) {
    await page.waitForTimeout(2500);
    frame = await page.screenshot();
  }
  const poster = await cropToForm(frame, 960, 600);
  await sharp(poster).webp({ quality: 82 }).toFile(`public/posters/${id}.webp`);
  // A 480-px variant for phones (srcset in the Atlas grid).
  await sharp(poster).resize(480, 300).webp({ quality: 78 }).toFile(`public/posters/${id}-480.webp`);
  await page.close();

  // Open Graph: the same beat at 1200 × 630 with the title set in the left column.
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await openBeat(og, id, w.posterBeat);
  await og.addStyleTag({ content: HIDE_UI + ` body > div.og-card, body > div.og-card * { visibility: visible !important; }` });
  await og.evaluate(({ title, subtitle }) => {
    const card = document.createElement("div");
    card.className = "og-card";
    card.style.cssText = "position:fixed;left:64px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:18px;z-index:99;color:#e9ecf5";
    const mark = document.createElement("span");
    mark.textContent = "EIDOS";
    mark.style.cssText = "font-family:var(--font-display);font-size:22px;letter-spacing:0.08em";
    const h = document.createElement("h1");
    h.textContent = title;
    h.style.cssText = "margin:0;font-family:var(--font-display);font-weight:500;font-size:52px;line-height:1.04";
    const p = document.createElement("p");
    p.textContent = subtitle;
    p.style.cssText = "margin:0;font-family:var(--font-text);font-size:20px;line-height:1.45;color:#9aa3b8";
    card.append(mark, h, p);
    document.body.append(card);
  }, { title: w.spec.title, subtitle: w.spec.subtitle });
  await og.waitForTimeout(500);
  await og.screenshot({ path: `public/og/${id}.jpg`, type: "jpeg", quality: 88 });
  await og.close();
  console.log(`✓ ${id}: posters/${id}.webp, og/${id}.jpg (beat ${w.posterBeat ?? "first"})`);
}

if (!only) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/?shots=1`, { waitUntil: "load", timeout: 90000 });
  await stable(page, 3500);
  await page.addStyleTag({ content: `nextjs-portal { display: none !important; } .topbar, .ruler, [class*="scroll-cue"] { visibility: hidden !important; }` });
  await page.screenshot({ path: "public/og/eidos.jpg", type: "jpeg", quality: 88 });
  await page.close();
  console.log("✓ og/eidos.jpg");
}
await browser.close();
