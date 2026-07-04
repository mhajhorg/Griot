"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { PaymentEvent } from "@/types";

interface Notification {
  id: string;
  amount_usdc: number;
  tx_hash: string | null;
  created_at: string;
  read: boolean;
}

interface NotificationCenterProps {
  walletAddress: string;
  mockMode?: boolean;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fakeTxHash(): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out;
}

export function NotificationCenter({
  walletAddress,
  mockMode = false,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isFirstMock = useRef(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mock mode: simulate incoming payments
  useEffect(() => {
    if (!mockMode) return;

    function pushNotification() {
      const amount = Math.round((0.005 + Math.random() * 0.045) * 1000) / 1000;
      const notif: Notification = {
        id: `notif-${Date.now()}`,
        amount_usdc: amount,
        tx_hash: fakeTxHash(),
        created_at: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => [notif, ...prev].slice(0, 50));

      // Don't toast the seed notification on page load
      if (!isFirstMock.current) {
        toast.success(`You just earned $${amount.toFixed(3)}`, {
          description: "An AI agent cited your work.",
        });
      }
      isFirstMock.current = false;
    }

    // Seed one immediately
    pushNotification();

    const interval = setInterval(pushNotification, 8000 + Math.random() * 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode]);

  // Real mode: Supabase Realtime
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (mockMode) return;

    const supabase = createClient();
    const channel = supabase
      .channel("griot_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "griot_payments",
          filter: `creator_wallet=eq.${walletAddress}`,
        },
        (payload: { new: PaymentEvent }) => {
          const p = payload.new;
          const notif: Notification = {
            id: p.id,
            amount_usdc: p.amount_usdc,
            tx_hash: p.gateway_tx,
            created_at: p.created_at,
            read: false,
          };
          setNotifications((prev) => [notif, ...prev].slice(0, 50));
          toast.success(`You just earned $${p.amount_usdc.toFixed(3)}`, {
            description: "An AI agent cited your work.",
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockMode, walletAddress]);

  function handleOpen() {
    setOpen((prev) => !prev);
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <path
            d="M8 1.5A4.5 4.5 0 0 0 3.5 6v3.5l-1 1.5h11l-1-1.5V6A4.5 4.5 0 0 0 8 1.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M6.5 11.5a1.5 1.5 0 0 0 3 0"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent text-accent-foreground font-mono text-[10px] font-semibold px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-heading text-sm font-semibold text-foreground">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="font-body text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="font-body text-sm text-muted-foreground">
                  No notifications yet.
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  You&apos;ll see a notification here every time an AI agent
                  cites your work.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${
                    !notif.read ? "bg-accent/5" : ""
                  }`}
                >
                  {/* Unread dot */}
                  <div className="mt-1 shrink-0">
                    {!notif.read ? (
                      <span className="block h-2 w-2 rounded-full bg-accent" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-foreground">
                      You earned{" "}
                      <span className="text-accent font-medium">
                        ${notif.amount_usdc.toFixed(3)}
                      </span>
                    </p>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                      An AI agent cited your work
                    </p>
                    {notif.tx_hash && (
                      <a
                        href={`https://testnet.arcscan.app/tx/${notif.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent hover:underline mt-0.5 block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {notif.tx_hash.slice(0, 8)}...{notif.tx_hash.slice(-4)} ↗
                      </a>
                    )}
                  </div>

                  <span className="font-body text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                    {relativeTime(notif.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
