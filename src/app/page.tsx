import { TopBar } from "@/components/ui/TopBar";

export default function Home() {
  return (
    <>
      <TopBar />
      <main id="main" className="page" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <h1 className="display" style={{ fontSize: "var(--fs-hero)" }}>
          Toda idea tiene forma.
        </h1>
      </main>
    </>
  );
}
