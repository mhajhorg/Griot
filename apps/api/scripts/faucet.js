#!/usr/bin/env node

/**
 * Circle faucet helper — get testnet USDC on Arc Testnet.
 *
 * Usage:
 *   node scripts/faucet.js create     <username>    — Create a new wallet
 *   node scripts/faucet.js balance    <walletId>     — Check USDC balance
 *   node scripts/faucet.js transfer   <toAddress> <amount> — Send USDC
 *   node scripts/faucet.js claim      <walletId>     — Claim testnet USDC from faucet
 *
 * Requires .env with:
 *   CIRCLE_API_KEY=...
 *   CIRCLE_ENTITY_SECRET=...
 *   CIRCLE_WALLET_SET_ID=...
 */

import 'dotenv/config';

const API_BASE = 'https://api.circle.com/v1/w3s';
const USDC_CONTRACT = process.env.USDC_CONTRACT || '0x3600000000000000000000000000000000000000';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case 'create': {
      const [username] = args;
      if (!username) throw new Error('Usage: faucet.js create <username>');

      const resp = await fetch(`${API_BASE}/wallets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idempotencyKey: `${username}-${Date.now()}`,
          entitySecretCipherText: process.env.CIRCLE_ENTITY_SECRET,
          walletSetId: process.env.CIRCLE_WALLET_SET_ID,
          blockchains: ['ARC-TESTNET'],
          count: 1,
        }),
      });

      const data = await resp.json();
      const wallet = data.data?.wallets?.[0];
      if (wallet) {
        console.log(`✅ Wallet created:`);
        console.log(`   ID:      ${wallet.id}`);
        console.log(`   Address: ${wallet.address}`);
        console.log(`   Owner:   ${username}`);
      } else {
        console.error('❌ Failed:', JSON.stringify(data, null, 2));
      }
      break;
    }

    case 'balance': {
      const [walletId] = args;
      if (!walletId) throw new Error('Usage: faucet.js balance <walletId>');

      const resp = await fetch(`${API_BASE}/wallets/${walletId}/balances`, { headers });
      const data = await resp.json();

      const usdc = data.data?.tokenBalances?.find(
        t => t.token.address?.toLowerCase() === USDC_CONTRACT.toLowerCase()
      );

      console.log(`💰 Balance:`);
      console.log(`   USDC: ${usdc?.amount || '0'} (${usdc?.token?.name || 'USDC'})`);
      console.log(`   Chain: ARC-TESTNET`);
      break;
    }

    case 'transfer': {
      const [toAddress, amount] = args;
      if (!toAddress || !amount) throw new Error('Usage: faucet.js transfer <toAddress> <amount>');

      const atomicAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString();

      const resp = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idempotencyKey: `transfer-${Date.now()}`,
          entitySecretCipherText: process.env.CIRCLE_ENTITY_SECRET,
          walletId: process.env.CIRCLE_AGENT_WALLET_ID,
          destinationAddress: toAddress,
          amounts: [atomicAmount],
          fee: { type: 'gasless' },
          tokenId: USDC_CONTRACT,
        }),
      });

      const data = await resp.json();
      const tx = data.data;
      if (tx) {
        console.log(`✅ Transfer sent:`);
        console.log(`   TX:      ${tx.transactionHash}`);
        console.log(`   Amount:  ${amount} USDC`);
        console.log(`   To:      ${toAddress}`);
      } else {
        console.error('❌ Failed:', JSON.stringify(data, null, 2));
      }
      break;
    }

    case 'claim': {
      const [walletId] = args;
      if (!walletId) throw new Error('Usage: faucet.js claim <walletId>');

      // Arc Testnet USDC faucet
      const faucetResp = await fetch('https://faucet.testnet.arc.network/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletId,
          tokens: ['USDC'],
        }),
      });

      const faucetData = await faucetResp.json();
      console.log('🏗️  Faucet response:', JSON.stringify(faucetData, null, 2));
      break;
    }

    default:
      console.log(`
Griot Circle Wallet Helper

Commands:
  create <username>     — Create a new wallet for a user
  balance <walletId>    — Check USDC balance
  transfer <addr> <amt> — Send USDC to an address
  claim <walletId>      — Claim testnet USDC from faucet

Environment variables needed in .env:
  CIRCLE_API_KEY=...
  CIRCLE_ENTITY_SECRET=...
  CIRCLE_WALLET_SET_ID=...
  CIRCLE_AGENT_WALLET_ID=...
`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
