-- HORIZON OPS — migración 008: acceso solo para admins + schema documentado
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). NO correr en el del SaaS de peluquerías.
-- Idempotente: se puede ejecutar varias veces.
--
-- Antes: cualquier usuario autenticado (policy "authenticated_full*") tenía acceso total
-- a leads, proyectos, hitos y eventos. Con el registro abierto, eso era cualquiera.
-- Ahora: solo los emails listados en public.ops_admins.
--
-- DESPUÉS DE CORRERLA agrega tu email (si no, OPS queda vacío para todos):
--   insert into public.ops_admins (email) values ('tu-email@dominio.cl') on conflict do nothing;

-- ── Admins ────────────────────────────────────────────────────────────────────
create table if not exists public.ops_admins (
  email      text primary key,
  created_at timestamptz default now()
);
alter table public.ops_admins enable row level security;
-- Sin policies: nadie la lee por la API. Solo la función de abajo (security definer).

create or replace function public.is_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ops_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_ops_admin() from public;
grant execute on function public.is_ops_admin() to anon, authenticated;

-- ── Tablas de OPS que existían solo en el dashboard de Supabase ───────────────
-- "if not exists": si ya existen no se tocan; quedan documentadas para poder recrearlas.

alter table public.leads add column if not exists mrr integer default 0;

create table if not exists public.tasks (          -- backlog por proyecto (/api/ops/tasks)
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,
  titulo      text not null,
  descripcion text,
  estado      text default 'pendiente',            -- pendiente | en_progreso | hecho
  prioridad   text default 'media',                -- alta | media | baja
  orden       integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.tasks add column if not exists orden integer default 0;
create index if not exists tasks_project_idx on public.tasks(project_id);

create table if not exists public.tareas (         -- kanban personal (/ops/tareas)
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  etapa        text,
  prioridad    text,
  etiqueta     text,
  fecha_limite date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists public.notas (          -- /ops/notas y registro de deep work
  id         uuid primary key default gen_random_uuid(),
  titulo     text,
  contenido  text,
  color      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.objetivos (      -- /ops/objetivos (OKRs)
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  descripcion      text,
  categoria        text,
  fecha_limite     date,
  hooks_respuestas jsonb default '[]'::jsonb,       -- key results
  estado           text default 'activo',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists public.prioridades (    -- top prioridades del dashboard
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  completado boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.chats (          -- historial del Agente HORIZON
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  tipo       text,
  messages   jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Políticas ─────────────────────────────────────────────────────────────────
-- Tablas con acceso público por portal_token: se mantiene lo anónimo, se reemplaza
-- el acceso total de "authenticated" por acceso solo de admins.
drop policy if exists "authenticated_full"               on public.leads;
drop policy if exists "authenticated_full_projects"      on public.projects;
drop policy if exists "authenticated_full_milestones"    on public.project_milestones;
drop policy if exists "authenticated_full_portal_events" on public.portal_events;

-- Tablas internas: se borra cualquier policy previa (creadas a mano, nombres desconocidos).
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['tasks','tareas','notas','objetivos','prioridades','chats'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;

  foreach t in array array['leads','projects','project_milestones','portal_events',
                           'tasks','tareas','notas','objetivos','prioridades','chats'] loop
    execute format('drop policy if exists "ops_admin_all" on public.%I', t);
    execute format(
      'create policy "ops_admin_all" on public.%I for all to authenticated
         using (public.is_ops_admin()) with check (public.is_ops_admin())', t);
  end loop;
end $$;

-- Aviso si todavía no hay admins cargados
do $$
begin
  if not exists (select 1 from public.ops_admins) then
    raise notice 'ops_admins está vacía: agrega tu email o nadie podrá entrar a OPS.';
  end if;
end $$;
