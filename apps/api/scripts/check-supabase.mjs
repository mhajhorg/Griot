import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oxvfcxtrgbcjcthugkvt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dmZjeHRyZ2JjamN0aHVna3Z0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA2NTcwNCwiZXhwIjoyMDk3NjQxNzA0fQ.OUZn-4VWWlBbLUX2vMUcXgVx5g0IKz8o023u5hHViO8'
);

async function check() {
  // Check if tables exist
  const { error } = await supabase.from('creators').select('*').limit(1);
  if (error && error.code === '42P01') {
    console.log('Tables do not exist yet — run migration in Supabase SQL Editor');
    return;
  }
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  console.log('Tables already exist!');

  // Quick insert test
  const { data, error: insErr } = await supabase.from('creators').insert({
    wallet_address: '0xTest',
    username: 'test-' + Date.now(),
  }).select().single();

  if (insErr) {
    console.log('Insert failed:', insErr.message);
  } else {
    console.log('Supabase working! Created test creator:', data.id);
    await supabase.from('creators').delete().eq('id', data.id);
  }
}

check().catch(console.error);
