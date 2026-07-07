-- Griot Database Schema
-- Run this in Supabase SQL Editor

-- Creators
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username text unique not null,
  created_at timestamp default now()
);

-- Registry (registered content)
create table if not exists registry (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id),
  original_url text not null,
  canonical_url text unique not null,
  title text,
  content text,
  price numeric not null,
  wallet_address text not null,
  mode text check (mode in ('paywall', 'citation')) not null,
  created_at timestamp default now()
);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  registry_id uuid references registry(id),
  tx_hash text unique not null,
  amount numeric not null,
  payer_wallet text not null,
  creator_wallet text not null,
  verified boolean default false,
  created_at timestamp default now()
);

-- Indexes
create index if not exists idx_registry_canonical_url on registry(canonical_url);
create index if not exists idx_registry_creator_id on registry(creator_id);
create index if not exists idx_payments_registry_id on payments(registry_id);
create index if not exists idx_payments_tx_hash on payments(tx_hash);
