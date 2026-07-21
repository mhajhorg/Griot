import { Router } from 'express';
import { getDb } from '../supabase.js';

export const statsRouter = Router();

/**
 * GET /api/stats
 * Public, aggregate-only platform stats — no per-creator names, wallets, or
 * earnings exposed here on purpose.
 * Response: { creator_count, article_count, citation_count }
 */
statsRouter.get('/stats', async (_req, res) => {
  try {
    const db = await getDb();
    const stats = await db.getPlatformStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
