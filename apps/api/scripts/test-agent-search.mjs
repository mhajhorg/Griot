import 'dotenv/config'
// Force in-memory DB for this test regardless of .env in the repo
process.env.SUPABASE_URL = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
import { getDb } from '../src/supabase.js'

;(async () => {
  const db = await getDb();
  // ensure memory DB is used by not configuring SUPABASE env in this test
  const sample = {
    creator_id: 'creator-1',
    original_url: 'https://example.com/article-1',
    canonical_url: 'https://example.com/article-1',
    title: 'Example Article One',
    content: 'This is a short example content about testing Griot search and nanopayments.',
    price: 0.05,
    wallet_address: '0xcreatorwallet',
    mode: 'deployer',
  };

  const r = await db.register(sample).catch(e => ({ error: e.message }));
  console.log('Registered:', r.id ? r.id : r);

  const hits = await db.searchRegistry('nanopayments', 5);
  console.log('Search hits for "nanopayments":', hits.map(h => ({ id: h.id, title: h.title, canonical_url: h.canonical_url })));

  const hits2 = await db.searchRegistry('example article', 5);
  console.log('Search hits for "example article":', hits2.map(h => ({ id: h.id, title: h.title, canonical_url: h.canonical_url })));
})();
