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
  portal_token   text unique,
  notion_url     text,
  github_url     text,
  propuesta_url  text,
  contrato_url   text,
  pipeline_stage text default 'lead',
  next_follow_up timestamptz,
  hooks_respuestas jsonb default '{}'::jsonb,
  historial      jsonb default '[]'::jsonb,
  session_notas  text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Índices
create index if not exists leads_status_idx        on public.leads(status);
create index if not exists leads_email_idx         on public.leads(email);
create index if not exists leads_created_idx       on public.leads(created_at desc);
create index if not exists leads_cal_link_idx      on public.leads(cal_link);
create index if not exists leads_portal_token_idx  on public.leads(portal_token);
create index if not exists leads_next_follow_idx   on public.leads(next_follow_up);

-- Email único (evita duplicados)
create unique index if not exists leads_email_unique on public.leads(email)
  where email is not null and email <> '';

-- RLS restrictivo
alter table public.leads enable row level security;

-- Eliminar política permisiva anterior (si existe)
drop policy if exists "anon_all" on public.leads;

-- Anon solo puede insertar nuevos leads (formularios del sitio)
create policy "anon_insert_only" on public.leads
  for insert
  to anon
  with check (true);

-- Anon puede leer su propio lead por portal_token (portal cliente)
create policy "anon_read_by_token" on public.leads
  for select
  to anon
  using (portal_token is not null);

-- Anon puede actualizar SOLO el brief (hooks_respuestas, session_notas) por portal_token
create policy "anon_update_brief" on public.leads
  for update
  to anon
  using (portal_token is not null)
  with check (portal_token is not null);

-- NOTA: UPDATE/DELETE privilegiados (CRM, webhooks) deben usar SUPABASE_SERVICE_ROLE_KEY
-- El service_role_key bypasea RLS automáticamente — no requiere policy adicional.

-- Trigger updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Tabla de proyectos activos
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  lead_id        text references public.leads(id) on delete cascade,
  nombre         text not null,
  plan           text,
  estado         text default 'init',
  fecha_inicio   date,
  fecha_fin      date,
  descripcion    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists projects_lead_id_idx on public.projects(lead_id);

-- Hitos de proyectos
create table if not exists public.project_milestones (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  fecha_target  date,
  estado        text default 'pending',
  deliverables  jsonb default '[]'::jsonb,
  created_at    timestamptz default now()
);

create index if not exists milestones_project_idx on public.project_milestones(project_id);
create index if not exists milestones_estado_idx  on public.project_milestones(estado);

-- RLS proyectos: solo service_role puede escribir
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;

create policy "anon_read_project_by_token" on public.projects
  for select to anon
  using (
    lead_id in (
      select id from public.leads where portal_token is not null
    )
  );

create policy "anon_read_milestones" on public.project_milestones
  for select to anon
  using (
    project_id in (
      select p.id from public.projects p
      join public.leads l on l.id = p.lead_id
      where l.portal_token is not null
    )
  );
