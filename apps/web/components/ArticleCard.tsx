"use client";

import { useState } from "react";
import type { CreatorArticle } from "@/types";

interface ArticleCardProps {
  article: CreatorArticle;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(article.canonical_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          {article.title}
        </h3>
        <span
          className={`font-body text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
            article.mode === "paywall"
              ? "bg-accent/15 text-accent"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {article.mode === "paywall" ? "Paywall" : "Citation Royalty"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <code className="font-mono text-xs text-muted-foreground truncate flex-1">
          {article.canonical_url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="font-body text-xs text-muted-foreground hover:text-accent transition-colors whitespace-nowrap"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="font-body text-xs text-muted-foreground">
        ${article.price.toFixed(3)} per read
      </p>

      <div className="flex items-center justify-between mt-1">
        <p className="font-body text-sm text-foreground">
          {article.citation_count} citations · ${article.total_earned.toFixed(3)} earned total
        </p>
        {article.onchain_tx && (
          <a
            href={`https://testnet.arcscan.app/tx/${article.onchain_tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-xs text-accent hover:underline whitespace-nowrap"
          >
            View registration on ArcScan ↗
          </a>
        )}
      </div>
    </div>
  );
}
