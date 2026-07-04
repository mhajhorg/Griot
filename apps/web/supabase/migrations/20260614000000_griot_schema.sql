-- Griot schema: creators, registry, and payments

-- Creators table
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username text unique not null,
  bio text,
  created_at timestamptz not null default now()
);

alter table public.creators enable row level security;
create policy "Public read" on public.creators for select using (true);
create policy "Service insert" on public.creators for insert to service_role with check (true);
create policy "Service update" on public.creators for update to service_role using (true);

-- Registry table: all content registered by creators
create table public.registry (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade,
  original_url text not null,
  canonical_url text unique not null,
  title text not null,
  content text not null,
  price numeric(10,6) not null default 0.005,
  wallet_address text not null,
  mode text not null check (mode in ('paywall', 'citation')),
  citation_count integer not null default 0,
  total_earned numeric(18,6) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.registry enable row level security;
create policy "Public read" on public.registry for select using (true);
create policy "Service insert" on public.registry for insert to service_role with check (true);
create policy "Service update" on public.registry for update to service_role using (true);

-- Payments table: every settled payment event
create table public.griot_payments (
  id uuid primary key default gen_random_uuid(),
  registry_id uuid references public.registry(id) on delete set null,
  endpoint text not null,
  payer text not null,
  creator_wallet text not null,
  amount_usdc numeric(10,6) not null,
  network text not null,
  gateway_tx text,
  raw jsonb,
  created_at timestamptz not null default now()
);

alter table public.griot_payments enable row level security;
create policy "Public read" on public.griot_payments for select using (true);
create policy "Service insert" on public.griot_payments for insert to service_role with check (true);

-- Enable realtime on registry and payments
alter publication supabase_realtime add table public.registry;
alter publication supabase_realtime add table public.griot_payments;

-- Indexes for common queries
create index registry_creator_id_idx on public.registry(creator_id);
create index registry_canonical_url_idx on public.registry(canonical_url);
create index griot_payments_registry_id_idx on public.griot_payments(registry_id);
create index griot_payments_creator_wallet_idx on public.griot_payments(creator_wallet);
