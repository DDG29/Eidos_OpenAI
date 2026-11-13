import type { Metadata } from "next";
import { LabPage } from "@/components/lab/LabPage";

export const metadata: Metadata = { title: "Lab" };

export default function Lab() {
  return <LabPage />;
}
