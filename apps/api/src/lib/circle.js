/**
 * Circle Developer-Controlled Wallets helper (replaces privy.js).
 *
 * Uses the official @circle-fin/developer-controlled-wallets SDK. Circle handles
 * ABI encoding for you — you pass a plain function signature + string params,
 * no manual calldata building needed.
 *
 * Environment variables needed:
 *   CIRCLE_API_KEY=...
 *   CIRCLE_ENTITY_SECRET=...
 *   CIRCLE_WALLET_SET_ID=...   (wallets are created inside a wallet set)
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const BLOCKCHAIN = 'ARC-TESTNET';
const TERMINAL_STATES = ['COMPLETE', 'CONFIRMED', 'FAILED', 'CANCELLED', 'DENIED'];
const FAILURE_STATES = ['FAILED', 'CANCELLED', 'DENIED'];

let _client;
function getClient() {
  if (!_client) {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    if (!apiKey || !entitySecret) {
      throw new Error('Circle not configured (missing CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET)');
    }
    _client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  }
  return _client;
}

/**
 * Create a new wallet for a creator or reader (invisible to them).
 * @returns {Promise<{success:boolean, walletId?:string, address?:string, error?:string}>}
 */
export async function createEmbeddedWallet() {
  try {
    const client = getClient();
    const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
    if (!walletSetId) {
      return { success: false, error: 'CIRCLE_WALLET_SET_ID not configured' };
    }

    const response = await client.createWallets({
      accountType: 'EOA',
      blockchains: [BLOCKCHAIN],
      walletSetId,
      count: 1,
    });

    const wallet = response.data.wallets[0];
    return { success: true, walletId: wallet.id, address: wallet.address };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function waitForTransaction(client, id, { timeoutMs = 30000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await client.getTransaction({ id });
    const tx = res.data.transaction;
    if (TERMINAL_STATES.includes(tx.state)) return tx;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timed out waiting for transaction confirmation');
}

/**
 * Executes a smart contract call from a Circle-managed wallet, waits for it to
 * land on-chain, and returns the tx hash.
 * @param {string} walletId - Circle wallet ID of the signer
 * @param {string} contractAddress
 * @param {string} abiFunctionSignature - e.g. "approve(address,uint256)"
 * @param {string[]} abiParameters - stringified params, e.g. ["0x...", "500000"]
 */
export async function sendContractCall(walletId, contractAddress, abiFunctionSignature, abiParameters) {
  try {
    const client = getClient();
    const response = await client.createContractExecutionTransaction({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    });

    const tx = await waitForTransaction(client, response.data.id);
    if (FAILURE_STATES.includes(tx.state)) {
      return { success: false, error: tx.errorReason || `Transaction ${tx.state}` };
    }
    return { success: true, tx_hash: tx.txHash };
  } catch (err) {
    // Circle's actual validation error lives in err.response.data, not err.message —
    // the generic axios message ("Request failed with status code 400") hides it.
    const circleError = err.response?.data;
    console.error('[circle] sendContractCall failed. Circle response body:', circleError || '(no response body)');
    console.error('[circle] sendContractCall request was:', { walletId, contractAddress, abiFunctionSignature, abiParameters });
    return {
      success: false,
      error: circleError ? JSON.stringify(circleError) : err.message,
    };
  }
}

/**
 * Send a USDC transfer from a Circle-managed wallet, via a direct ERC20
 * transfer() contract call (per Circle's own documented pattern for Arc).
 * @param {string} walletId
 * @param {string} destinationAddress
 * @param {string|number} amount - human-readable USDC amount, e.g. "0.02"
 */
export async function transferUsdcFromWallet(walletId, destinationAddress, amount) {
  const usdcAddress = process.env.ARC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000';
  const atomicAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString();
  return sendContractCall(walletId, usdcAddress, 'transfer(address,uint256)', [destinationAddress, atomicAmount]);
}

/**
 * Reads a Circle wallet's USDC balance.
 * @returns {Promise<string>} human-readable USDC amount, e.g. "1.5"
 */
export async function getWalletUsdcBalance(walletId) {
  try {
    const client = getClient();
    const response = await client.getWalletTokenBalance({ id: walletId });
    const usdc = response.data.tokenBalances?.find((t) => t.token.symbol === 'USDC');
    return usdc ? usdc.amount : '0';
  } catch {
    return '0';
  }
}
