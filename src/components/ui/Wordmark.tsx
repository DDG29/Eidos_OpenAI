import Link from "next/link";

export function Wordmark({ href = "/", label = "EIDOS" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="wordmark display" aria-label={label}>
      EIDOS
    </Link>
  );
}
