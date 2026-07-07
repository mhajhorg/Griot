"use client";

// Wagmi/RainbowKit removed — Griot no longer uses MetaMask/external wallet
// connection anywhere. Both creators and readers get Circle-managed wallets
// via email, so there's nothing left for a wallet-connect provider to do.
// Kept as a pass-through in case a future provider (e.g. an auth context)
// needs a place to wrap the app.

export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
