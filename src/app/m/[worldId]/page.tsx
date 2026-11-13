import type { Metadata } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Player } from "@/components/player/Player";

const SAFE_ID = /^[a-z0-9-]{1,64}$/;

/** Demo worlds get their own title and Open Graph card; forged and shared worlds live in the browser only. */
export async function generateMetadata({ params }: { params: Promise<{ worldId: string }> }): Promise<Metadata> {
  const id = decodeURIComponent((await params).worldId);
  if (!SAFE_ID.test(id)) return { title: "Mundo" };
  try {
    const file = join(process.cwd(), "public/worlds", `${id}.json`);
    if (!existsSync(file)) return { title: "Mundo" };
    const w = JSON.parse(readFileSync(file, "utf8")) as { spec?: { title?: string; subtitle?: string } };
    const title = w.spec?.title ?? "Mundo";
    const og = existsSync(join(process.cwd(), "public/og", `${id}.jpg`)) ? [`/og/${id}.jpg`] : undefined;
    return { title, description: w.spec?.subtitle, openGraph: { title, description: w.spec?.subtitle, images: og } };
  } catch {
    return { title: "Mundo" };
  }
}

export default async function WorldPage({ params, searchParams }: { params: Promise<{ worldId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { worldId } = await params;
  const sp = await searchParams;
  return <Player worldId={decodeURIComponent(worldId)} present={sp.present === "1"} />;
}
