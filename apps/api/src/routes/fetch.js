import { Router } from 'express';
import { extractArticle } from '../lib/content-extractor.js';

export const fetchRouter = Router();

/**
 * POST /api/fetch-content
 * Body: { url }
 * Response: { title, content, word_count, source_url }
 */
fetchRouter.post('/fetch-content', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing url' });
    }

    console.log(`[fetch] Fetching: ${url}`);
    const result = await extractArticle(url);
    res.json(result);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Request timed out fetching URL' });
    }
    res.status(500).json({ error: `Fetch failed: ${err.message}` });
  }
});
