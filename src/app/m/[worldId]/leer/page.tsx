import type { Metadata } from "next";
import { ReadingView } from "@/components/reading/ReadingView";

export const metadata: Metadata = { title: "Modo lectura" };

export default async function ReadingPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  return <ReadingView worldId={decodeURIComponent(worldId)} />;
}
