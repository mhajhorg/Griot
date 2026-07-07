"use client";

import { useEffect, useRef, useState } from "react";
import { runAgent } from "@/lib/api";
import { CitationCard } from "@/components/CitationCard";
import type { AgentCitation } from "@/types";
import type { StoredTurn } from "@/lib/useSessionHistory";

const LOADING_STEPS = [
  "Searching for relevant sources...",
  "Checking Griot registry...",
  "Evaluating sources within budget...",
  "Reading content...",
  "Synthesising research...",
];

interface UserTurn {
  role: "user";
  id: string;
  content: string;
  attachment?: { name: string; type: string; base64?: string };
}

interface AgentTurn {
  role: "agent";
  id: string;
  status: "loading" | "done" | "error";
  visibleSteps: number;
  summary?: string;
  citations?: AgentCitation[];
  spent?: number;
  errorMessage?: string;
}

type Turn = UserTurn | AgentTurn;

interface AgentChatProps {
  sessionBudget: number;
  readerId?: string;
  initialTurns?: StoredTurn[];
  initialSpent?: number;
  onSessionUpdate?: (turns: StoredTurn[], totalSpent: number) => void;
  onSpentChange?: (totalSpent: number) => void;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hydrateStoredTurns(stored: StoredTurn[]): Turn[] {
  return stored.map((s) => {
    if (s.role === "user") {
      return { role: "user", id: s.id, content: s.content ?? "", attachment: s.attachment };
    }
    return {
      role: "agent",
      id: s.id,
      status: (s.status ?? "done") as "done" | "error",
      visibleSteps: LOADING_STEPS.length - 1,
      summary: s.summary,
      citations: s.citations,
      spent: s.spent,
      errorMessage: s.errorMessage,
    };
  });
}

function serializeTurns(turns: Turn[]): StoredTurn[] {
  return turns
    .filter((t) => t.role === "user" || (t.role === "agent" && t.status !== "loading"))
    .map((t) => {
      if (t.role === "user") return {
        role: "user" as const,
        id: t.id,
        content: t.content,
        // Don't store base64 in localStorage — just file metadata
        attachment: t.attachment ? { name: t.attachment.name, type: t.attachment.type } : undefined,
      };
      return {
        role: "agent" as const,
        id: t.id,
        status: t.status as "done" | "error",
        summary: t.summary,
        citations: t.citations,
        spent: t.spent,
        errorMessage: t.errorMessage,
      };
    });
}

export function AgentChat({
  sessionBudget,
  readerId,
  initialTurns,
  initialSpent = 0,
  onSessionUpdate,
  onSpentChange,
}: AgentChatProps) {
  const [turns, setTurns] = useState<Turn[]>(() =>
    initialTurns ? hydrateStoredTurns(initialTurns) : []
  );
  const [input, setInput] = useState("");
  const [totalSpent, setTotalSpent] = useState(initialSpent);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const remainingBudget = Math.max(0, Math.round((sessionBudget - totalSpent) * 1000) / 1000);
  const isAgentBusy = turns.some((t) => t.role === "agent" && t.status === "loading");
  const canSend = (input.trim().length > 0 || pendingFile !== null) && !isAgentBusy && remainingBudget > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    return () => {
      stepTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  useEffect(() => {
    if (initialTurns && initialTurns.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "instant" });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  function removePendingFile() {
    setPendingFile(null);
  }

  async function handleSend() {
    const query = input.trim();
    if ((!query && !pendingFile) || isAgentBusy || remainingBudget <= 0) return;

    const userTurnId = newId();
    const agentTurnId = newId();

    // Read file as base64 if present
    let attachment: { name: string; type: string; base64: string } | undefined;
    if (pendingFile) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(pendingFile);
      });
      attachment = { name: pendingFile.name, type: pendingFile.type, base64 };
    }

    const displayQuery = query || `[Attached: ${pendingFile!.name}]`;

    setTurns((prev) => [
      ...prev,
      {
        role: "user",
        id: userTurnId,
        content: displayQuery,
        attachment: attachment ? { name: attachment.name, type: attachment.type } : undefined,
      },
      { role: "agent", id: agentTurnId, status: "loading", visibleSteps: 0 },
    ]);
    setInput("");
    setPendingFile(null);

    const timer = setInterval(() => {
      setTurns((prev) =>
        prev.map((t) =>
          t.role === "agent" && t.id === agentTurnId && t.visibleSteps < LOADING_STEPS.length - 1
            ? { ...t, visibleSteps: t.visibleSteps + 1 }
            : t
        )
      );
    }, 600);
    stepTimers.current.set(agentTurnId, timer);

    runAgent(displayQuery, remainingBudget, attachment, readerId)
      .then((res) => {
        // Compute updated turns outside the setter so we can call
        // onSessionUpdate after the state update without triggering
        // the "setState during render" warning.
        setTurns((prev) => {
          const updated = prev.map((t) =>
            t.role === "agent" && t.id === agentTurnId
              ? {
                  ...t,
                  status: "done" as const,
                  summary: res.summary,
                  citations: res.citations,
                  spent: res.total_paid,
                }
              : t
          );
          const newSpent = Math.round((totalSpent + res.total_paid) * 1000) / 1000;
          // Defer parent state update to after React finishes this render cycle
          setTimeout(() => onSessionUpdate?.(serializeTurns(updated), newSpent), 0);
          return updated;
        });
        setTotalSpent((prev) => {
          const next = Math.round((prev + res.total_paid) * 1000) / 1000;
          onSpentChange?.(next);
          return next;
        });
      })
      .catch(() => {
        setTurns((prev) => {
          const updated = prev.map((t) =>
            t.role === "agent" && t.id === agentTurnId
              ? { ...t, status: "error" as const, errorMessage: "The agent couldn't complete this research. Try again." }
              : t
          );
          // Defer here too for consistency
          setTimeout(() => onSessionUpdate?.(serializeTurns(updated), totalSpent), 0);
          return updated;
        });
      })
      .finally(() => {
        const activeTimer = stepTimers.current.get(agentTurnId);
        if (activeTimer) {
          clearInterval(activeTimer);
          stepTimers.current.delete(agentTurnId);
        }
      });
  }

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      {/* Session status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-secondary/40">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wide">
            griot agent
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          ${remainingBudget.toFixed(3)} of ${sessionBudget.toFixed(2)} remaining
        </span>
      </div>

      {/* Message history */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-4 px-4 py-5 overflow-y-auto"
        style={{ minHeight: 320, maxHeight: "calc(100vh - 280px)" }}
      >
        {turns.length === 0 && (
          <p className="font-body text-sm text-muted-foreground/50 text-center py-10">
            Ask a question to start. Context carries across follow-ups until your budget runs out.
          </p>
        )}

        {turns.map((turn) => {
          if (turn.role === "user") {
            return (
              <div key={turn.id} className="flex justify-end">
                <div className="max-w-[80%] flex flex-col gap-1 items-end">
                  {turn.attachment && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/40">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-muted-foreground/50 shrink-0">
                        <path d="M2 1h5l2.5 2.5V10H2V1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                        <path d="M7 1v3h2.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                      </svg>
                      <span className="font-mono text-[9px] text-muted-foreground/50 truncate max-w-[120px]">
                        {turn.attachment.name}
                      </span>
                    </div>
                  )}
                  {turn.content && turn.content !== `[Attached: ${turn.attachment?.name}]` && (
                    <div className="rounded-2xl rounded-tr-sm bg-accent/15 border border-accent/20 px-3.5 py-2.5">
                      <p className="font-body text-sm text-foreground">{turn.content}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={turn.id} className="flex flex-col gap-2.5 max-w-[92%]">
              {turn.status === "loading" && (
                <div className="flex flex-col gap-1">
                  {LOADING_STEPS.slice(0, turn.visibleSteps + 1).map((step, i) => (
                    <p
                      key={step}
                      className="font-mono text-[11px] text-muted-foreground/40 animate-in fade-in slide-in-from-bottom-1"
                      style={{ opacity: i === turn.visibleSteps ? 0.6 : 0.25 }}
                    >
                      {step}
                    </p>
                  ))}
                </div>
              )}

              {turn.status === "error" && (
                <p className="font-body text-sm text-destructive/70">{turn.errorMessage}</p>
              )}

              {turn.status === "done" && (
                <div className="flex flex-col gap-2.5">
                  <p className="font-body text-sm text-foreground leading-relaxed">
                    {turn.summary}
                  </p>

                  {turn.citations && turn.citations.length === 0 && (
                    <p className="font-body text-xs text-muted-foreground/40">
                      No registered sources cited.
                    </p>
                  )}

                  {turn.citations && turn.citations.length > 0 && (
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      {turn.citations.map((citation, i) => (
                        <CitationCard key={citation.url} citation={citation} index={i + 1} />
                      ))}
                    </div>
                  )}

                  {typeof turn.spent === "number" && turn.spent > 0 && (
                    <p className="font-mono text-[9px] text-muted-foreground/30">
                      ${turn.spent.toFixed(3)} paid to creators
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending file preview */}
      {pendingFile && (
        <div className="px-3 pb-1 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/50 text-muted-foreground/60">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
              <path d="M2 1h5l2.5 2.5V10H2V1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              <path d="M7 1v3h2.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
            </svg>
            <span className="font-mono text-[9px] truncate max-w-[160px]">{pendingFile.name}</span>
          </div>
          <button
            type="button"
            onClick={removePendingFile}
            className="font-mono text-[9px] text-muted-foreground/40 hover:text-destructive/60 transition-colors"
          >
            remove
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="border-t border-border/50 px-3 py-2.5 flex gap-2 items-center bg-secondary/20">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.md,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAgentBusy || remainingBudget <= 0}
          title="Attach image or document"
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-20 shrink-0"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12.5 8.5V11.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V8.5M7.5 1.5v8M4.5 4.5l3-3 3 3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={
            remainingBudget <= 0
              ? "Session budget exhausted"
              : pendingFile
              ? "Add a message or send the file alone..."
              : "Ask a follow-up question..."
          }
          disabled={isAgentBusy || remainingBudget <= 0}
          className="font-body flex-1 px-3 py-2 rounded-lg bg-background border border-border/60 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring/50 text-sm disabled:opacity-40"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="font-body px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
