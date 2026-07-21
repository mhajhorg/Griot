import { getDb } from '../supabase.js';
import { createEmbeddedWallet, sendContractCall, getWalletUsdcBalance } from './circle.js';
import { getUsdcAddress, getRegistryAddress } from './arc.js';
import { runAgentQuery } from '../routes/agent.js';

// This generates REAL on-chain payments from a bot-controlled wallet, purely
// to keep beta-testing creators seeing live activity (citations, payments,
// notifications) while there aren't many real readers yet. This is synthetic
// test traffic — never present it as organic user activity/traction.

const BOT_EMAIL = process.env.ACTIVITY_BOT_EMAIL || 'griot-activity-bot@internal.griot';
const INTERVAL_MS = (parseInt(process.env.ACTIVITY_BOT_INTERVAL_MINUTES) || 15) * 60 * 1000;
const QUERY_BUDGET = parseFloat(process.env.ACTIVITY_BOT_BUDGET_USDC) || 0.1;
const APPROVE_AMOUNT_ATOMIC = '5000000'; // 5 USDC — re-approved periodically, cheap no-op if already sufficient

let botReaderCache = null;

async function ensureBotReader(db) {
  if (botReaderCache) return botReaderCache;

  let reader = await db.findReaderByEmail(BOT_EMAIL);
  if (!reader) {
    const wallet = await createEmbeddedWallet();
    if (!wallet.success) {
      console.error('[activity-bot] Could not create bot wallet:', wallet.error);
      return null;
    }
    reader = await db.createReader(BOT_EMAIL, wallet.walletId, wallet.address);
    console.log(`[activity-bot] Created new bot reader wallet: ${wallet.address}`);
    console.log(`[activity-bot] >>> FUND THIS ADDRESS with testnet USDC to enable simulated activity: ${wallet.address}`);
  }
  botReaderCache = reader;
  return reader;
}

async function ensureApproval(reader) {
  const registryAddress = getRegistryAddress();
  if (!registryAddress) return false;
  const result = await sendContractCall(
    reader.wallet_id,
    getUsdcAddress(),
    'approve(address,uint256)',
    [registryAddress, APPROVE_AMOUNT_ATOMIC],
  );
  if (!result.success) {
    console.log('[activity-bot] Approval failed:', result.error);
  }
  return result.success;
}

const QUERY_TEMPLATES = [
  (title) => `Tell me about "${title}"`,
  (title) => `What does the article "${title}" say?`,
  (title) => `Summarize "${title}" for me`,
  (title) => `I'm researching this topic: ${title}`,
  (title) => `Can you explain "${title}" in detail?`,
];

function buildQueryFromTitle(title) {
  const template = QUERY_TEMPLATES[Math.floor(Math.random() * QUERY_TEMPLATES.length)];
  return template(title);
}

async function runOnce() {
  try {
    const db = await getDb();
    const reader = await ensureBotReader(db);
    if (!reader) return;

    const balance = await getWalletUsdcBalance(reader.wallet_id);
    if (parseFloat(balance) < QUERY_BUDGET) {
      console.log(`[activity-bot] Bot wallet balance ($${balance}) too low for a $${QUERY_BUDGET} query — fund ${reader.wallet_address} to resume activity.`);
      return;
    }

    await ensureApproval(reader);

    const articles = await db.getRegistryFeed(50, 0);
    if (!articles.length) {
      console.log('[activity-bot] No registered articles yet — nothing to cite.');
      return;
    }

    const article = articles[Math.floor(Math.random() * articles.length)];
    const query = buildQueryFromTitle(article.title);

    console.log(`[activity-bot] Running query: "${query}"`);
    const result = await runAgentQuery({ query, budget_usdc: QUERY_BUDGET, reader_id: reader.id });
    console.log(`[activity-bot] Done — total_paid=$${result.total_paid}, citations=${result.citations.length}`);
  } catch (err) {
    console.error('[activity-bot] Run failed:', err.message);
  }
}

/**
 * Starts the background activity bot. Call this once at server boot, gated
 * behind an env flag (ENABLE_ACTIVITY_BOT=true) — this is entirely optional
 * and the server works fine without it.
 */
export function startActivityBot() {
  console.log(`[activity-bot] Starting — running every ${INTERVAL_MS / 60000} minute(s), budget $${QUERY_BUDGET}/query`);
  runOnce();
  setInterval(runOnce, INTERVAL_MS);
}
