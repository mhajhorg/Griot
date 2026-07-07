import { JsonRpcProvider, Wallet, Contract, MaxUint256, solidityPackedKeccak256 } from 'ethers';

const RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const USDC_CONTRACT = process.env.ARC_USDC_ADDRESS || process.env.USDC_CONTRACT || '0x3600000000000000000000000000000000000000';
const REGISTRY_ADDRESS = process.env.GRIOT_REGISTRY_ADDRESS;

// Real ABI, from the Hardhat artifact (contracts/GriotRegistry.sol).
// Only the fragments this backend actually calls/encodes are included here —
// add more from the full artifact if you need getContent/registry/etc. later.
const REGISTRY_ABI = [
  'function registerContent(string canonicalUrl, uint256 price) external',
  'function payForCitation(bytes32 contentId) external',
  'function getContentId(string canonicalUrl) external pure returns (bytes32)',
  'function getContent(bytes32 contentId) external view returns (tuple(address creator, uint256 price, bool active))',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

let provider;
export function getProvider() {
  if (!provider) {
    provider = new JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function getDeployerWallet() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not configured');
  return new Wallet(pk, getProvider());
}

function getAgentWallet() {
  const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('AGENT_WALLET_PRIVATE_KEY not configured');
  return new Wallet(pk, getProvider());
}

export function getRegistryAddress() {
  return REGISTRY_ADDRESS;
}

export function getUsdcAddress() {
  return USDC_CONTRACT;
}

/**
 * contentId = keccak256(abi.encodePacked(canonicalUrl)) — matches the contract's
 * own getContentId(canonicalUrl) pure function, computed locally to avoid an RPC
 * round trip. (Confirmed against the real ABI: getContentId takes just the URL.)
 */
export function computeContentId(canonicalUrl) {
  return solidityPackedKeccak256(['string'], [canonicalUrl]);
}

/**
 * Calls registerContent as the DEPLOYER wallet. Kept only for local testing/dev —
 * do NOT use this for real creator content, since it would record the deployer
 * (not the creator) as the on-chain owner, and citation payouts would go to the
 * deployer instead of the creator. Real registration should go through
 * encodeRegisterContent() + a creator-owned signer (see registry.js).
 */
export async function registerContentAsDeployer(canonicalUrl, priceInUsdcUnits) {
  if (!REGISTRY_ADDRESS) {
    return { success: false, error: 'GRIOT_REGISTRY_ADDRESS not configured' };
  }
  try {
    const wallet = getDeployerWallet();
    const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
    const tx = await registry.registerContent(canonicalUrl, priceInUsdcUnits);
    const receipt = await tx.wait();
    return { success: true, tx_hash: receipt.hash };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * One-time approval so the agent wallet can let the registry contract pull its USDC.
 * Safe to call repeatedly — it's a no-op once allowance is already set.
 */
export async function ensureAgentApproval() {
  if (!REGISTRY_ADDRESS) {
    return { success: false, error: 'GRIOT_REGISTRY_ADDRESS not configured' };
  }
  try {
    const wallet = getAgentWallet();
    const usdc = new Contract(USDC_CONTRACT, ERC20_ABI, wallet);
    const current = await usdc.allowance(wallet.address, REGISTRY_ADDRESS);
    if (current > 0n) {
      return { success: true, alreadyApproved: true };
    }
    const tx = await usdc.approve(REGISTRY_ADDRESS, MaxUint256);
    const receipt = await tx.wait();
    return { success: true, tx_hash: receipt.hash };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Calls payForCitation(contentId) using the agent wallet. Assumes ensureAgentApproval()
 * has already been run at least once for this wallet. Pays out to whichever wallet
 * is recorded as `creator` in registry[contentId] — i.e. whoever called
 * registerContent originally.
 */
export async function payForCitationOnChain(canonicalUrl) {
  if (!REGISTRY_ADDRESS) {
    return { success: false, error: 'GRIOT_REGISTRY_ADDRESS not configured' };
  }
  try {
    const wallet = getAgentWallet();
    const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
    const contentId = computeContentId(canonicalUrl);
    const tx = await registry.payForCitation(contentId);
    const receipt = await tx.wait();
    return { success: true, tx_hash: receipt.hash, content_id: contentId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify a USDC transfer transaction on Arc testnet by checking ERC20 Transfer event logs.
 * Unchanged from the original implementation — still used by read.js.
 */
export async function verifyPayment(txHash, expectedAmount, expectedWallet) {
  try {
    const provider = getProvider();

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { valid: false, reason: 'Receipt not found — transaction may not be confirmed' };
    }

    if (receipt.status !== 1) {
      return { valid: false, reason: 'Transaction failed (status !== 1)' };
    }

    const expectedAddr = expectedWallet.toLowerCase();
    const expectedAtomic = BigInt(Math.round(parseFloat(expectedAmount) * 1_000_000));
    const usdcAddr = USDC_CONTRACT.toLowerCase();

    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddr) continue;
      if (log.topics[0] !== transferTopic) continue;
      const toAddress = '0x' + log.topics[2].slice(26);
      if (toAddress.toLowerCase() !== expectedAddr) continue;
      const amount = BigInt(log.data);
      if (amount < expectedAtomic) {
        return {
          valid: false,
          reason: `Amount mismatch: ${amount} < ${expectedAtomic} (USDC atomic units)`,
        };
      }
      return { valid: true };
    }

    return { valid: false, reason: 'No valid USDC Transfer event to expected recipient found' };
  } catch (err) {
    return { valid: false, reason: `RPC error: ${err.message}` };
  }
}
