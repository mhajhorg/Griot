"use client";

import { useState } from "react";
import { withdrawEarnings } from "@/lib/api";

interface WithdrawPanelProps {
  walletAddress: string;
  totalEarned: number;
}

export function WithdrawPanel({ walletAddress, totalEarned }: WithdrawPanelProps) {
  const [open, setOpen] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!destinationAddress.trim() || !parsedAmount || parsedAmount <= 0) return;
    if (parsedAmount > totalEarned) {
      setError("Amount exceeds available balance.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await withdrawEarnings(walletAddress, destinationAddress.trim(), parsedAmount);
      setSuccess(`Withdrawal submitted — tx: ${result.tx_hash.slice(0, 10)}...${result.tx_hash.slice(-4)}`);
      setDestinationAddress("");
      setAmount("");
    } catch {
      setError("Withdrawal failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (totalEarned <= 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Withdraw earnings
          </h3>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Available: ${totalEarned.toFixed(3)} USDC
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            setError(null);
            setSuccess(null);
          }}
          className="font-body text-sm px-3 py-1.5 rounded-md border border-border hover:border-accent transition-colors text-foreground"
        >
          {open ? "Cancel" : "Withdraw"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleWithdraw} className="flex flex-col gap-3">
          <div>
            <label className="font-body block text-xs text-muted-foreground mb-1">
              Destination address (Arc Testnet)
            </label>
            <input
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="0x..."
              className="font-mono w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-xs"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="font-body block text-xs text-muted-foreground mb-1">
              Amount (USDC)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-body text-sm text-muted-foreground">$</span>
              <input
                type="number"
                step="0.001"
                min="0"
                max={totalEarned}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.000"
                className="font-body w-32 px-3 py-2 rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setAmount(totalEarned.toFixed(3))}
                className="font-body text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                Max
              </button>
            </div>
          </div>

          {error && <p className="font-body text-xs text-destructive">{error}</p>}
          {success && (
            <p className="font-body text-xs text-accent">{success}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !destinationAddress.trim() || !amount}
            className="font-body w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Confirm withdrawal"}
          </button>

          <p className="font-body text-xs text-muted-foreground">
            BACKEND TODO: withdrawal is mocked — real implementation sends
            USDC from the creator&apos;s custodial wallet to the destination
            address via the Circle/Turnkey API.
          </p>
        </form>
      )}
    </div>
  );
}
