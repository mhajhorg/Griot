"use client";

import { useEffect, useState } from "react";
import { getPublicStats } from "@/lib/api";
import type { PublicStats } from "@/types";

export default function CommunityPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPublicStats()
      .then((res) => {
        if (active) setStats(res);
      })
      .catch(() => {
        if (active) setError("Couldn't load stats right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen px-4 py-16 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="font-heading text-3xl font-semibold text-foreground mb-2">
          Griot at a glance
        </h1>
        <p className="font-body text-muted-foreground text-sm">
          What the community has built so far — no earnings shown, just the numbers.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="font-body text-sm text-destructive text-center">{error}</p>
      )}

      {stats && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="font-heading text-4xl font-semibold text-foreground mb-1">
              {stats.creator_count}
            </p>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wide">
              Creators
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="font-heading text-4xl font-semibold text-foreground mb-1">
              {stats.article_count}
            </p>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wide">
              Articles registered
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="font-heading text-4xl font-semibold text-accent mb-1">
              {stats.citation_count}
            </p>
            <p className="font-body text-xs text-muted-foreground uppercase tracking-wide">
              Times cited
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
