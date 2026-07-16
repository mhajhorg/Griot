"use client";

import { useState } from "react";

const STEPS = [
  {
    number: 1,
    title: "Sign up to get your wallet",
    detail:
      "Enter your email above — Griot creates a wallet for you automatically. No browser extension, no seed phrase to save.",
    link: null,
  },
  {
    number: 2,
    title: "Get testnet USDC from the faucet",
    detail:
      "Once you're signed up, copy your wallet address and paste it into the Arc Testnet faucet. It sends a small amount of testnet USDC — usually enough for dozens of research sessions.",
    link: { label: "Open Arc faucet ↗", href: "https://faucet.circle.com" },
  },
  {
    number: 3,
    title: "Set your session budget",
    detail:
      "The session budget is the most you want the agent to spend across this conversation. Start small — $0.10 is plenty for several questions. The agent tracks the spend and stops when you hit the limit.",
    link: null,
  },
  {
    number: 4,
    title: "Ask away",
    detail:
      "The agent finds sources, pays creators whose content it reads, and shows you proof of every payment as a transaction link. Each follow-up question continues from the same session until your budget runs out.",
    link: null,
  },
];

export function FundingGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 font-body text-xs text-muted-foreground hover:text-accent transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path
            d="M5 2.5L9.5 7L5 11.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        How to fund your session
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <p className="font-body text-xs text-muted-foreground mb-4">
            This is a testnet build — real money doesn&apos;t move, but the
            payment mechanics are identical to production. Here&apos;s how to
            get set up:
          </p>
          <ol className="flex flex-col gap-4">
            {STEPS.map((step) => (
              <li key={step.number} className="flex gap-3">
                <span className="font-mono text-xs text-accent shrink-0 mt-0.5 font-semibold">
                  {step.number}.
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-heading text-sm font-semibold text-foreground">
                    {step.title}
                  </span>
                  <span className="font-body text-xs text-muted-foreground leading-relaxed">
                    {step.detail}
                  </span>
                  {step.link && (
                    <a
                      href={step.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-xs text-accent hover:underline mt-0.5 self-start"
                    >
                      {step.link.label}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
