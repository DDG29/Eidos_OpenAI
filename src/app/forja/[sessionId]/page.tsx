import type { Metadata } from "next";
import { ForgeTheater } from "@/components/theater/ForgeTheater";

export const metadata: Metadata = { title: "Forja" };

export default async function ForgePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ForgeTheater sessionId={decodeURIComponent(sessionId)} />;
}
