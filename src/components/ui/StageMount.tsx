"use client";

import dynamic from "next/dynamic";

// The 3D bundle loads after first paint and never on the server (spec 5.12, 13.3).
const StageCanvas = dynamic(() => import("@/engine/stage/StageCanvas"), { ssr: false });

export function StageMount() {
  return <StageCanvas />;
}
