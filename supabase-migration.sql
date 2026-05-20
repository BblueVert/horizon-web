-- HORIZON CRM — tabla leads
-- Ejecutar en Supabase SQL Editor

create table if not exists public.leads (
  id             text primary key,
  nombre         text,
  empresa        text,
  email          text,
  telefono       text,
  sector         text,
  canal          text,
  origen         text,
  plan           text,
  tipoprecio     text default 'fundador',
  status         text default 'new',
  prioridad      text default 'Media',
  nota           text,
  cal_link       text,
  reunion_fecha  text,
  notion_url     text,
  github_url     text,
  propuesta_url  text,
  contrato_url   text,
  hooks_respuestas jsonb default '{}'::jsonb,
  historial      jsonb default '[]'::jsonb,
  session_notas  text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Índices útiles
create index if not exists leads_status_idx    on public.leads(status);
create index if not exists leads_email_idx     on public.leads(email);
create index if not exists leads_created_idx   on public.leads(created_at desc);

-- RLS: habilitado pero permisivo (tool interno)
alter table public.leads enable row level security;

create policy "anon_all" on public.leads
  for all
  to anon
  using (true)
  with check (true);

-- Trigger updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();
