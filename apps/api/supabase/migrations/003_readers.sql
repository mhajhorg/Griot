-- Reader session wallets — each reader gets a Circle-managed wallet used to fund
-- and silently pay for citations during a research session (see routes/reader.js).

create table if not exists readers (
  id uuid primary key default gen_random_uuid(),
  wallet_id text not null,
  wallet_address text not null,
  budget_usdc numeric,
  created_at timestamp default now()
);

create index if not exists idx_readers_wallet_address on readers(wallet_address);
