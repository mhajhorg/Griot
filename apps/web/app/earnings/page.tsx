"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGriotStore } from "@/lib/store";
import { getCreatorArticles } from "@/lib/api";
import { EarningsTable } from "@/components/EarningsTable";
import { PaymentFeed } from "@/components/PaymentFeed";
import { WithdrawPanel } from "@/components/WithdrawPanel";
import type { CreatorArticle } from "@/types";

export default function EarningsPage() {
  const { creator } = useGriotStore();
  const [articles, setArticles] = useState<CreatorArticle[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalCitations, setTotalCitations] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creator) return;
    let active = true;
    setLoading(true);
    getCreatorArticles(creator.id)
      .then((res) => {
        if (!active) return;
        setArticles(res.articles);
        setTotalEarned(res.total_earned);
        setTotalCitations(res.total_citations);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [creator]);

  if (!creator) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="font-body text-muted-foreground text-sm text-center max-w-sm">
          Sign up to start tracking what your content earns.
        </p>
        <Link
          href="/creator"
          className="font-body text-sm text-accent hover:underline"
        >
          Go to creator dashboard →
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <h1 className="font-heading text-2xl font-semibold text-foreground mb-8">
        Earnings
      </h1>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-body text-xs text-muted-foreground mb-1">
            Total earned
          </p>
          <p className="font-heading text-3xl font-semibold text-foreground">
            ${totalEarned.toFixed(3)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-body text-xs text-muted-foreground mb-1">
            Total citations
          </p>
          <p className="font-heading text-3xl font-semibold text-foreground">
            {totalCitations}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <WithdrawPanel
          walletAddress={creator.wallet_address}
          totalEarned={totalEarned}
        />
      </div>

      {loading && (
        <div className="flex flex-col gap-3 mb-10">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      )}

      {!loading && articles.length === 0 && (
        <p className="font-body text-muted-foreground text-sm mb-10">
          No articles registered yet.
        </p>
      )}

      {!loading && articles.length > 0 && (
        <div className="mb-10">
          <EarningsTable articles={articles} />
        </div>
      )}

      <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
        Recent payments
      </h2>
      <PaymentFeed walletAddress={creator.wallet_address} mockMode={true} />
    </main>
  );
}
