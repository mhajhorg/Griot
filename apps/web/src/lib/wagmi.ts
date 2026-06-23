import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
import {
  mainnet,
  sepolia,
} from 'wagmi/chains';

/**
 * Arc Testnet configuration for Griot
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

/**
 * Wagmi config for Griot
 * Configured for Arc Testnet with fallback to Sepolia
 */
export const wagmiConfig = getDefaultConfig({
  appName: 'Griot',
  projectId: 'e7c9f1a3c8d2b4f6h9k1l2m3n4o5p6q7',
  chains: [arcTestnet, sepolia, mainnet],
  ssr: true,
});
