// Dev helper: tsx scripts/montage.ts <out.png> <shapeId>... — contact sheet of qa/shapes previews.
import sharp from "sharp";
const [out = "qa/sheet.png", ...ids] = process.argv.slice(2);
const W = 1260, H = 420, scale = 0.5, cols = 2;
const tiles = await Promise.all(ids.map(async (id) => ({ id, buf: await sharp(`qa/shapes/${id}.png`).resize(W * scale, H * scale).png().toBuffer() })));
const rows = Math.ceil(tiles.length / cols);
const comp = tiles.map((t, i) => ({ input: t.buf, left: (i % cols) * W * scale, top: Math.floor(i / cols) * (H * scale + 20) + 20 }));
const labels = tiles.map((t, i) => ({ input: Buffer.from(`<svg width="300" height="20"><text x="4" y="15" fill="#fff" font-size="14" font-family="sans-serif">${t.id}</text></svg>`), left: (i % cols) * W * scale, top: Math.floor(i / cols) * (H * scale + 20) }));
await sharp({ create: { width: W * scale * cols, height: rows * (H * scale + 20), channels: 3, background: "#000" } }).composite([...comp, ...labels]).png().toFile(out);
