import { createClient } from '@supabase/supabase-js';
import { db as memoryDb } from './lib/memory-db.js';
import { createSupabaseAdapter } from './lib/supabase-adapter.js';

let _db = null;
let _dbPromise = null;

export async function getDb() {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
    console.log('[db] Using in-memory store (no Supabase configured)');
    _db = memoryDb;
    return _db;
  }

  _dbPromise = (async () => {
    try {
      let wsTransport;
      try {
        const { default: WebSocket } = await import('ws');
        wsTransport = WebSocket;
      } catch {
        // ws not available
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        realtime: wsTransport ? { transport: wsTransport } : undefined,
      });

      // Quick connectivity check
      const { error: pingErr } = await supabase.from('creators').select('id').limit(1);
      if (pingErr) throw pingErr.message || pingErr;
      _db = createSupabaseAdapter(supabase);
      console.log('[db] Using Supabase');
      return _db;
    } catch (err) {
      console.log(`[db] Supabase unreachable (${err.message || err.code}), falling back to in-memory`);
      _db = memoryDb;
      return _db;
    }
  })();

  return _dbPromise;
}
