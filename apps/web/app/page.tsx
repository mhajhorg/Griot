import Link from "next/link";
import { PaymentFeed } from "@/components/PaymentFeed";

const CREATOR_STEPS = [
  "Add your content and set what it's worth",
  "Choose how readers and agents pay",
  "Get paid automatically, every time you're cited",
];

const READER_STEPS = [
  "Ask the research agent a question",
  "It finds sources and pays the creators behind them",
  "See exactly who got paid, with proof every time",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-4 pt-24 pb-20 max-w-2xl mx-auto text-center flex flex-col items-center gap-5">
        <h1 className="font-heading text-5xl sm:text-6xl font-bold text-foreground tracking-tight leading-tight">
          Get paid every time<br />AI cites your work
        </h1>
        <p className="font-body text-muted-foreground text-base max-w-lg">
          AI tools read your work every day and you see none of it. Griot
          pays you automatically the moment an agent cites your content —
          settled in seconds, with proof every time.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Link
            href="/creator"
            className="font-body px-6 py-3 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start earning
          </Link>
          <Link
            href="/reader"
            className="font-body px-6 py-3 rounded-lg border border-border text-foreground text-sm font-medium hover:border-accent transition-colors"
          >
            Try the agent
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <p className="font-body text-xs text-muted-foreground/60 uppercase tracking-widest text-center mb-10">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div>
            <p className="font-heading text-xs font-semibold text-accent mb-5 uppercase tracking-wide">
              For creators
            </p>
            <ol className="flex flex-col gap-4">
              {CREATOR_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 items-start">
                  <span className="font-mono text-xs text-muted-foreground/40 mt-0.5 shrink-0 w-4">
                    {i + 1}
                  </span>
                  <span className="font-body text-sm text-foreground/80 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-heading text-xs font-semibold text-accent mb-5 uppercase tracking-wide">
              For readers
            </p>
            <ol className="flex flex-col gap-4">
              {READER_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 items-start">
                  <span className="font-mono text-xs text-muted-foreground/40 mt-0.5 shrink-0 w-4">
                    {i + 1}
                  </span>
                  <span className="font-body text-sm text-foreground/80 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Live feed */}
      <section className="px-4 py-16 max-w-xl mx-auto">
        <p className="font-body text-xs text-muted-foreground/60 uppercase tracking-widest text-center mb-2">
          Live payments
        </p>
        <p className="font-heading text-lg font-semibold text-foreground text-center mb-8">
          Real payments, happening now
        </p>
        <PaymentFeed mockMode={true} maxVisible={4} />
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-border max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-foreground">Griot</p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            GitHub
          </a>
          <span className="font-body text-xs text-muted-foreground/40">
            Built on Arc Testnet
          </span>
        </div>
      </footer>
    </main>
  );
}
