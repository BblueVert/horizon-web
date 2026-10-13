-- HORIZON OPS — migración 013: presupuesto por proyecto
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Requiere la 009. Idempotente.
--
-- Cada proyecto tiene una lista de ítems cotizados (fotos, adaptación web, outfits…) con su monto
-- y estado. Se editan desde /ops/proyecto (pestaña Presupuesto) y el cliente los ve en su portal:
-- lo pagado aparece tachado y el total muestra cuánto queda por pagar.
--
-- comprobante y nota_interna son solo para el equipo (reparto entre socios, nº de transacción…):
-- el permiso por columna de abajo impide que el portal (anon) los lea.

create table if not exists public.budget_items (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references public.projects(id) on delete cascade,
  nombre       text        not null check (char_length(nombre) between 1 and 200),
  descripcion  text,
  monto        integer     check (monto is null or monto >= 0),   -- CLP; null = por definir
  estado       text        not null default 'pendiente' check (estado in ('pendiente','pagado')),
  pagado_at    date,
  comprobante  text,                                               -- interno
  nota_interna text,                                               -- interno
  orden        integer     default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists budget_items_project_idx on public.budget_items(project_id, orden);

drop trigger if exists budget_items_updated_at on public.budget_items;
create trigger budget_items_updated_at
  before update on public.budget_items
  for each row execute function public.set_updated_at();

alter table public.budget_items enable row level security;

drop policy if exists "ops_admin_all" on public.budget_items;
create policy "ops_admin_all" on public.budget_items for all to authenticated
  using (public.is_ops_admin()) with check (public.is_ops_admin());

-- Portal: solo lectura de su proyecto y sin las columnas internas
drop policy if exists "anon_read_budget" on public.budget_items;
create policy "anon_read_budget" on public.budget_items
  for select to anon using (project_id in (select public.portal_project_ids()));
revoke all on public.budget_items from anon;
grant select (id, project_id, nombre, descripcion, monto, estado, pagado_at, orden) on public.budget_items to anon;
