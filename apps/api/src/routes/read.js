import { Router } from 'express';
import { getDb } from '../supabase.js';
import { verifyPayment } from '../lib/arc.js';

export const readRouter = Router();

readRouter.get('/read/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const db = await getDb();
    let article;

    // First try by UUID (ID)
    article = await db.getRegistryById(slug);

    // Fall back to canonical URL lookup
    if (!article) {
      article = await db.findByUrl(slug);
    }

    if (!article) return res.status(404).json({ error: 'Article not found' });

    if (article.mode !== 'paywall') {
      return res.json({
        title: article.title || 'Untitled',
        content: article.content || 'No content',
        canonical_url: article.canonical_url,
        mode: 'free',
      });
    }

    const receiptHeader = req.headers['x-payment-receipt'];
    if (!receiptHeader) {
      return res.status(402).json({
        error: 'Payment Required',
        x402: {
          version: 1,
          payment: {
            amount: article.price,
            currency: 'USDC',
            chain: 'arc-testnet',
            chain_id: 5042002,
            wallet: article.wallet_address,
            usdc_contract: process.env.USDC_CONTRACT || '0x3600000000000000000000000000000000000000',
          },
          resource: {
            url: `/api/read/${slug}`,
            description: `Access article: ${article.canonical_url}`,
          },
        },
      });
    }

    const txHash = receiptHeader.trim();
    const result = await verifyPayment(txHash, article.price.toString(), article.wallet_address);

    if (!result.valid) {
      return res.status(402).json({ error: 'Payment verification failed', reason: result.reason });
    }

    const payerWallet = req.headers['x-payer-wallet'] || 'unknown';
    await db.recordPayment({
      registry_id: article.id,
      tx_hash: txHash,
      amount: article.price,
      payer_wallet: payerWallet,
      creator_wallet: article.wallet_address,
      verified: true,
    }).catch(e => console.error('[read] Failed to record payment:', e.message));

    res.json({
      title: article.title || 'Untitled',
      content: article.content || 'No content',
      canonical_url: article.canonical_url,
      mode: 'paywall',
      payment: { tx_hash: txHash, amount: article.price, verified: true },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

readRouter.post('/verify', async (req, res) => {
  try {
    const { tx_hash, expected_amount, expected_wallet } = req.body;

    if (!tx_hash || !expected_amount || !expected_wallet) {
      return res.status(400).json({ error: 'Missing fields: tx_hash, expected_amount, expected_wallet' });
    }

    const result = await verifyPayment(tx_hash, expected_amount, expected_wallet);
    res.json(result.valid ? { valid: true, tx_hash } : { valid: false, reason: result.reason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
