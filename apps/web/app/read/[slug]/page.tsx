"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getArticleBySlug } from "@/lib/api";

interface Article {
  title: string;
  content: string;
  price: number;
  mode: "paywall" | "citation";
}

export default function PublicArticlePage() {
  const params = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    getArticleBySlug(params.slug)
      .then((result) => {
        if (!active) return;
        if (!result) setNotFound(true);
        else setArticle(result);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.slug]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto flex flex-col gap-4">
        <div className="h-8 w-3/4 rounded bg-secondary animate-pulse" />
        <div className="h-4 w-full rounded bg-secondary animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-secondary animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-secondary animate-pulse" />
      </main>
    );
  }

  if (notFound || !article) {
    return (
      <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto flex flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          We couldn&apos;t find this one
        </h1>
        <p className="font-body text-muted-foreground text-sm">
          This article may not exist yet, or hasn&apos;t been added to Griot.
        </p>
        <Link href="/" className="font-body text-sm text-accent hover:underline">
          ← Back to Griot
        </Link>
      </main>
    );
  }

  const isPaywalled = article.mode === "paywall";
  const teaser = isPaywalled
    ? article.content.slice(0, 280) + (article.content.length > 280 ? "..." : "")
    : article.content;

  return (
    <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {article.title}
      </h1>

      <p className="font-body text-foreground leading-relaxed whitespace-pre-line">
        {teaser}
      </p>

      {isPaywalled && (
        <>
          <div className="rounded-lg border border-accent bg-accent/5 p-5">
            <p className="font-body text-sm text-foreground">
              The rest of this piece is available to AI agents that pay $
              {article.price.toFixed(3)} to read it in full — and to creators,
              that&apos;s where the earnings on Griot come from.
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled
              className="font-body px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium opacity-50 cursor-not-allowed"
            >
              Read the full article — ${article.price.toFixed(3)}
            </button>
            <p className="font-body text-xs text-muted-foreground mt-2">
              Reading in full as a human is coming soon — for now, this
              content is available to AI agents researching on Griot.
            </p>
          </div>
        </>
      )}

      <Link href="/" className="font-body text-sm text-accent hover:underline mt-2">
        ← Back to Griot
      </Link>
    </main>
  );
}
