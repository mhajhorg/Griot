"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useGriotStore } from "@/lib/store";
import { USE_MOCK } from "@/lib/api";

const LINKS = [
  { href: "/creator", label: "Creator" },
  { href: "/earnings", label: "Earnings" },
  { href: "/reader", label: "Research" },
  { href: "/community", label: "Community" },
];

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function NavHeader() {
  const pathname = usePathname();
  const { creator } = useGriotStore();
  const [copied, setCopied] = useState(false);

  function handleCopyAddress() {
    if (!creator) return;
    navigator.clipboard.writeText(creator.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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

      <div className="flex items-center gap-3">
        {creator && (
          <>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">
                @{creator.username || "creator"}
              </span>
              <button
                type="button"
                onClick={handleCopyAddress}
                title="Copy wallet address — fund this with testnet USDC to register content"
                className="font-mono text-[10px] text-muted-foreground/50 hover:text-accent transition-colors px-1.5 py-0.5 rounded bg-secondary/60 hover:bg-secondary"
              >
                {copied ? "copied ✓" : truncateAddress(creator.wallet_address)}
              </button>
            </div>
            <NotificationCenter
              walletAddress={creator.wallet_address}
              mockMode={USE_MOCK}
            />
          </>
        )}
      </div>
    </header>
  );
}
