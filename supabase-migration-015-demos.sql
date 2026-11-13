-- HORIZON OPS — migración 015: demos express de agentes de WhatsApp
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Requiere set_updated_at() (migraciones base). Idempotente.
--
-- Flujo: Claude arma la ficha de un negocio (en terreno, antes de entrar) y la publica en
-- POST /api/demos → demo_fichas. El bot de demos (verticales/demos, número Horizon Pruebas)
-- la descarga con GET /api/demos y la deja lista para probar por WhatsApp.
-- Todo pasa por api/demos.js con service role y DEMOS_TOKEN: sin acceso anon ni authenticated.

-- ── 1. Fichas: un negocio = un agente demo ────────────────────────────────────
create table if not exists public.demo_fichas (
  slug        text        primary key check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  nombre      text        not null check (char_length(nombre) between 1 and 120),
  rubro       text,
  ficha       jsonb       not null,
  activa      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists demo_fichas_updated_idx on public.demo_fichas(updated_at desc);

drop trigger if exists demo_fichas_updated_at on public.demo_fichas;
create trigger demo_fichas_updated_at before update on public.demo_fichas
  for each row execute function public.set_updated_at();

-- ── 2. Lo que "le llegaría al dueño": pedidos, reservas y consultas de las demos ──
create table if not exists public.demo_acciones (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        references public.demo_fichas(slug) on delete cascade,
  telefono    text,
  tipo        text        not null check (tipo in ('pedido', 'reserva', 'consulta', 'derivar')),
  resumen     text,
  datos       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists demo_acciones_slug_idx on public.demo_acciones(slug, created_at desc);

-- ── 3. Estado del bot (latido): número vinculado y última vez que sincronizó ──
create table if not exists public.demo_estado (
  id          int         primary key default 1 check (id = 1),
  numero      text,
  visto_at    timestamptz
);

alter table public.demo_fichas   enable row level security;
alter table public.demo_acciones enable row level security;
alter table public.demo_estado   enable row level security;
-- Sin policies a propósito: solo service_role (api/demos.js) lee y escribe.
revoke all on public.demo_fichas, public.demo_acciones, public.demo_estado from anon, authenticated;
