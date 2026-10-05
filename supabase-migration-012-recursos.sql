-- HORIZON — migración 012: recursos interactivos (/recursos)
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Idempotente.
--
-- Cada vez que alguien completa un recurso (CONTEXTO, PROMPTS, FICHA, AUDITORÍA)
-- se guarda una fila acá, vinculada al lead (se crea o se reutiliza por teléfono/email).
-- La escritura la hace /api/recursos con la service_role key; OPS lee con RLS de admin.

create table if not exists public.resource_responses (
  id             uuid primary key default gen_random_uuid(),
  token          uuid unique not null default gen_random_uuid(), -- link público al resultado
  lead_id        text references public.leads(id) on delete set null,
  recurso        text not null,              -- contexto | prompts | ficha | auditoria
  negocio        text,
  rubro          text,
  comuna         text,
  respuestas     jsonb not null default '{}'::jsonb,
  resultado      jsonb not null default '{}'::jsonb,
  puntaje        integer,                    -- 0–100
  nivel          text,                       -- urgente | en camino | sólido
  plan_sugerido  text,                       -- plan01 … plan04 (claves de leads.plan)
  origen         jsonb not null default '{}'::jsonb, -- utm / palabra clave / referrer
  created_at     timestamptz default now()
);

create index if not exists resource_responses_lead_idx    on public.resource_responses(lead_id);
create index if not exists resource_responses_recurso_idx on public.resource_responses(recurso);
create index if not exists resource_responses_created_idx on public.resource_responses(created_at desc);

alter table public.resource_responses enable row level security;

drop policy if exists "ops_admin_all" on public.resource_responses;
create policy "ops_admin_all" on public.resource_responses for all to authenticated
  using (public.is_ops_admin()) with check (public.is_ops_admin());

-- Búsqueda de leads por teléfono (los recursos piden WhatsApp, el email es opcional)
create index if not exists leads_telefono_idx on public.leads(telefono);
