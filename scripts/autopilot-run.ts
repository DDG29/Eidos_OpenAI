// Runs the autopilot end to end in headless Chromium and records where it goes.
// Usage: tsx scripts/autopilot-run.ts [baseUrl] [outDir] [maxSeconds]
// Writes a frame every 8 s to <outDir>/NN.png and prints a timeline (path, caption, console errors).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", out = "qa/autopilot", maxS = "240"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error" || (m.type() === "warning" && m.text().includes("[autopilot]"))) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const t0 = Date.now();
await page.goto(`${base}/?autopilot=1`, { waitUntil: "load", timeout: 90000 });
let frame = 0;
let started = false;
let lastLine = "";
for (;;) {
  const elapsed = (Date.now() - t0) / 1000;
  const info = await page.evaluate(() => ({
    path: location.pathname,
    running: !!document.querySelector(".pilot-cursor"),
    line: document.querySelector(".pilot-line")?.textContent ?? "",
    beat: document.querySelector("[data-narration-active]")?.closest<HTMLElement>("[data-beat-index]")?.dataset.beatIndex ?? "-",
    sections: document.querySelectorAll("main [data-beat-index]").length,
  }));
  if (info.running) started = true;
  if (info.line !== lastLine) {
    console.log(`${elapsed.toFixed(1).padStart(6)} s  ${info.path.padEnd(28)} beat ${info.beat}/${info.sections}  ${info.line}`);
    lastLine = info.line;
  }
  if (Math.floor(elapsed / 8) >= frame) {
    await page.screenshot({ path: `${out}/${String(frame).padStart(2, "0")}.png` });
    frame++;
  }
  if ((started && !info.running) || elapsed > Number(maxS)) {
    console.log(`${elapsed.toFixed(1).padStart(6)} s  ${started && !info.running ? "finished" : "timeout"} at ${info.path}`);
    break;
  }
  await page.waitForTimeout(400);
}
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
