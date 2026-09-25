"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/scanner", label: "Scanner" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/paper-trades", label: "Paper trades" },
  { href: "/performance", label: "Performance" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="logo">
        Memecoin Intelligence<span>research only</span>
      </div>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
