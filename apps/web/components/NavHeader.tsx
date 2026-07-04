"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useGriotStore } from "@/lib/store";

const LINKS = [
  { href: "/creator", label: "Creator" },
  { href: "/earnings", label: "Earnings" },
  { href: "/reader", label: "Research" },
];

export function NavHeader() {
  const pathname = usePathname();
  const { creator } = useGriotStore();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm px-4 h-14 flex items-center justify-between max-w-5xl mx-auto w-full">
      <Link
        href="/"
        className="font-heading text-sm font-semibold text-foreground hover:text-accent transition-colors"
      >
        Griot
      </Link>

      <nav className="flex items-center gap-0.5">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`font-body text-sm px-3 py-1.5 rounded-md transition-colors ${
                active
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        {creator && (
          <NotificationCenter
            walletAddress={creator.wallet_address}
            mockMode={true}
          />
        )}
        <div className="hidden sm:block">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
