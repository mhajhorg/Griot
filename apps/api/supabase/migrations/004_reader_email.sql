-- Readers get a persistent identity via email, same pattern as creators —
-- lets a reader come back later and reuse their wallet's remaining balance,
-- instead of a one-off anonymous session.

alter table readers add column if not exists email text unique;

create index if not exists idx_readers_email on readers(email);
