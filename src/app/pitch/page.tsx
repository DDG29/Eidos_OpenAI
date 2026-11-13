import type { Metadata } from "next";
import { PitchView } from "@/components/pitch/PitchView";

export const metadata: Metadata = { title: "Pitch" };

export default function Pitch() {
  return <PitchView />;
}
