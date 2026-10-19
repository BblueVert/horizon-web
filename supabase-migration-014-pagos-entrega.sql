-- HORIZON OPS — migración 014: pagos con Mercado Pago y entrega final bloqueada
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Requiere la 009 y la 013. Idempotente.
--
-- 1. budget_items: el cliente paga cada ítem desde su portal con Mercado Pago (Checkout Pro).
--    El webhook (api/pagos.js, con service role) marca el ítem como pagado; nunca el navegador.
--    bloquea_entrega = true en el ítem del saldo: mientras no esté pagado, la entrega final no se ve.
-- 2. project_deliveries: los links de la entrega final (accesos, archivos editables, traspaso).
--    El portal (anon) NO puede leer esta tabla: solo la función portal_entrega_final(),
--    que devuelve los links únicamente si no quedan ítems bloqueantes sin pagar.

-- ── 1. budget_items ───────────────────────────────────────────────────────────
alter table public.budget_items add column if not exists bloquea_entrega boolean not null default false;
alter table public.budget_items add column if not exists metodo_pago     text;   -- 'mercadopago' | 'transferencia'
alter table public.budget_items add column if not exists mp_payment_id   text;   -- interno

grant select (bloquea_entrega, metodo_pago) on public.budget_items to anon;

-- ── 2. project_deliveries ─────────────────────────────────────────────────────
create table if not exists public.project_deliveries (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  nombre      text        not null check (char_length(nombre) between 1 and 200),
  url         text        not null check (url ~ '^https://'),
  orden       integer     default 0,
  created_at  timestamptz default now()
);
create index if not exists project_deliveries_project_idx on public.project_deliveries(project_id, orden);

alter table public.project_deliveries enable row level security;

drop policy if exists "ops_admin_all" on public.project_deliveries;
create policy "ops_admin_all" on public.project_deliveries for all to authenticated
  using (public.is_ops_admin()) with check (public.is_ops_admin());
-- sin policy para anon: el portal solo accede vía la función de abajo
revoke all on public.project_deliveries from anon;

-- ── 3. Entrega final para el portal ──────────────────────────────────────────
-- { "total": n, "bloqueada": bool, "items": [{nombre,url}] }  (items vacío si está bloqueada)
create or replace function public.portal_entrega_final()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (select id from public.portal_project_ids() as id),
  d as (
    select nombre, url, orden, created_at from public.project_deliveries
    where project_id in (select id from p)
  ),
  lock as (
    select exists (
      select 1 from public.budget_items
      where project_id in (select id from p) and bloquea_entrega and estado <> 'pagado'
    ) as bloqueada
  )
  select jsonb_build_object(
    'total', (select count(*) from d),
    'bloqueada', (select bloqueada from lock),
    'items', case when (select bloqueada from lock) then '[]'::jsonb
                  else coalesce((select jsonb_agg(jsonb_build_object('nombre', nombre, 'url', url) order by orden, created_at) from d), '[]'::jsonb)
             end
  );
$$;
revoke all on function public.portal_entrega_final() from public;
grant execute on function public.portal_entrega_final() to anon, authenticated;
