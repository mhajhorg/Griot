"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { AgentChat } from "@/components/AgentChat";
import { FundingGuide } from "@/components/FundingGuide";
import { HistorySidebar } from "@/components/HistorySidebar";
import { useGriotStore } from "@/lib/store";
import { useSessionHistory } from "@/lib/useSessionHistory";
import type { ChatSession, StoredTurn } from "@/lib/useSessionHistory";

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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
  const { address, isConnected } = useAccount();
  const { agentBudget, setAgentBudget } = useGriotStore();
  const { sessions, saveSession, deleteSession } = useSessionHistory();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0); // force remount on new/switch session

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const { data: rawBalance } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const usdcBalance = rawBalance ? parseFloat(formatUnits(rawBalance, 6)) : 0;
  const hasEnoughBalance = isConnected && usdcBalance >= agentBudget;

  function handleNewSession() {
    // Don't allow starting a session without a connected wallet and balance
    if (!isConnected || !hasEnoughBalance) return;
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

  // Start a default session automatically if none is active and there's no history
  const showChat = activeSessionId !== null;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <HistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={handleSelectSession}
        onDelete={handleDeleteSession}
        onNew={handleNewSession}
      />

      {/* Main area */}
      <main className="flex-1 overflow-y-auto px-6 py-8 min-w-0">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-heading text-2xl font-semibold text-foreground mb-1">
            Research with Griot
          </h1>
          <p className="font-body text-muted-foreground text-sm mb-6">
            Chat with the research agent. It finds sources, pays registered
            creators, and cites them with proof.
          </p>

          <FundingGuide />

          {!isConnected ? (
            <div className="rounded-lg border border-border bg-card p-5 mb-6">
              <p className="font-body text-sm text-foreground mb-1">
                Connect to fund your research session
              </p>
              <p className="font-body text-xs text-muted-foreground">
                The agent uses your balance to pay creators when it cites their
                work. For this testnet build, connect a wallet with testnet USDC
                on Arc Testnet (available from the Arc faucet) to get started.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="font-body text-xs text-muted-foreground">
                Available balance:{" "}
                <span className="font-mono text-foreground">
                  ${usdcBalance.toFixed(3)}
                </span>
              </p>
              {!hasEnoughBalance && (
                <p className="font-body text-xs text-destructive">
                  Not enough balance for this budget
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mb-6">
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
              disabled={showChat}
              className="font-body w-24 px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm disabled:opacity-50"
            />
            <span className="font-body text-sm text-muted-foreground">USDC</span>
          </div>

          {!showChat || !isConnected || !hasEnoughBalance ? (
            <div className="rounded-lg border border-border bg-card px-4 py-12 text-center flex flex-col items-center gap-4">
              <p className="font-body text-sm text-muted-foreground">
                {!isConnected
                  ? "Connect to start chatting with the agent."
                  : !hasEnoughBalance
                  ? "Add more balance or lower the session budget to continue."
                  : "Start a new session or pick one from your history."}
              </p>
              {isConnected && hasEnoughBalance && (
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="font-body px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  New session
                </button>
              )}
            </div>
          ) : (
            <AgentChat
              key={chatKey}
              sessionBudget={agentBudget}
              initialTurns={activeSession?.turns}
              initialSpent={activeSession?.totalSpent ?? 0}
              onSessionUpdate={handleSessionUpdate}
            />
          )}
        </div>
      </main>
    </div>
  );
}
