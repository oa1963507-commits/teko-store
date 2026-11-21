-- TEKO STORE: central order records (staged; run once in Supabase SQL Editor).
-- Safe by default: no public/anonymous access; records must be written by
-- the trusted server after a successfully uploaded ZIP and verified upload proof.
-- Order price is a CUSTOMER QUOTE only. Never use client-submitted price for payment.

create table if not exists public.teko_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null check (char_length(order_code) between 5 and 40),
  storage_path text not null unique
    check (storage_path ~ '^orders/[a-f0-9-]{36}\.zip$'),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (customer_phone ~ '^01[0-9]{9}$'),
  customer_address text not null default '',
  customer_notes text not null default '',
  hoodie_color text not null default '',
  hoodie_size text not null default '',
  quantity integer not null default 1 check (quantity between 1 and 100),
  unit_quote_egp numeric(12,2) not null default 0 check (unit_quote_egp >= 0),
  total_quote_egp numeric(12,2) not null default 0 check (total_quote_egp >= 0),
  order_payload jsonb not null default '{}'::jsonb,
  status text not null default 'new'
    check (status in ('new','reviewing','in_production','ready','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teko_orders_recent_idx
  on public.teko_orders (created_at desc);
create index if not exists teko_orders_status_recent_idx
  on public.teko_orders (status, created_at desc);
create index if not exists teko_orders_phone_idx
  on public.teko_orders (customer_phone);

create or replace function public.teko_orders_update_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists teko_orders_updated_at_trigger on public.teko_orders;
create trigger teko_orders_updated_at_trigger
before update on public.teko_orders
for each row execute function public.teko_orders_update_timestamp();

alter table public.teko_orders enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated clients.
-- All order access must go through server-side authorization in Edge Functions.
revoke all on public.teko_orders from public, anon, authenticated;
grant all on public.teko_orders to service_role;

comment on table public.teko_orders is
 'Private customer orders for TEKO STORE; server-side only. Never expose this table to browser users.';

-- Verification (returns an empty table until genuine orders are registered):
select count(*)::int as recorded_orders from public.teko_orders;
