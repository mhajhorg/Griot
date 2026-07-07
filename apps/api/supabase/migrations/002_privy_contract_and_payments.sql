-- Griot Database Schema Update
-- Adds: Circle wallet linkage, on-chain content_id/citation tracking, and the
-- griot_payments table replacing the old "payments" table.
-- Run this in Supabase SQL Editor AFTER 001_init.sql.

-- Creators: link to their Circle-managed wallet, add email (was missing —
-- the app code has always written it, this column just never existed)
alter table creators add column if not exists email text;
alter table creators add column if not exists wallet_id text;

-- Registry: on-chain identifiers and running totals
alter table registry add column if not exists content_id text;
alter table registry add column if not exists citation_count int default 0;
alter table registry add column if not exists total_earned numeric default 0;
alter table registry add column if not exists onchain_tx text;

create index if not exists idx_registry_content_id on registry(content_id);

-- griot_payments replaces "payments". Columns from BOTH the original schema
-- (tx_hash, amount, payer_wallet, verified — still written by read.js's x402
-- flow) and the new brief (content_id, endpoint, payer, amount_usdc, network,
-- gateway_tx — written by pay.js/agent.js) coexist here so neither code path
-- needs to be rewritten to match the other. All optional except the identifying
-- fields, since a given row will only ever populate one "side" of these pairs.
create table if not exists griot_payments (
  id uuid primary key default gen_random_uuid(),
  registry_id uuid references registry(id),
  content_id text,
  endpoint text,

  -- old-style fields (read.js)
  tx_hash text,
  amount numeric,
  payer_wallet text,
  verified boolean default false,

  -- new-style fields (pay.js / agent.js)
  payer text,
  amount_usdc numeric,
  network text,
  gateway_tx text,

  creator_wallet text,
  created_at timestamp default now()
);

create index if not exists idx_griot_payments_registry_id on griot_payments(registry_id);
create index if not exists idx_griot_payments_content_id on griot_payments(content_id);

-- Enable Realtime so the frontend can subscribe to live INSERT events
-- (notification bell / payment feed).
alter publication supabase_realtime add table griot_payments;

-- NOTE: the original "payments" table (from 001_init.sql) is left in place
-- rather than dropped, in case anything still reads from it. Safe to drop
-- once you've confirmed nothing depends on it:
--   drop table if exists payments;
