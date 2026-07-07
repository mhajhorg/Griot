import { Router } from 'express';
import { getDb } from '../supabase.js';

export const articlesRouter = Router();

/**
 * GET /api/articles/:slug — public, no auth.
 * Response: { title, content, price, mode } or 404
 */
articlesRouter.get('/articles/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const db = await getDb();

    let article = await db.getRegistryById(slug);
    if (!article) {
      article = await db.findByUrl(slug);
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      title: article.title || 'Untitled',
      content: article.content || 'No content available.',
      price: article.price,
      mode: article.mode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
