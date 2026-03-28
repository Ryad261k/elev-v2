create extension if not exists pg_trgm;

create table if not exists public.food_catalog (
  id bigserial primary key,
  name text not null,
  name_normalized text not null,
  brand text,
  barcode text not null default '',
  kcal numeric(8,2) not null default 0,
  protein numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  fibres numeric(8,2),
  sodium numeric(10,2),
  source text not null default 'off',
  sold_in_fr boolean not null default false,
  popularity bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists food_catalog_name_barcode_idx
  on public.food_catalog (name_normalized, barcode);

create index if not exists food_catalog_sold_in_fr_idx
  on public.food_catalog (sold_in_fr desc, popularity desc);

create index if not exists food_catalog_name_trgm_idx
  on public.food_catalog using gin (name_normalized gin_trgm_ops);

create index if not exists food_catalog_popularity_idx
  on public.food_catalog (popularity desc);

create or replace function public.set_food_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_food_catalog_updated_at on public.food_catalog;
create trigger trg_food_catalog_updated_at
before update on public.food_catalog
for each row
execute function public.set_food_catalog_updated_at();

alter table public.food_catalog enable row level security;

drop policy if exists "food_catalog_select_auth" on public.food_catalog;
create policy "food_catalog_select_auth"
on public.food_catalog
for select
to authenticated
using (true);

drop policy if exists "food_catalog_write_auth" on public.food_catalog;
create policy "food_catalog_write_auth"
on public.food_catalog
for all
to authenticated
using (true)
with check (true);
