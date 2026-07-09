const assert = require('node:assert/strict');
const { getSupabaseClient } = require('./route-client.js');

assert.equal(getSupabaseClient(), null, 'should return null when Supabase env is not configured');
console.log('route-client smoke test passed');
