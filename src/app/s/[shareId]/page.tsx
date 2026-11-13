import { ShareImport } from "@/components/atlas/ShareImport";

export default async function SharedById({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <ShareImport shareId={shareId} />;
}
