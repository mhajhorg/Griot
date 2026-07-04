"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentEvent } from "@/types";

// PaymentFeed is a visual-only feed — it displays payments as a live list
// with a glow animation on new arrivals. Notification toasts + bell icon
// are handled exclusively by NotificationCenter in the nav to avoid
// duplicate toasts when both components are on the same page.

interface PaymentFeedProps {
  walletAddress?: string;
  mockMode?: boolean;
  maxVisible?: number;
}

const MOCK_PAYERS = ["agent", "research bot", "citation agent"];

function fakeTxHash(): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function PaymentFeed({
  walletAddress,
  mockMode = false,
  maxVisible = 20,
}: PaymentFeedProps) {
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [newestId, setNewestId] = useState<string | null>(null);

  // ---------- mock mode ----------
  useEffect(() => {
    if (!mockMode) return;

    function pushMockPayment() {
      const id = `mock-${Date.now()}`;
      const amount = Math.round((0.005 + Math.random() * 0.045) * 1000) / 1000;
      const payment: PaymentEvent = {
        id,
        registry_id: null,
        content_id: fakeTxHash().slice(0, 42),
        endpoint: "https://griot.xyz/read/mock-article",
        payer: MOCK_PAYERS[Math.floor(Math.random() * MOCK_PAYERS.length)],
        creator_wallet: walletAddress ?? `0x${Math.random().toString(16).slice(2, 10)}...`,
        amount_usdc: amount,
        network: "eip155:5042002",
        gateway_tx: fakeTxHash(),
        created_at: new Date().toISOString(),
      };
      setPayments((prev) => [payment, ...prev].slice(0, 20));
      setNewestId(id);
      setTimeout(() => setNewestId(null), 1500);
    }

    pushMockPayment(); // seed immediately
    const interval = setInterval(pushMockPayment, 8000 + Math.random() * 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode, walletAddress]);

  // ---------- real mode: Supabase Realtime ----------
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (mockMode) return;

    const supabase = createClient();
    const channel = supabase
      .channel("griot_payments_feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "griot_payments",
          ...(walletAddress ? { filter: `creator_wallet=eq.${walletAddress}` } : {}),
        },
        (payload: { new: PaymentEvent }) => {
          setPayments((prev) => [payload.new, ...prev].slice(0, 20));
          setNewestId(payload.new.id);
          setTimeout(() => setNewestId(null), 1500);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode, walletAddress]);

  if (payments.length === 0) {
    return <p className="font-body text-sm text-muted-foreground">No payments yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {payments.slice(0, maxVisible).map((payment) => (
        <div
          key={payment.id}
          className={`font-body text-sm text-foreground px-3 py-2 rounded-md transition-shadow duration-1000 ${
            newestId === payment.id ? "glow-accent bg-accent/5" : "bg-card"
          }`}
        >
          <span className="text-accent font-medium">
            ${payment.amount_usdc.toFixed(3)}
          </span>
          <span className="text-muted-foreground"> · from {payment.payer} · tx: </span>
          {payment.gateway_tx ? (
            <a
              href={`https://testnet.arcscan.app/tx/${payment.gateway_tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-accent hover:underline"
            >
              {payment.gateway_tx.slice(0, 8)}...{payment.gateway_tx.slice(-4)}
            </a>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">pending</span>
          )}
          <span className="text-muted-foreground"> · {relativeTime(payment.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
