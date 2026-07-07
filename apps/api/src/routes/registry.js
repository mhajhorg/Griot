import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../supabase.js';
import { createEmbeddedWallet, sendContractCall } from '../lib/circle.js';
import { computeContentId, getRegistryAddress } from '../lib/arc.js';

export const registryRouter = Router();

function normalizeCanonicalUrl(rawUrl) {
  const u = new URL(rawUrl);
  let path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}${path}`;
}

async function creatorStatsFor(db, creator) {
  const articles = await db.getRegistryByCreator(creator.id);

  let totalEarned = 0;
  let totalCitations = 0;

  const enriched = await Promise.all(articles.map(async (a) => {
    const payments = await db.getPaymentsByRegistryId(a.id);
    const articleEarned = payments.reduce((s, p) => s + parseFloat(p.amount_usdc ?? p.amount ?? '0'), 0);
    totalEarned += articleEarned;
    totalCitations += payments.length;

    const recentPayments = payments
      .slice()
      .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
      .slice(0, 5)
      .map(p => ({
        tx_hash: p.gateway_tx ?? p.tx_hash ?? null,
        amount_usdc: parseFloat(p.amount_usdc ?? p.amount ?? '0'),
        created_at: p.created_at,
      }));

    return {
      id: a.id,
      title: a.title,
      canonical_url: a.canonical_url,
      mode: a.mode,
      price: a.price,
      citation_count: payments.length,
      total_earned: articleEarned,
      recent_payments: recentPayments,
    };
  }));

  return { articles: enriched, total_earned: totalEarned, total_citations: totalCitations };
}

// Email-based signup — provisions a Circle-managed wallet invisibly
registryRouter.post('/creator/email-signup', async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email || !username) {
      return res.status(400).json({ error: 'Missing required fields: email, username' });
    }

    const db = await getDb();

    const existing = await db.findCreatorByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered', creator: existing });
    }

    let walletAddress;
    let circleWalletId;

    const walletResult = await createEmbeddedWallet();
    if (walletResult.success) {
      walletAddress = walletResult.address;
      circleWalletId = walletResult.walletId;
    } else {
      // Fall back to a simulated deterministic address so signup still works
      // in dev without Circle configured.
      const hash = crypto.createHash('sha256').update(email).digest('hex');
      walletAddress = '0x' + hash.slice(0, 40);
      console.log(`[email-signup] Circle unavailable (${walletResult.error}), using simulated wallet for ${email}: ${walletAddress}`);
    }

    const creator = await db.createCreator(walletAddress, username, email, circleWalletId);

    res.status(201).json({
      id: creator.id,
      wallet_address: walletAddress,
      username: creator.username,
      created_at: creator.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Secondary signup path — creator connects their own wallet (MetaMask/RainbowKit)
registryRouter.post('/creator', async (req, res) => {
  try {
    const { wallet_address, username } = req.body;

    if (!wallet_address || !username) {
      return res.status(400).json({ error: 'Missing required fields: wallet_address, username' });
    }

    const db = await getDb();

    const existing = await db.findCreatorByWallet(wallet_address);
    if (existing) {
      return res.status(200).json({
        id: existing.id,
        wallet_address: existing.wallet_address,
        username: existing.username,
        created_at: existing.created_at,
      });
    }

    const creator = await db.createCreator(wallet_address, username);

    res.status(201).json({
      id: creator.id,
      wallet_address: creator.wallet_address,
      username: creator.username,
      created_at: creator.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

registryRouter.post('/register', async (req, res) => {
  try {
    const { original_url, title, content, price, wallet_address, mode, creator_id } = req.body;

    if (!original_url || !price || !wallet_address || !mode || !creator_id) {
      return res.status(400).json({
        error: 'Missing required fields: original_url, price, wallet_address, mode, creator_id',
      });
    }

    if (!['paywall', 'citation'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "paywall" or "citation"' });
    }

    const canonical_url = normalizeCanonicalUrl(original_url);
    const content_id = computeContentId(canonical_url);
    const priceInUsdcUnits = Math.round(parseFloat(price) * 1_000_000);

    const db = await getDb();

    try {
      const record = await db.register({
        creator_id,
        original_url,
        canonical_url,
        content_id,
        title,
        content,
        price: parseFloat(price),
        wallet_address,
        mode,
      });

      // registerContent() records msg.sender as the on-chain content owner, so this
      // MUST be sent from the creator's own wallet — never a relaying/deployer wallet —
      // or citation payouts would go to the wrong address later.
      let onchainTx = null;
      let onchainNote = null;
      const creator = await db.getCreator(creator_id);
      const registryAddress = getRegistryAddress();

      if (!registryAddress) {
        onchainNote = 'GRIOT_REGISTRY_ADDRESS not configured — skipped on-chain registration';
      } else if (creator?.wallet_id) {
        const chainResult = await sendContractCall(
          creator.wallet_id,
          registryAddress,
          'registerContent(string,uint256)',
          [canonical_url, priceInUsdcUnits.toString()],
        );
        if (chainResult.success) {
          onchainTx = chainResult.tx_hash;
        } else {
          onchainNote = `On-chain registration failed: ${chainResult.error}`;
        }
      } else {
        onchainNote = 'Creator uses an external wallet — registerContent must be signed client-side by the creator, not relayed by the backend';
      }

      if (onchainNote) console.log(`[register] ${onchainNote}`);

      res.status(201).json({
        success: true,
        entry: {
          id: record.id,
          content_id,
          canonical_url,
          price: parseFloat(price),
          mode,
          onchain_tx: onchainTx,
        },
        ...(onchainNote ? { onchain_note: onchainNote } : {}),
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This URL is already registered' });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

registryRouter.get('/check', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url query parameter' });

    const db = await getDb();
    const data = await db.findByUrl(url);

    if (!data) return res.json({ registered: false });

    res.json({
      registered: true,
      registry_id: data.id,
      price: data.price,
      wallet: data.wallet_address,
      mode: data.mode,
      canonical_url: data.canonical_url,
      title: data.title,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

registryRouter.get('/creator/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const creator = await db.getCreator(id);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const { articles, total_earned, total_citations } = await creatorStatsFor(db, creator);

    res.json({ articles, total_earned, total_citations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wallet → creator lookup (not one of the frontend's documented 9, kept for parity)
registryRouter.get('/by-wallet/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const db = await getDb();

    const creator = await db.findCreatorByWallet(wallet);
    if (!creator) return res.status(404).json({ error: 'Creator not found for this wallet' });

    const { articles, total_earned, total_citations } = await creatorStatsFor(db, creator);

    res.json({ creator, articles, total_earned, total_citations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public feed — latest articles sorted by newest
registryRouter.get('/feed', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const db = await getDb();
    const articles = await db.getRegistryFeed(limit, offset);
    const total = await db.getRegistryCount();
    res.json({ articles, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
