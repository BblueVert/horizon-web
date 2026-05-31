-- HORIZON CRM — migración completa
-- Idempotente: se puede ejecutar múltiples veces sin errores.

-- ── Función updated_at ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tabla leads ───────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id               text primary key,
  nombre           text,
  empresa          text,
  email            text,
  telefono         text,
  sector           text,
  canal            text,
  origen           text,
  plan             text,
  tipoprecio       text        default 'fundador',
  status           text        default 'new',
  prioridad        text        default 'Media',
  nota             text,
  cal_link         text,
  reunion_fecha    text,
  portal_token     uuid        unique default gen_random_uuid(),
  notion_url       text,
  github_url       text,
  propuesta_url    text,
  contrato_url     text,
  pipeline_stage   text        default 'lead',
  next_follow_up   timestamptz,
  hooks_respuestas jsonb       default '{}'::jsonb,
  historial        jsonb       default '[]'::jsonb,
  brief            jsonb       default '{}'::jsonb,
  session_notas    text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Índices
create index if not exists leads_status_idx       on public.leads(status);
create index if not exists leads_email_idx        on public.leads(email);
create index if not exists leads_created_idx      on public.leads(created_at desc);
create index if not exists leads_cal_link_idx     on public.leads(cal_link);
create index if not exists leads_next_follow_idx  on public.leads(next_follow_up);
create unique index if not exists leads_email_unique on public.leads(email)
  where email is not null and email <> '';

-- Trigger
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- RLS
alter table public.leads enable row level security;

drop policy if exists "anon_all"        on public.leads;
drop policy if exists "anon_insert_only" on public.leads;
create policy "anon_insert_only" on public.leads
  for insert to anon
  with check (true);

drop policy if exists "anon_read_by_token" on public.leads;
create policy "anon_read_by_token" on public.leads
  for select to anon
  using (
    portal_token is not null
    AND portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
  );

drop policy if exists "anon_update_brief" on public.leads;
create policy "anon_update_brief" on public.leads
  for update to anon
  using (
    portal_token is not null
    AND portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
  )
  with check (
    portal_token is not null
    AND portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
  );

drop policy if exists "authenticated_full" on public.leads;
create policy "authenticated_full" on public.leads
  for all to authenticated
  using (true)
  with check (true);

-- Column-level security: anon may only write to the brief column, nothing else.
-- This prevents a portal client from overwriting email, status, nombre, etc.
REVOKE UPDATE ON public.leads FROM anon;
GRANT UPDATE (brief) ON public.leads TO anon;

-- ── Tabla projects ────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      text        references public.leads(id) on delete cascade,
  nombre       text        not null,
  plan         text,
  estado       text        default 'init',
  fecha_inicio date,
  fecha_fin    date,
  descripcion  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists projects_lead_id_idx on public.projects(lead_id);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "anon_read_project_by_token" on public.projects;
create policy "anon_read_project_by_token" on public.projects
  for select to anon
  using (
    lead_id in (
      select id from public.leads
      where portal_token is not null
        AND portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
    )
  );

drop policy if exists "authenticated_full_projects" on public.projects;
create policy "authenticated_full_projects" on public.projects
  for all to authenticated
  using (true)
  with check (true);

-- ── Tabla project_milestones ──────────────────────────────────────────────────
create table if not exists public.project_milestones (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        references public.projects(id) on delete cascade,
  nombre       text        not null,
  descripcion  text,
  fecha_target date,
  estado       text        default 'pending',
  deliverables jsonb       default '[]'::jsonb,
  created_at   timestamptz default now()
);

create index if not exists milestones_project_idx on public.project_milestones(project_id);
create index if not exists milestones_estado_idx  on public.project_milestones(estado);

alter table public.project_milestones enable row level security;

drop policy if exists "anon_read_milestones" on public.project_milestones;
create policy "anon_read_milestones" on public.project_milestones
  for select to anon
  using (
    project_id in (
      select p.id from public.projects p
      join public.leads l on l.id = p.lead_id
      where l.portal_token is not null
        AND l.portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
    )
  );

drop policy if exists "authenticated_full_milestones" on public.project_milestones;
create policy "authenticated_full_milestones" on public.project_milestones
  for all to authenticated
  using (true)
  with check (true);

-- ── Tabla portal_events ───────────────────────────────────────────────────────
create table if not exists public.portal_events (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    text        references public.leads(id) on delete cascade,
  tipo       text        not null default 'nota',
  autor      text        not null default 'horizon',
  contenido  text,
  created_at timestamptz default now()
);

create index if not exists portal_events_lead_id_idx on public.portal_events(lead_id);

alter table public.portal_events enable row level security;

drop policy if exists "anon_read_portal_events" on public.portal_events;
create policy "anon_read_portal_events" on public.portal_events
  for select to anon
  using (
    lead_id in (
      select id from public.leads
      where portal_token is not null
        AND portal_token = (current_setting('request.headers', true)::json->>'x-portal-token')::uuid
    )
  );

drop policy if exists "authenticated_full_portal_events" on public.portal_events;
create policy "authenticated_full_portal_events" on public.portal_events
  for all to authenticated
  using (true)
  with check (true);
