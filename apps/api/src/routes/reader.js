import { Router } from 'express';
import { getDb } from '../supabase.js';
import { createEmbeddedWallet, sendContractCall, getWalletUsdcBalance } from '../lib/circle.js';
import { getUsdcAddress, getRegistryAddress } from '../lib/arc.js';

export const readerRouter = Router();

/**
 * POST /api/reader/login
 * Body: { email }
 * Finds the reader's existing Circle wallet by email, or creates one on first
 * login. Response is the same shape either way, so the frontend doesn't need
 * to know whether this was a new signup or a returning reader.
 * Response: { reader_id, wallet_address, is_new }
 */
readerRouter.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing field: email' });
    }

    const db = await getDb();

    const existing = await db.findReaderByEmail(email);
    if (existing) {
      return res.json({ reader_id: existing.id, wallet_address: existing.wallet_address, is_new: false });
    }

    const walletResult = await createEmbeddedWallet();
    if (!walletResult.success) {
      return res.status(502).json({ error: `Could not create wallet: ${walletResult.error}` });
    }

    const reader = await db.createReader(email, walletResult.walletId, walletResult.address);

    res.status(201).json({ reader_id: reader.id, wallet_address: reader.wallet_address, is_new: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reader/:id/balance
 * Lets the frontend check current USDC balance — whether freshly funding for
 * the first time, or checking what's left over from a previous visit.
 * Response: { wallet_address, usdc_balance }
 */
readerRouter.get('/:id/balance', async (req, res) => {
  try {
    const db = await getDb();
    const reader = await db.getReader(req.params.id);
    if (!reader) return res.status(404).json({ error: 'Reader not found' });

    const usdcBalance = await getWalletUsdcBalance(reader.wallet_id);

    res.json({ wallet_address: reader.wallet_address, usdc_balance: usdcBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reader/:id/approve
 * Body: { budget_usdc }
 * Signs approve(GriotRegistry, budget) from the reader's own wallet via Circle —
 * silent, no popup. Safe to call again on a returning visit to top up the
 * approved allowance (e.g. approving an additional amount on top of whatever's
 * left from before) — Circle/the ERC20 contract just sets a new allowance value,
 * it doesn't require draining to zero first.
 * Response: { success, tx_hash }
 */
readerRouter.post('/:id/approve', async (req, res) => {
  try {
    const { budget_usdc } = req.body;
    if (!budget_usdc) {
      return res.status(400).json({ error: 'Missing field: budget_usdc' });
    }

    const db = await getDb();
    const reader = await db.getReader(req.params.id);
    if (!reader) return res.status(404).json({ error: 'Reader not found' });

    const registryAddress = getRegistryAddress();
    if (!registryAddress) {
      return res.status(500).json({ error: 'GRIOT_REGISTRY_ADDRESS not configured' });
    }

    const atomicAmount = BigInt(Math.round(parseFloat(budget_usdc) * 1_000_000)).toString();

    const result = await sendContractCall(
      reader.wallet_id,
      getUsdcAddress(),
      'approve(address,uint256)',
      [registryAddress, atomicAmount],
    );
    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }

    await db.setReaderBudget(reader.id, parseFloat(budget_usdc));

    res.json({ success: true, tx_hash: result.tx_hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
