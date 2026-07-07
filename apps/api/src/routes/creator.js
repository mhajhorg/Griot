import { Router } from 'express';
import { getDb } from '../supabase.js';
import { transferUsdcFromWallet } from '../lib/circle.js';

export const creatorRouter = Router();

/**
 * POST /api/creator/withdraw
 * Body: { from_wallet, to_address, amount }
 * Response: { success, tx_hash }
 *
 * from_wallet is the creator's wallet ADDRESS (as stored on their creator record) —
 * we look up the matching Circle wallet ID internally since Circle's API needs
 * the wallet ID, not the address.
 */
creatorRouter.post('/withdraw', async (req, res) => {
  try {
    const { from_wallet, to_address, amount } = req.body;
    if (!from_wallet || !to_address || !amount) {
      return res.status(400).json({ error: 'Missing fields: from_wallet, to_address, amount' });
    }

    const db = await getDb();
    const creator = await db.findCreatorByWallet(from_wallet);
    if (!creator) {
      return res.status(404).json({ error: 'No creator found for this wallet address' });
    }

    const walletId = creator.wallet_id;
    if (!walletId) {
      return res.status(500).json({ error: 'Creator record is missing a Circle wallet ID — was this wallet created via Circle?' });
    }

    const result = await transferUsdcFromWallet(walletId, to_address, amount);
    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }

    res.json({ success: true, tx_hash: result.tx_hash });
  } catch (err) {
    console.error('[withdraw] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
