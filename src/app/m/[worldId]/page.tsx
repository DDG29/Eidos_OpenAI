import type { Metadata } from "next";
import { Player } from "@/components/player/Player";

export const metadata: Metadata = { title: "Mundo" };

export default async function WorldPage({ params, searchParams }: { params: Promise<{ worldId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { worldId } = await params;
  const sp = await searchParams;
  return <Player worldId={decodeURIComponent(worldId)} present={sp.present === "1"} />;
}
