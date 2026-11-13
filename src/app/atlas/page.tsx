import type { Metadata } from "next";
import { AtlasPage } from "@/components/atlas/AtlasPage";

export const metadata: Metadata = { title: "Atlas" };

export default function Atlas() {
  return <AtlasPage />;
}
