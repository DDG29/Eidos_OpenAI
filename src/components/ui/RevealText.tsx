"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useSettings, prefersReducedMotion } from "@/lib/settings/store";

gsap.registerPlugin(SplitText);

/** Line-by-line mask reveal (spec 4.6): each line rises 12 px from opacity 0, 40 ms stagger. */
export function RevealText({ as: Tag = "p", visible, children, className, delay = 0, id }: { as?: ElementType; visible: boolean; children: ReactNode; className?: string; delay?: number; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const split = useRef<SplitText | null>(null);
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion(motion)) {
      gsap.to(el, { opacity: visible ? 1 : 0, duration: 0.3 });
      return;
    }
    if (!split.current) split.current = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "reveal-line", autoSplit: true });
    const lines = split.current.lines;
    gsap.set(el, { opacity: 1 });
    gsap.killTweensOf(lines);
    if (visible) gsap.fromTo(lines, { yPercent: 60, y: 12, opacity: 0 }, { yPercent: 0, y: 0, opacity: 1, duration: 0.7, stagger: 0.04, ease: "expo.out", delay });
    else gsap.to(lines, { opacity: 0, y: -8, duration: 0.35, stagger: 0.02, ease: "power2.in" });
  }, [visible, motion, delay]);
  useEffect(
    () => () => {
      split.current?.revert();
      split.current = null;
    },
    [],
  );
  return (
    <Tag ref={ref} className={className} id={id} style={{ opacity: 0 }}>
      {children}
    </Tag>
  );
}
