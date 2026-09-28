-- HORIZON OPS — migración 009: portal del cliente v3
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Requiere la 008.
-- Idempotente: se puede ejecutar varias veces.
--
-- Agrega:
--   · Co-branding por proyecto (projects.brand) y repo de GitHub para avances automáticos
--   · Línea de tiempo: orden y fecha de inicio en los hitos
--   · Comentarios del cliente y del equipo por hito (portal_comments)
--   · Fichas de producto: catálogo por proyecto (catalog_items) + detalles que llena el cliente (product_details)
--   · Origen de cada evento del portal (ops | github | cliente)
--
-- El cliente nunca tiene sesión: todo lo que hace pasa por /api/portal con la anon key y el
-- header x-portal-token. Las políticas de abajo limitan cada acción a su propio proyecto y,
-- con permisos por columna, a los campos que puede tocar.

-- ── Columnas nuevas ───────────────────────────────────────────────────────────
alter table public.projects add column if not exists brand           jsonb   default '{}'::jsonb; -- {nombre, color, color_texto, logo_url}
alter table public.projects add column if not exists github_repo     text;                        -- 'Owner/Repo' para avances automáticos
alter table public.projects add column if not exists catalog_enabled boolean default false;       -- muestra la pestaña de fichas de producto

alter table public.project_milestones add column if not exists orden        integer     default 0;
alter table public.project_milestones add column if not exists fecha_inicio date;
alter table public.project_milestones add column if not exists updated_at   timestamptz default now();

alter table public.portal_events add column if not exists fuente       text default 'ops';  -- ops | github | cliente
alter table public.portal_events add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null;
alter table public.portal_events add column if not exists url          text;

create unique index if not exists projects_github_repo_uidx on public.projects (lower(github_repo))
  where github_repo is not null and github_repo <> '';

-- Orden inicial (por fecha y luego por creación) solo en proyectos que aún no tienen ninguno
update public.project_milestones m set orden = s.rn
from (
  select id, row_number() over (partition by project_id order by fecha_target nulls last, created_at) as rn
  from public.project_milestones
  where project_id in (
    select project_id from public.project_milestones group by project_id having max(coalesce(orden, 0)) = 0
  )
) s
where m.id = s.id;

-- ── Tablas nuevas ─────────────────────────────────────────────────────────────
create table if not exists public.portal_comments (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references public.projects(id) on delete cascade,
  milestone_id uuid        references public.project_milestones(id) on delete cascade,
  autor        text        not null default 'cliente' check (autor in ('cliente','horizon')),
  nombre       text,
  contenido    text        not null check (char_length(contenido) between 1 and 2000),
  created_at   timestamptz default now()
);
create index if not exists portal_comments_project_idx on public.portal_comments(project_id, created_at);

create table if not exists public.catalog_items (
  project_id uuid    not null references public.projects(id) on delete cascade,
  id         text    not null,              -- SKU del cliente (ej. BFLM006)
  nombre     text    not null,
  marca      text,
  categoria  text,
  modelo     text,
  color      text,
  imagen_url text,
  orden      integer default 0,
  primary key (project_id, id)
);

create table if not exists public.product_details (
  project_id uuid        not null,
  product_id text        not null,
  data       jsonb       not null default '{}'::jsonb,
  estado     text        not null default 'borrador' check (estado in ('borrador','listo')),
  updated_at timestamptz default now(),
  primary key (project_id, product_id),
  foreign key (project_id, product_id) references public.catalog_items(project_id, id) on delete cascade
);

-- ── Helper: proyecto(s) del token que viene en el header ──────────────────────
create or replace function public.portal_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.projects p
  join public.leads l on l.id = p.lead_id
  where l.portal_token is not null
    and l.portal_token::text = coalesce(current_setting('request.headers', true)::json ->> 'x-portal-token', '');
$$;
revoke all on function public.portal_project_ids() from public;
grant execute on function public.portal_project_ids() to anon, authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.portal_comments enable row level security;
alter table public.catalog_items   enable row level security;
alter table public.product_details enable row level security;

do $$
declare t text;
begin
  foreach t in array array['portal_comments','catalog_items','product_details'] loop
    execute format('drop policy if exists "ops_admin_all" on public.%I', t);
    execute format(
      'create policy "ops_admin_all" on public.%I for all to authenticated
         using (public.is_ops_admin()) with check (public.is_ops_admin())', t);
  end loop;
end $$;

-- Hitos: el cliente puede reordenar (solo la columna orden)
drop policy if exists "anon_reorder_milestones" on public.project_milestones;
create policy "anon_reorder_milestones" on public.project_milestones
  for update to anon
  using (project_id in (select public.portal_project_ids()))
  with check (project_id in (select public.portal_project_ids()));
revoke update on public.project_milestones from anon;
grant update (orden) on public.project_milestones to anon;

-- Eventos: el cliente solo puede registrar eventos propios (fuente cliente)
drop policy if exists "anon_insert_portal_events" on public.portal_events;
create policy "anon_insert_portal_events" on public.portal_events
  for insert to anon
  with check (
    autor = 'cliente' and fuente = 'cliente'
    and lead_id in (select p.lead_id from public.projects p where p.id in (select public.portal_project_ids()))
  );
revoke insert on public.portal_events from anon;
grant insert (lead_id, tipo, autor, contenido, fuente, milestone_id) on public.portal_events to anon;

-- Comentarios
drop policy if exists "anon_read_comments" on public.portal_comments;
create policy "anon_read_comments" on public.portal_comments
  for select to anon using (project_id in (select public.portal_project_ids()));
drop policy if exists "anon_insert_comments" on public.portal_comments;
create policy "anon_insert_comments" on public.portal_comments
  for insert to anon
  with check (autor = 'cliente' and project_id in (select public.portal_project_ids()));
revoke all on public.portal_comments from anon;
grant select on public.portal_comments to anon;
grant insert (project_id, milestone_id, autor, nombre, contenido) on public.portal_comments to anon;

-- Catálogo: solo lectura
drop policy if exists "anon_read_catalog" on public.catalog_items;
create policy "anon_read_catalog" on public.catalog_items
  for select to anon using (project_id in (select public.portal_project_ids()));
revoke all on public.catalog_items from anon;
grant select on public.catalog_items to anon;

-- Fichas: leer y guardar (upsert) las de su proyecto
drop policy if exists "anon_read_details" on public.product_details;
create policy "anon_read_details" on public.product_details
  for select to anon using (project_id in (select public.portal_project_ids()));
drop policy if exists "anon_insert_details" on public.product_details;
create policy "anon_insert_details" on public.product_details
  for insert to anon with check (project_id in (select public.portal_project_ids()));
drop policy if exists "anon_update_details" on public.product_details;
create policy "anon_update_details" on public.product_details
  for update to anon
  using (project_id in (select public.portal_project_ids()))
  with check (project_id in (select public.portal_project_ids()));
revoke all on public.product_details from anon;
grant select on public.product_details to anon;
grant insert (project_id, product_id, data, estado, updated_at) on public.product_details to anon;
-- el upsert de PostgREST (on_conflict + merge-duplicates) hace SET de todas las columnas enviadas;
-- la policy de update impide mover la fila a otro proyecto
grant update (project_id, product_id, data, estado, updated_at) on public.product_details to anon;
