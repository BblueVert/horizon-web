-- HORIZON — migración 013: agente de mensajes (Instagram + WhatsApp)
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Idempotente.
--
--   kb_items             base de conocimiento: glosario, respuestas, objeciones, palabras clave
--   agent_conversations  una fila por persona y canal (estado, ventana de 24 h, seguimiento)
--   agent_messages       historial de cada conversación (cliente, agente, humano)
--   kb_pendientes        lo que el agente no supo responder → se responde en OPS y pasa a la base
--
-- Escribe /api/bot/* con la service_role key; OPS lee y edita con RLS de admin.

create table if not exists public.kb_items (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  tipo        text not null check (tipo in ('glosario','respuesta','objecion','palabra_clave','politica')),
  categoria   text not null default 'general',
  titulo      text not null,                          -- concepto o pregunta tipo
  contenido   text not null,                          -- respuesta oficial (lo que el agente puede decir)
  variantes   text[] not null default '{}',           -- otras formas de preguntarlo
  keywords    text[] not null default '{}',           -- palabras que lo activan
  link        text,
  auto        boolean not null default true,          -- false = el agente prepara borrador, no responde solo
  activo      boolean not null default true,
  usos        integer not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists kb_items_tipo_idx on public.kb_items(tipo) where activo;

create table if not exists public.agent_conversations (
  id                  uuid primary key default gen_random_uuid(),
  canal               text not null check (canal in ('instagram','whatsapp')),
  contacto_id         text not null,                  -- IGSID o número de WhatsApp
  nombre              text,
  lead_id             text references public.leads(id) on delete set null,
  estado              text not null default 'bot' check (estado in ('bot','humano','cerrada')),
  resumen             text,                           -- lo que el agente sabe de esta persona
  ultimo_cliente_at   timestamptz,                    -- abre la ventana de 24 h de Meta
  ultimo_agente_at    timestamptz,
  seguimiento_paso    integer not null default 0,
  proximo_seguimiento timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (canal, contacto_id)
);
create index if not exists agent_conv_seg_idx on public.agent_conversations(proximo_seguimiento) where estado = 'bot';

create table if not exists public.agent_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.agent_conversations(id) on delete cascade,
  rol              text not null check (rol in ('cliente','agente','humano')),
  texto            text not null,
  mensaje_id       text,                              -- id de Meta (evita procesar dos veces)
  accion           text,                              -- auto | borrador | escalado | seguimiento
  estado           text not null default 'enviado' check (estado in ('enviado','borrador','descartado')),
  confianza        numeric,
  kb_ids           uuid[] not null default '{}',
  created_at       timestamptz default now()
);
create index if not exists agent_msg_conv_idx on public.agent_messages(conversation_id, created_at);
create unique index if not exists agent_msg_meta_uidx on public.agent_messages(mensaje_id) where mensaje_id is not null;
create index if not exists agent_msg_borrador_idx on public.agent_messages(estado) where estado = 'borrador';

create table if not exists public.kb_pendientes (
  id               uuid primary key default gen_random_uuid(),
  pregunta         text not null,
  borrador         text,
  conversation_id  uuid references public.agent_conversations(id) on delete set null,
  estado           text not null default 'pendiente' check (estado in ('pendiente','resuelta','descartada')),
  kb_item_id       uuid references public.kb_items(id) on delete set null,
  created_at       timestamptz default now()
);

-- updated_at automático (set_updated_at ya existe desde la migración base)
drop trigger if exists kb_items_updated_at on public.kb_items;
create trigger kb_items_updated_at before update on public.kb_items
  for each row execute function public.set_updated_at();
drop trigger if exists agent_conv_updated_at on public.agent_conversations;
create trigger agent_conv_updated_at before update on public.agent_conversations
  for each row execute function public.set_updated_at();

-- RLS: solo admins de OPS
do $$
declare t text;
begin
  foreach t in array array['kb_items','agent_conversations','agent_messages','kb_pendientes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "ops_admin_all" on public.%I', t);
    execute format('create policy "ops_admin_all" on public.%I for all to authenticated
                    using (public.is_ops_admin()) with check (public.is_ops_admin())', t);
  end loop;
end $$;

-- Contador de usos (lo llama /api/bot/responder)
create or replace function public.kb_sumar_usos(ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.kb_items set usos = usos + 1 where id = any(ids);
$$;
revoke all on function public.kb_sumar_usos(uuid[]) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.kb_sumar_usos(uuid[]) to service_role;
  end if;
end $$;
