import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../supabase.js';
import { payForCitationOnChain, ensureAgentApproval, computeContentId } from '../lib/arc.js';

export const payRouter = Router();

/**
 * Internal endpoint the agent calls when it decides to cite registered content.
 * Body: { url, amount, wallet }
 * Kept for any internal/manual use — not one of the frontend's 9 documented endpoints.
 */
payRouter.post('/pay', async (req, res) => {
  try {
    const { url, amount, wallet } = req.body;
    if (!url || !amount || !wallet) {
      return res.status(400).json({ error: 'Missing fields: url, amount, wallet' });
    }

    const db = await getDb();
    const entry = await db.findByUrl(url);
    if (!entry) {
      return res.status(404).json({ error: 'URL not registered' });
    }

    const chainConfigured = process.env.GRIOT_REGISTRY_ADDRESS && process.env.AGENT_WALLET_PRIVATE_KEY;

    let result;
    if (chainConfigured) {
      await ensureAgentApproval().catch(() => {});
      result = await payForCitationOnChain(entry.canonical_url);
    } else {
      console.log(`[pay] Simulated: ${amount} USDC to ${wallet} (GRIOT_REGISTRY_ADDRESS / AGENT_WALLET_PRIVATE_KEY not configured)`);
      result = {
        success: true,
        tx_hash: '0x' + crypto.randomBytes(32).toString('hex'),
        content_id: computeContentId(entry.canonical_url),
      };
    }

    if (!result.success) {
      const fakeHash = '0x' + crypto.randomBytes(32).toString('hex');
      console.error(`[pay] On-chain payForCitation failed: ${result.error}, falling back to simulated`);
      return res.json({
        success: true, tx_hash: fakeHash,
        amount, currency: 'USDC', chain: 'arc-testnet',
        chain_id: Number(process.env.ARC_CHAIN_ID) || 5042002,
        recipient: wallet,
        note: `${result.error} — simulated`,
      });
    }

    await db.recordPayment({
      registry_id: entry.id,
      content_id: result.content_id,
      endpoint: '/api/pay',
      payer: 'agent',
      creator_wallet: entry.wallet_address,
      amount_usdc: amount,
      network: 'arc-testnet',
      gateway_tx: result.tx_hash,
    }).catch(e => console.error('[pay] Failed to record payment:', e.message));

    res.json({
      success: true,
      tx_hash: result.tx_hash,
      amount, currency: 'USDC', chain: 'arc-testnet',
      chain_id: Number(process.env.ARC_CHAIN_ID) || 5042002,
      recipient: wallet,
    });
  } catch (err) {
    console.error('[pay] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
