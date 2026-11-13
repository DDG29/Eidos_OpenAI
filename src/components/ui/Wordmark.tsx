import Link from "next/link";

export function Wordmark({ href = "/", label = "EIDOS" }: { href?: string; label?: string }) {
  return (
    // The accessible name must contain the visible word (WCAG 2.5.3), so the destination is appended to it.
    <Link href={href} className="wordmark display" aria-label={label === "EIDOS" ? undefined : `EIDOS, ${label}`}>
      EIDOS
    </Link>
  );
}
