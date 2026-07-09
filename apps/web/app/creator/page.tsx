"use client";

import { useEffect, useState } from "react";
import { ImportForm } from "@/components/ImportForm";
import { ArticleCard } from "@/components/ArticleCard";
import { useGriotStore } from "@/lib/store";
import { signUpWithEmail, getCreatorArticles } from "@/lib/api";
import type { Creator, CreatorArticle, RegistryEntry } from "@/types";

export default function CreatorPage() {
  const { creator, setCreator } = useGriotStore();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !username.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signUpWithEmail(email.trim(), username.trim());
      setCreator(result);
    } catch {
      setError("Couldn't create your account. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Already signed up ----------
  if (creator) return <CreatorDashboard creator={creator} />;

  // ---------- Email signup (the only path) ----------
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-2xl font-semibold text-foreground text-center mb-2">
          Start earning from your work
        </h1>
        <p className="font-body text-muted-foreground text-sm text-center mb-6">
          Sign up with your email. We handle the rest — no crypto knowledge
          needed.
        </p>

        <form
          onSubmit={handleEmailSignup}
          className="rounded-lg border border-border bg-card p-6 flex flex-col gap-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="font-body w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={submitting}
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username, e.g. ruze"
            className="font-body w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={submitting}
          />
          {error && <p className="font-body text-destructive text-xs">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !email.trim() || !username.trim()}
            className="font-body w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Setting up your account..." : "Get started"}
          </button>
        </form>
      </div>
    </main>
  );
}

function CreatorDashboard({ creator }: { creator: Creator }) {
  const [articles, setArticles] = useState<CreatorArticle[] | null>(null);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingArticles(true);
    getCreatorArticles(creator.id)
      .then((res) => { if (active) setArticles(res.articles); })
      .finally(() => { if (active) setLoadingArticles(false); });
    return () => { active = false; };
  }, [creator.id]);

  function handleRegistered(entry: RegistryEntry & { title: string }) {
    setArticles((prev) => [
      { id: entry.id, title: entry.title, canonical_url: entry.canonical_url,
        mode: entry.mode, price: entry.price, citation_count: 0,
        total_earned: 0, recent_payments: [], onchain_tx: entry.onchain_tx },
      ...(prev ?? []),
    ]);
  }

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <h1 className="font-heading text-2xl font-semibold text-foreground mb-1">
        Welcome back, @{creator.username || "creator"}
      </h1>
      <p className="font-body text-muted-foreground text-sm mb-8">
        Add new content or manage what you&apos;ve already published.
      </p>

      <ImportForm
        creatorId={creator.id}
        walletAddress={creator.wallet_address}
        onRegistered={handleRegistered}
      />

      <div className="mt-10">
        <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Your content
        </h2>
        {loadingArticles && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        )}
        {!loadingArticles && articles?.length === 0 && (
          <p className="font-body text-muted-foreground text-sm">Nothing added yet.</p>
        )}
        {!loadingArticles && articles && articles.length > 0 && (
          <div className="flex flex-col gap-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
