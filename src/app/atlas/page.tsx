import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AtlasPage } from "@/components/atlas/AtlasPage";
import type { DemoManifestEntry } from "@/lib/storage/worlds";

export const metadata: Metadata = { title: "Atlas" };

/** The demo index is a 4 KB static file: reading it here puts the cards and filters in the first HTML (no shift). */
function demoIndex(): DemoManifestEntry[] {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "public/worlds/index.json"), "utf8")) as { worlds: DemoManifestEntry[] }).worlds;
  } catch {
    return [];
  }
}

export default function Atlas() {
  return <AtlasPage initialDemos={demoIndex()} />;
}
