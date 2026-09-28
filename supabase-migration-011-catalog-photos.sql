-- HORIZON OPS — migración 011: fotos para las fichas de producto
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Requiere la 009.
-- Idempotente.
--
-- Flujo: el equipo sube las fotos de una sesión en OPS (Fichas → Fotos). El navegador las
-- achica a WebP y las guarda en el bucket público "catalogo". El cliente, desde su portal,
-- elige qué fotos corresponden a cada producto (product_details.data.fotos = [ids]).

-- ── Bucket de Storage (lectura pública por URL, escritura solo admins) ───────
insert into storage.buckets (id, name, public)
values ('catalogo', 'catalogo', true)
on conflict (id) do update set public = true;

drop policy if exists "catalogo_admin_insert" on storage.objects;
create policy "catalogo_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo' and public.is_ops_admin());

drop policy if exists "catalogo_admin_update" on storage.objects;
create policy "catalogo_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo' and public.is_ops_admin())
  with check (bucket_id = 'catalogo' and public.is_ops_admin());

drop policy if exists "catalogo_admin_delete" on storage.objects;
create policy "catalogo_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalogo' and public.is_ops_admin());

-- ── Fotos disponibles por proyecto ───────────────────────────────────────────
create table if not exists public.catalog_photos (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  nombre      text        not null,            -- nombre original del archivo (ej. DSC03145.JPG)
  url         text        not null,            -- WebP grande (≈1600 px)
  thumb_url   text        not null,            -- WebP miniatura (≈480 px)
  path        text        not null,            -- ruta en el bucket (para borrar)
  ancho       integer,
  alto        integer,
  orden       integer     default 0,
  created_at  timestamptz default now()
);
create index if not exists catalog_photos_project_idx on public.catalog_photos(project_id, orden, created_at);

alter table public.catalog_photos enable row level security;

drop policy if exists "ops_admin_all" on public.catalog_photos;
create policy "ops_admin_all" on public.catalog_photos
  for all to authenticated
  using (public.is_ops_admin()) with check (public.is_ops_admin());

drop policy if exists "anon_read_photos" on public.catalog_photos;
create policy "anon_read_photos" on public.catalog_photos
  for select to anon using (project_id in (select public.portal_project_ids()));
revoke all on public.catalog_photos from anon;
grant select on public.catalog_photos to anon;
