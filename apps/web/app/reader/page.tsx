"use client";

import { useEffect, useState } from "react";
import { AgentChat } from "@/components/AgentChat";
import { FundingGuide } from "@/components/FundingGuide";
import { HistorySidebar } from "@/components/HistorySidebar";
import { useGriotStore } from "@/lib/store";
import { useSessionHistory } from "@/lib/useSessionHistory";
import { useReaderSession } from "@/lib/useReaderSession";
import { approveReaderBudget } from "@/lib/api";
import type { ChatSession, StoredTurn } from "@/lib/useSessionHistory";

function newSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function titleFromFirstMessage(turns: StoredTurn[]): string {
  const first = turns.find((t) => t.role === "user");
  if (!first?.content) return "New session";
  return first.content.length > 48
    ? first.content.slice(0, 48).trimEnd() + "..."
    : first.content;
}

export default function ReaderPage() {
  const { agentBudget, setAgentBudget } = useGriotStore();
  const { sessions, saveSession, deleteSession } = useSessionHistory();
  const {
    session: readerSession,
    loading: sessionLoading,
    login,
    loggingIn,
    loginError,
    logout,
    balance,
    refreshBalance,
    startPolling,
    stopPolling,
  } = useReaderSession();

  const [email, setEmail] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const hasEnoughBalance = balance >= agentBudget;
  const showChat = activeSessionId !== null;

  // Returning reader with existing balance covering this budget can skip
  // the deposit/approve dance entirely and go straight to chatting.
  useEffect(() => {
    if (readerSession && !readerSession.is_new && hasEnoughBalance) {
      setApproved(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerSession, balance]);

  // Poll for balance automatically while waiting for a deposit to land.
  useEffect(() => {
    if (readerSession && !approved) {
      startPolling();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerSession, approved]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await login(email.trim());
  }

  function handleLogout() {
    logout();
    setApproved(false);
    setEmail("");
  }

  function handleCopyAddress() {
    if (!readerSession) return;
    navigator.clipboard.writeText(readerSession.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCheckBalance() {
    await refreshBalance();
  }

  async function handleApprove() {
    if (!readerSession || !hasEnoughBalance) return;
    setApproving(true);
    setApproveError(null);
    try {
      const result = await approveReaderBudget(readerSession.reader_id, agentBudget);
      if (result.success) {
        setApproved(true);
        stopPolling();
      } else {
        setApproveError("Approval failed. Try again.");
      }
    } catch {
      setApproveError("Approval failed. Try again.");
    } finally {
      setApproving(false);
    }
  }

  function handleNewSession() {
    if (!approved) return;
    const id = newSessionId();
    const session: ChatSession = {
      id,
      title: "New session",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      turns: [],
      totalSpent: 0,
    };
    saveSession(session);
    setActiveSessionId(id);
    setChatKey((k) => k + 1);
  }

  function handleSelectSession(session: ChatSession) {
    setActiveSessionId(session.id);
    setChatKey((k) => k + 1);
  }

  function handleDeleteSession(id: string) {
    deleteSession(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setChatKey((k) => k + 1);
    }
  }

  function handleSessionUpdate(turns: StoredTurn[], totalSpent: number) {
    if (!activeSessionId) return;
    const existing = sessions.find((s) => s.id === activeSessionId);
    const updatedSession: ChatSession = {
      id: activeSessionId,
      title: titleFromFirstMessage(turns),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      turns,
      totalSpent,
    };
    saveSession(updatedSession);
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <HistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={handleSelectSession}
        onDelete={handleDeleteSession}
        onNew={handleNewSession}
      />

      <main className="flex-1 overflow-y-auto px-6 py-8 min-w-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between mb-1">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Research with Griot
            </h1>
            {readerSession && (
              <button
                type="button"
                onClick={handleLogout}
                className="font-body text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                Log out
              </button>
            )}
          </div>
          <p className="font-body text-muted-foreground text-sm mb-6">
            Chat with the research agent. It finds sources, pays registered
            creators, and cites them with proof.
          </p>

          <FundingGuide />

          {sessionLoading ? (
            <div className="rounded-lg border border-border bg-card p-5 mb-6">
              <p className="font-body text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : !readerSession ? (
            /* ---------- Step 1: email login ---------- */
            <div className="rounded-lg border border-border bg-card p-5 mb-6">
              <p className="font-body text-sm text-foreground mb-1">
                Enter your email to start
              </p>
              <p className="font-body text-xs text-muted-foreground mb-4">
                First time gets you a new wallet. Returning? We'll pick up
                right where you left off, balance and all.
              </p>
              <form onSubmit={handleLogin} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={loggingIn}
                  className="font-body flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <button
                  type="submit"
                  disabled={loggingIn || !email.trim()}
                  className="font-body px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loggingIn ? "Logging in..." : "Continue"}
                </button>
              </form>
              {loginError && (
                <p className="font-body text-destructive text-xs mt-2">{loginError}</p>
              )}
            </div>
          ) : !approved ? (
            /* ---------- Step 2: deposit + approve ---------- */
            <div className="rounded-lg border border-border bg-card p-5 mb-6 flex flex-col gap-4">
              <div>
                <p className="font-body text-sm text-foreground mb-1">
                  {readerSession.is_new ? "Fund your research session" : "Top up your balance"}
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Send testnet USDC to the address below. Once it lands, set
                  your budget and approve to start chatting — no wallet popup,
                  this is handled for you.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-foreground bg-secondary px-3 py-2 rounded-md flex-1 truncate">
                  {readerSession.wallet_address}
                </code>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="font-body text-xs px-3 py-2 rounded-md border border-border hover:border-accent transition-colors text-foreground whitespace-nowrap"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="flex items-center justify-between px-1">
                <p className="font-body text-xs text-muted-foreground">
                  Balance:{" "}
                  <span className="font-mono text-foreground">
                    ${Number(balance).toFixed(3)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleCheckBalance}
                  className="font-body text-xs text-accent hover:underline"
                >
                  Refresh balance
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-body text-sm text-muted-foreground whitespace-nowrap">
                  Session budget
                </label>
                <span className="font-body text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={agentBudget}
                  onChange={(e) => setAgentBudget(parseFloat(e.target.value) || 0)}
                  className="font-body w-24 px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <span className="font-body text-sm text-muted-foreground">USDC</span>
              </div>

              {!hasEnoughBalance && (
                <p className="font-body text-xs text-destructive">
                  Balance too low for this budget — send more USDC or lower the budget.
                </p>
              )}

              {approveError && (
                <p className="font-body text-xs text-destructive">{approveError}</p>
              )}

              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !hasEnoughBalance}
                className="font-body w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approving ? "Approving..." : "Approve and start"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="font-body text-xs text-muted-foreground">
                Session budget:{" "}
                <span className="font-mono text-foreground">
                  ${agentBudget.toFixed(2)}
                </span>
                {" · "}
                Balance: <span className="font-mono text-foreground">${Number(balance).toFixed(3)}</span>
              </p>
            </div>
          )}

          {approved && (
            <>
              {!showChat ? (
                <div className="rounded-lg border border-border bg-card px-4 py-12 text-center flex flex-col items-center gap-4">
                  <p className="font-body text-sm text-muted-foreground">
                    Start a new session or pick one from your history.
                  </p>
                  <button
                    type="button"
                    onClick={handleNewSession}
                    className="font-body px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    New session
                  </button>
                </div>
              ) : (
                <AgentChat
                  key={chatKey}
                  sessionBudget={agentBudget}
                  readerId={readerSession?.reader_id}
                  initialTurns={activeSession?.turns}
                  initialSpent={activeSession?.totalSpent ?? 0}
                  onSessionUpdate={handleSessionUpdate}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
