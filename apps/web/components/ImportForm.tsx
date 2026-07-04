"use client";

import { useState } from "react";
import { fetchContent, registerContent } from "@/lib/api";
import { ModeToggle } from "@/components/ModeToggle";
import type { ContentMode, RegistryEntry } from "@/types";

interface ImportFormProps {
  creatorId: string;
  walletAddress: string;
  onRegistered?: (entry: RegistryEntry & { title: string }) => void;
}

type Step = "input" | "editing" | "done";

export function ImportForm({ creatorId, walletAddress, onRegistered }: ImportFormProps) {
  const [step, setStep] = useState<Step>("input");

  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [price, setPrice] = useState("0.02");
  const [mode, setMode] = useState<ContentMode>("paywall");

  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registeredEntry, setRegisteredEntry] = useState<
    (RegistryEntry & { title: string }) | null
  >(null);
  const [copied, setCopied] = useState(false);

  async function handleFetch() {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const result = await fetchContent(url.trim());
      setTitle(result.title);
      setContent(result.content);
      setWordCount(result.word_count);
      setStep("editing");
    } catch {
      setFetchError("Couldn't fetch that URL. Try a different link or check it's public.");
    } finally {
      setFetching(false);
    }
  }

  async function handleRegister() {
    const parsedPrice = parseFloat(price);
    if (!title.trim() || !content.trim() || !parsedPrice || parsedPrice <= 0) return;

    setRegistering(true);
    setRegisterError(null);
    try {
      const result = await registerContent({
        original_url: url.trim(),
        title: title.trim(),
        content: content.trim(),
        price: parsedPrice,
        wallet_address: walletAddress,
        mode,
        creator_id: creatorId,
      });

      if (!result.success) {
        throw new Error("Registration was not successful");
      }

      const entry = { ...result.entry, title: title.trim() };
      setRegisteredEntry(entry);
      setStep("done");
      onRegistered?.(entry);
    } catch {
      setRegisterError("Couldn't register this content. Try again.");
    } finally {
      setRegistering(false);
    }
  }

  function handleReset() {
    setStep("input");
    setUrl("");
    setTitle("");
    setContent("");
    setWordCount(0);
    setPrice("0.02");
    setMode("paywall");
    setFetchError(null);
    setRegisterError(null);
    setRegisteredEntry(null);
    setCopied(false);
  }

  function handleCopy() {
    if (!registeredEntry) return;
    navigator.clipboard.writeText(registeredEntry.canonical_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ---------- Done state ----------
  if (step === "done" && registeredEntry) {
    return (
      <div className="rounded-lg border border-accent bg-accent/5 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-5 w-5 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs">
            ✓
          </span>
          <span className="font-heading text-sm font-semibold text-foreground">
            Registered
          </span>
        </div>
        <p className="font-body text-xs text-muted-foreground mb-2">
          Your canonical URL:
        </p>
        <div className="flex items-center gap-2 mb-4">
          <code className="font-mono text-xs text-foreground bg-secondary px-3 py-2 rounded-md flex-1 truncate">
            {registeredEntry.canonical_url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="font-body text-xs px-3 py-2 rounded-md border border-border hover:border-accent transition-colors text-foreground whitespace-nowrap"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="font-body text-sm px-4 py-2 rounded-md bg-secondary border border-border hover:border-accent transition-colors text-foreground"
        >
          Register another
        </button>
      </div>
    );
  }

  // ---------- Input / editing state ----------
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste any URL — X thread, blog, Medium..."
          className="font-body flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          disabled={fetching}
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={fetching || !url.trim()}
          className="font-body px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {fetching ? "Fetching..." : "Fetch"}
        </button>
      </div>
      {fetchError && (
        <p className="font-body text-destructive text-xs mt-1">{fetchError}</p>
      )}

      {step === "editing" && (
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="font-body block text-xs text-muted-foreground mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-body w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <div>
            <label className="font-body block text-xs text-muted-foreground mb-1">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={9}
              className="font-body w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-y"
            />
            <p className="font-body text-xs text-muted-foreground mt-1">
              {wordCount} words
            </p>
          </div>

          <div>
            <label className="font-body block text-xs text-muted-foreground mb-1">
              Price per read/cite
            </label>
            <div className="flex items-center gap-2">
              <span className="font-body text-sm text-muted-foreground">$</span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="font-body w-32 px-3 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
              <span className="font-body text-sm text-muted-foreground">USDC</span>
            </div>
          </div>

          <div>
            <label className="font-body block text-xs text-muted-foreground mb-2">
              Protection mode
            </label>
            <ModeToggle value={mode} onChange={setMode} />
          </div>

          <div className="rounded-md bg-secondary px-3 py-2.5">
            <p className="font-body text-xs text-muted-foreground mb-1">
              Earnings will be sent here automatically
            </p>
            <p className="font-mono text-xs text-foreground truncate">
              {walletAddress}
            </p>
          </div>

          {registerError && (
            <p className="font-body text-destructive text-xs">{registerError}</p>
          )}

          <button
            type="button"
            onClick={handleRegister}
            disabled={registering || !title.trim() || !content.trim()}
            className="font-body w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {registering ? "Registering..." : "Register"}
          </button>
        </div>
      )}
    </div>
  );
}
