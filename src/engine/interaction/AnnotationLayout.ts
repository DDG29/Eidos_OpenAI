/**
 * Annotation placement (spec 5.10.3): start from each projected centroid, push outward from the shape's
 * projected center, then relax overlaps against each other, the narration column and the viewport.
 */
export interface LabelIn {
  key: string;
  ax: number; // anchor (projected centroid) in CSS px
  ay: number;
  w: number;
  h: number;
  visible: boolean;
}
export interface LabelOut {
  key: string;
  x: number; // label box top-left
  y: number;
  ax: number;
  ay: number;
  visible: boolean;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function layoutLabels(labels: LabelIn[], center: { x: number; y: number }, viewport: { w: number; h: number }, avoid: Rect[], offset: number, prev?: Map<string, LabelOut>, iterations = 8): LabelOut[] {
  const boxes = labels.map((l) => {
    let dx = l.ax - center.x,
      dy = l.ay - center.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (len < 4) {
      dx = 0.7;
      dy = -0.7;
    }
    const cx = l.ax + dx * offset;
    const cy = l.ay + dy * offset;
    return { ...l, x: cx - (dx < 0 ? l.w : 0), y: cy - l.h / 2 };
  });
  const margin = 8;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      if (!a.visible) continue;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]!;
        if (!b.visible) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + 4;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + 4;
        if (ox > 0 && oy > 0) {
          // separate along the axis of least penetration
          if (oy < ox) {
            const s = a.y < b.y ? -1 : 1;
            a.y += (s * oy) / 2;
            b.y -= (s * oy) / 2;
          } else {
            const s = a.x < b.x ? -1 : 1;
            a.x += (s * ox) / 2;
            b.x -= (s * ox) / 2;
          }
        }
      }
      for (const r of avoid) {
        const ox = Math.min(a.x + a.w, r.x + r.w) - Math.max(a.x, r.x);
        const oy = Math.min(a.y + a.h, r.y + r.h) - Math.max(a.y, r.y);
        if (ox > 0 && oy > 0) a.x = r.x + r.w + 6;
      }
      a.x = Math.min(viewport.w - a.w - margin, Math.max(margin, a.x));
      a.y = Math.min(viewport.h - a.h - margin, Math.max(margin + 56, a.y));
    }
  }
  return boxes.map((b) => {
    const p = prev?.get(b.key);
    const x = p ? p.x + (b.x - p.x) * 0.25 : b.x;
    const y = p ? p.y + (b.y - p.y) * 0.25 : b.y;
    return { key: b.key, x, y, ax: b.ax, ay: b.ay, visible: b.visible };
  });
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
