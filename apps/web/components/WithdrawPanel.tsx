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
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);

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
    setSuccessTxHash(null);

    try {
      const result = await withdrawEarnings(walletAddress, destinationAddress.trim(), parsedAmount);
      if (!result.success) {
        throw new Error("Backend responded but withdrawal was not successful");
      }
      setSuccessTxHash(result.tx_hash);
      setDestinationAddress("");
      setAmount("");
    } catch (err) {
      console.error("Withdrawal failed:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Withdrawal failed: ${message}`);
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
            setSuccessTxHash(null);
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
          {successTxHash && (
            <p className="font-body text-xs text-accent">
              Withdrawal submitted —{" "}
              <a
                href={`https://testnet.arcscan.app/tx/${successTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                view on Arcscan ({successTxHash.slice(0, 10)}...{successTxHash.slice(-4)})
              </a>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !destinationAddress.trim() || !amount}
            className="font-body w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Confirm withdrawal"}
          </button>
        </form>
      )}
    </div>
  );
}
