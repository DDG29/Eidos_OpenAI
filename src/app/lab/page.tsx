import type { Metadata } from "next";
import { TopBar } from "@/components/ui/TopBar";
import { LabMinimal } from "@/components/lab/LabMinimal";

export const metadata: Metadata = { title: "Lab" };

export default function LabPage() {
  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <LabMinimal />
      </main>
    </>
  );
}
