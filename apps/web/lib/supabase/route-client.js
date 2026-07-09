const { createClient } = require('@supabase/supabase-js');

let cachedClient;

function getSupabaseClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || !url.startsWith('http')) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(url, key);
  return cachedClient;
}

module.exports = { getSupabaseClient };
