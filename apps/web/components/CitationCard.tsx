"use client";

import { useState } from "react";
import type { AgentCitation } from "@/types";

interface CitationCardProps {
  citation: AgentCitation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(citation.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shortHash = citation.tx_hash
    ? `${citation.tx_hash.slice(0, 6)}…${citation.tx_hash.slice(-4)}`
    : null;

  const shortUrl = citation.url
    .replace(/^https?:\/\//, "")
    .slice(0, 36) + (citation.url.length > 42 ? "…" : "");

  return (
    <div className="flex items-baseline gap-2 py-0.5">
      {/* Index badge */}
      <span className="font-mono text-[10px] text-muted-foreground/40 shrink-0 w-5 text-right">
        [{index}]
      </span>

      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Title */}
        <span className="font-body text-sm text-foreground leading-snug">
          {citation.title}
        </span>

        {/* Proof line — intentionally tiny, easy to ignore, easy to click */}
        <span className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="font-mono text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors truncate max-w-[140px]"
            title={citation.url}
          >
            {copied ? "copied ✓" : shortUrl}
          </button>

          {citation.tx_hash ? (
            <>
              <span className="text-muted-foreground/20 text-[9px]">·</span>
              <span className="font-mono text-[9px] text-accent/40">
                ${citation.amount_paid.toFixed(3)}
              </span>
              <span className="text-muted-foreground/20 text-[9px]">·</span>
              <a
                href={`https://testnet.arcscan.app/tx/${citation.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[9px] text-muted-foreground/25 hover:text-accent/70 transition-colors"
                title={`Verify on ArcScan: ${citation.tx_hash}`}
              >
                {shortHash} ↗
              </a>
            </>
          ) : (
            <>
              <span className="text-muted-foreground/20 text-[9px]">·</span>
              <span className="font-mono text-[9px] text-muted-foreground/25">free</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
