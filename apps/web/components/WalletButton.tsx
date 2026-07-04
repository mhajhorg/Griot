"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!ready) {
          return (
            <button
              className="font-body px-4 py-2 rounded-md bg-secondary text-muted-foreground text-sm opacity-50"
              aria-hidden
            >
              Loading...
            </button>
          );
        }

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              type="button"
              className="font-body px-5 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              className="font-body px-5 py-2.5 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Wrong network
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            type="button"
            className="font-body flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card text-foreground text-sm hover:border-accent transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-accent glow-accent" />
            <span className="font-mono">
              {account.displayName}
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
