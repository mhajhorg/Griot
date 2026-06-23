'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function WalletButton() {
  return (
    <div className="flex items-center justify-center">
      <ConnectButton
        label="Connect Wallet"
        showBalance={{
          smallScreen: false,
          largeScreen: true,
        }}
        accountStatus="avatar"
        chainStatus="icon"
      />
    </div>
  );
}
