-- HORIZON — migración NNN: {{TEMA}}
-- Proyecto Supabase: {{dkitbnrpwmwrfnmztdfc | khvfhvpqhcchgxrtmrjo}}. Requiere la {{0XX}}. Idempotente.
--
-- {{Qué resuelve y quién la usa (pantalla / endpoint).}}

create table if not exists public.{{tabla}} (
  id          uuid        primary key default gen_random_uuid(),
  {{columna}} text        not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

drop trigger if exists {{tabla}}_updated_at on public.{{tabla}};
create trigger {{tabla}}_updated_at
  before update on public.{{tabla}}
  for each row execute function public.set_updated_at();

alter table public.{{tabla}} enable row level security;

drop policy if exists "{{tabla}}_team_all" on public.{{tabla}};
create policy "{{tabla}}_team_all" on public.{{tabla}}
  for all to authenticated
  using (true) with check (true);
