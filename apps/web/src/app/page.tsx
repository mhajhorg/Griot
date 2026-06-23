import { WalletButton } from '@/components/WalletButton';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold font-heading text-primary">
          Connect Your Wallet
        </h1>
        <p className="text-lg text-secondary font-body">
          Test wallet connection to Arc Testnet
        </p>
        <WalletButton />
      </div>
    </div>
  );
}
