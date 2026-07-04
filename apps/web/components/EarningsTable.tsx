"use client";

import { useState } from "react";
import type { CreatorArticle } from "@/types";

interface EarningsTableProps {
  articles: CreatorArticle[];
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

export function EarningsTable({ articles }: EarningsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row — hidden on small screens, table becomes card-like there */}
      <div className="hidden sm:grid grid-cols-[1fr_110px_90px_90px_100px_60px] gap-2 px-4 py-2.5 bg-secondary font-body text-xs text-muted-foreground uppercase tracking-wide">
        <span>Article</span>
        <span>Mode</span>
        <span>Price</span>
        <span>Citations</span>
        <span>Earned</span>
        <span>Link</span>
      </div>

      {articles.map((article, idx) => {
        const expanded = expandedId === article.id;
        return (
          <div
            key={article.id}
            className={idx % 2 === 1 ? "bg-card/60" : "bg-card"}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(expanded ? null : article.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setExpandedId(expanded ? null : article.id);
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-[1fr_110px_90px_90px_100px_60px] gap-1 sm:gap-2 px-4 py-3 cursor-pointer hover:bg-accent/5 transition-colors"
            >
              <span className="font-body text-sm text-foreground truncate">
                {article.title}
              </span>
              <span className="font-body text-xs text-muted-foreground sm:text-sm">
                <span className="sm:hidden text-muted-foreground/70">Mode: </span>
                {article.mode === "paywall" ? "Paywall" : "Citation Royalty"}
              </span>
              <span className="font-body text-xs text-muted-foreground sm:text-sm">
                <span className="sm:hidden text-muted-foreground/70">Price: </span>
                ${article.price.toFixed(3)}
              </span>
              <span className="font-body text-xs text-muted-foreground sm:text-sm">
                <span className="sm:hidden text-muted-foreground/70">Citations: </span>
                {article.citation_count}
              </span>
              <span className="font-body text-xs text-foreground sm:text-sm">
                <span className="sm:hidden text-muted-foreground/70">Earned: </span>
                ${article.total_earned.toFixed(3)}
              </span>
              <a
                href={article.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-body text-xs text-accent hover:underline sm:text-sm"
              >
                ↗
              </a>
            </div>

            {expanded && (
              <div className="px-4 pb-3 pl-8 flex flex-col gap-1.5">
                {article.recent_payments.length === 0 && (
                  <p className="font-body text-xs text-muted-foreground">
                    No payments yet for this article.
                  </p>
                )}
                {article.recent_payments.map((payment) => (
                  <div
                    key={payment.tx_hash}
                    className="font-body text-xs text-muted-foreground"
                  >
                    <span className="text-accent">
                      ${payment.amount_usdc.toFixed(3)} USDC
                    </span>
                    <span> · </span>
                    <a
                      href={`https://testnet.arcscan.app/tx/${payment.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-accent hover:underline"
                    >
                      {truncateHash(payment.tx_hash)}
                    </a>
                    <span> · {relativeTime(payment.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
