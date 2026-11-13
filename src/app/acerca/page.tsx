import type { Metadata } from "next";
import { AboutPage } from "@/components/about/AboutPage";

export const metadata: Metadata = { title: "Acerca" };

export default function About() {
  return <AboutPage />;
}
