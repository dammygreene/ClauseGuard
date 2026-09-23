"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/analyze", label: "Analyze" },
  { href: "/history", label: "History" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-[2px] py-1 text-ink" aria-label="ClauseGuard home">
          <Image src="/clauseguard-lockup.svg" alt="ClauseGuard" width={170} height={36} priority className="h-9 w-auto" />
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-[44px] items-center rounded-[2px] px-3 text-[0.9375rem] font-medium transition-colors duration-150 hover:bg-paper-2 ${
                      active ? "text-ink underline decoration-2 underline-offset-[6px]" : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
