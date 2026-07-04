"use client";

import type { ContentMode } from "@/types";

interface ModeToggleProps {
  value: ContentMode;
  onChange: (mode: ContentMode) => void;
}

const OPTIONS: { value: ContentMode; title: string; description: string }[] = [
  {
    value: "paywall",
    title: "Paywall",
    description: "Agents pay to access full content",
  },
  {
    value: "citation",
    title: "Citation Royalty",
    description: "Content stays public, agents tip on cite",
  },
];

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`font-body text-left p-4 rounded-md border transition-colors ${
              selected
                ? "border-accent bg-accent/10"
                : "border-border bg-secondary hover:border-muted-foreground"
            }`}
          >
            <span className="font-heading block text-sm font-semibold text-foreground mb-1">
              {option.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
