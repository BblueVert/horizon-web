-- Minimarket — esquema propio del agente de WhatsApp (proyecto Supabase dedicado).
-- Idempotente: se puede correr más de una vez. Después correr 002-seed.sql.
--
-- Acceso:
--   * anon (web pública futura): solo lee negocio, categorías, productos activos y tramos.
--   * service_role (agente en servidor): todo. Clientes, pedidos, sesiones e
--     interacciones no tienen policies para anon → quedan cerradas.

-- ── Configuración del negocio (una sola fila) ─────────────────────────────
create table if not exists mm_negocio (
  id int primary key default 1 check (id = 1),
  nombre text not null,
  direccion text,
  comuna text,
  horario jsonb not null default '{}'::jsonb,      -- {"1":["08:00","22:00"], ... "0":[...]} (0 = domingo)
  despacho_activo boolean not null default true,
  costo_despacho int not null default 1500,
  despacho_gratis_desde int not null default 25000,
  minimo_despacho int not null default 8000,
  comunas_despacho text[] not null default '{}',
  medios_pago text[] not null default '{efectivo,transferencia,tarjeta}',
  datos_transferencia text,
  updated_at timestamptz not null default now()
);

-- ── Catálogo ──────────────────────────────────────────────────────────────
create table if not exists mm_categorias (
  id text primary key,                 -- slug: abarrotes, golosinas, limpieza...
  nombre text not null,
  orden int not null default 0
);

create table if not exists mm_productos (
  sku text primary key,                -- ABA-001, GOL-014...
  categoria_id text not null references mm_categorias(id),
  nombre text not null,
  marca text,
  formato text,                        -- "1 L", "400 g", "por kilo"
  unidad text not null default 'un' check (unidad in ('un', 'kg')),
  precio_detalle int not null check (precio_detalle > 0),
  unidades_caja int check (unidades_caja is null or unidades_caja > 0),
  stock numeric(10,2) not null default 0,
  alias text[] not null default '{}',  -- cómo lo pide la gente: "confort", "coca", "pomarola"
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mm_productos_categoria_idx on mm_productos (categoria_id) where activo;

-- Tramos por cantidad: desde cantidad_min el precio unitario baja.
-- Sin fila = se cobra precio_detalle.
create table if not exists mm_precios_escala (
  id bigint generated always as identity primary key,
  sku text not null references mm_productos(sku) on delete cascade,
  cantidad_min numeric(10,2) not null check (cantidad_min > 1),
  precio_unitario int not null check (precio_unitario > 0),
  etiqueta text not null default 'mayorista',   -- mayorista | caja
  unique (sku, cantidad_min)
);

-- ── Clientes y pedidos ────────────────────────────────────────────────────
create table if not exists mm_clientes (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique,
  nombre text,
  tipo text not null default 'detalle' check (tipo in ('detalle', 'mayorista')),
  direccion text,
  notas text,
  total_pedidos int not null default 0,
  ultimo_pedido_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence if not exists mm_pedidos_codigo_seq;

create table if not exists mm_pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('MM-' || lpad(nextval('mm_pedidos_codigo_seq')::text, 4, '0')),
  cliente_id uuid references mm_clientes(id) on delete set null,
  telefono text not null,
  nombre_cliente text,
  canal text not null default 'whatsapp',
  entrega text not null check (entrega in ('retiro', 'despacho')),
  direccion text,
  medio_pago text,
  subtotal_lista int not null default 0,       -- todo a precio detalle
  descuento_mayorista int not null default 0,  -- lo que se ahorró por tramos
  subtotal int not null default 0,
  costo_despacho int not null default 0,
  total int not null default 0,
  es_mayorista boolean not null default false,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mm_pedidos_estado_idx on mm_pedidos (estado, created_at desc);
create index if not exists mm_pedidos_telefono_idx on mm_pedidos (telefono);

create table if not exists mm_pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references mm_pedidos(id) on delete cascade,
  sku text references mm_productos(sku) on delete set null,
  nombre text not null,
  cantidad numeric(10,2) not null check (cantidad > 0),
  precio_lista int not null,
  precio_unitario int not null,
  tramo text not null default 'detalle',
  subtotal int not null
);
create index if not exists mm_pedido_items_pedido_idx on mm_pedido_items (pedido_id);

-- ── Estado del bot y costo por turno ─────────────────────────────────────
create table if not exists mm_bot_sesiones (
  telefono text primary key,
  canal text not null default 'whatsapp',
  contexto jsonb not null default '{}'::jsonb,  -- carrito, nombre, entrega, dirección, pago
  updated_at timestamptz not null default now()
);

create table if not exists mm_interacciones (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  canal text not null default 'whatsapp',
  mensaje text,
  respuesta text,
  tokens_entrada int,
  tokens_salida int,
  costo_clp numeric(10,2),
  pedido_id uuid references mm_pedidos(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mm_interacciones_fecha_idx on mm_interacciones (created_at desc);

-- ── Precio unitario según cantidad ───────────────────────────────────────
create or replace function mm_precio_unitario(p_sku text, p_cantidad numeric)
returns int language sql stable as $$
  select coalesce(
    (select e.precio_unitario from mm_precios_escala e
      where e.sku = p_sku and e.cantidad_min <= p_cantidad
      order by e.cantidad_min desc limit 1),
    (select p.precio_detalle from mm_productos p where p.sku = p_sku)
  );
$$;

-- ── Crear pedido (transacción única) ─────────────────────────────────────
-- Recibe {telefono, nombre, entrega, direccion, medio_pago, notas, items:[{sku, cantidad}]}.
-- Nunca confía en los precios que manda el agente: los recalcula, valida stock
-- (bloqueando las filas) y lo descuenta. Si el cliente está registrado como
-- 'mayorista', cada línea paga al menos el primer tramo aunque lleve menos. Errores: producto_no_disponible:<sku>,
-- sin_stock:<sku>:<disponible>, minimo_despacho:<monto>, pedido_vacio.
create or replace function mm_crear_pedido(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  neg mm_negocio%rowtype;
  it jsonb;
  prod mm_productos%rowtype;
  v_cant numeric;
  v_cant_precio numeric;
  v_tipo text;
  v_precio int;
  v_tramo text;
  v_subtotal_lista int := 0;
  v_subtotal int := 0;
  v_despacho int := 0;
  v_mayorista boolean := false;
  v_cliente uuid;
  v_pedido mm_pedidos%rowtype;
  v_items jsonb := '[]'::jsonb;
begin
  select * into neg from mm_negocio where id = 1;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then
    raise exception 'pedido_vacio';
  end if;
  select tipo into v_tipo from mm_clientes where telefono = p->>'telefono';

  for it in select * from jsonb_array_elements(p->'items') loop
    v_cant := (it->>'cantidad')::numeric;
    select * into prod from mm_productos where sku = it->>'sku' and activo for update;
    if not found or v_cant is null or v_cant <= 0 then
      raise exception 'producto_no_disponible:%', it->>'sku';
    end if;
    if prod.stock < v_cant then
      raise exception 'sin_stock:%:%', prod.sku, prod.stock;
    end if;
    v_cant_precio := v_cant;
    if v_tipo = 'mayorista' then
      v_cant_precio := greatest(v_cant, coalesce((select min(e.cantidad_min) from mm_precios_escala e where e.sku = prod.sku), v_cant));
    end if;
    v_precio := mm_precio_unitario(prod.sku, v_cant_precio);
    v_tramo := coalesce((select e.etiqueta from mm_precios_escala e
                          where e.sku = prod.sku and e.cantidad_min <= v_cant_precio
                          order by e.cantidad_min desc limit 1), 'detalle');
    if v_tramo <> 'detalle' then v_mayorista := true; end if;
    v_subtotal_lista := v_subtotal_lista + round(prod.precio_detalle * v_cant);
    v_subtotal := v_subtotal + round(v_precio * v_cant);
    v_items := v_items || jsonb_build_object(
      'sku', prod.sku,
      'nombre', concat_ws(' ', prod.nombre, case when prod.marca in ('Granel', 'Del día') or position(lower(prod.marca) in lower(prod.nombre)) > 0 then null else prod.marca end, case when prod.unidad = 'un' then prod.formato end),
      'cantidad', v_cant, 'precio_lista', prod.precio_detalle, 'precio_unitario', v_precio,
      'tramo', v_tramo, 'subtotal', round(v_precio * v_cant));
    update mm_productos set stock = stock - v_cant, updated_at = now() where sku = prod.sku;
  end loop;

  if p->>'entrega' = 'despacho' then
    if v_subtotal < neg.minimo_despacho then
      raise exception 'minimo_despacho:%', neg.minimo_despacho;
    end if;
    if v_subtotal < neg.despacho_gratis_desde then v_despacho := neg.costo_despacho; end if;
  end if;

  insert into mm_clientes (telefono, nombre, direccion, total_pedidos, ultimo_pedido_at)
  values (p->>'telefono', p->>'nombre', p->>'direccion', 1, now())
  on conflict (telefono) do update set
    nombre = coalesce(excluded.nombre, mm_clientes.nombre),
    direccion = coalesce(excluded.direccion, mm_clientes.direccion),
    total_pedidos = mm_clientes.total_pedidos + 1,
    ultimo_pedido_at = now()
  returning id into v_cliente;

  insert into mm_pedidos (cliente_id, telefono, nombre_cliente, canal, entrega, direccion, medio_pago,
                          subtotal_lista, descuento_mayorista, subtotal, costo_despacho, total, es_mayorista, notas)
  values (v_cliente, p->>'telefono', p->>'nombre', coalesce(p->>'canal', 'whatsapp'), p->>'entrega',
          p->>'direccion', p->>'medio_pago', v_subtotal_lista, v_subtotal_lista - v_subtotal, v_subtotal,
          v_despacho, v_subtotal + v_despacho, v_mayorista, p->>'notas')
  returning * into v_pedido;

  insert into mm_pedido_items (pedido_id, sku, nombre, cantidad, precio_lista, precio_unitario, tramo, subtotal)
  select v_pedido.id, x->>'sku', x->>'nombre', (x->>'cantidad')::numeric, (x->>'precio_lista')::int,
         (x->>'precio_unitario')::int, x->>'tramo', (x->>'subtotal')::int
  from jsonb_array_elements(v_items) x;

  return jsonb_build_object(
    'id', v_pedido.id, 'codigo', v_pedido.codigo, 'subtotal', v_pedido.subtotal,
    'descuento_mayorista', v_pedido.descuento_mayorista, 'costo_despacho', v_pedido.costo_despacho,
    'total', v_pedido.total, 'es_mayorista', v_pedido.es_mayorista);
end $$;

revoke execute on function mm_crear_pedido(jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function mm_crear_pedido(jsonb) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function mm_crear_pedido(jsonb) to service_role;
  end if;
end $$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table mm_negocio enable row level security;
alter table mm_categorias enable row level security;
alter table mm_productos enable row level security;
alter table mm_precios_escala enable row level security;
alter table mm_clientes enable row level security;
alter table mm_pedidos enable row level security;
alter table mm_pedido_items enable row level security;
alter table mm_bot_sesiones enable row level security;
alter table mm_interacciones enable row level security;

drop policy if exists "publico lee negocio" on mm_negocio;
create policy "publico lee negocio" on mm_negocio for select using (true);
drop policy if exists "publico lee categorias" on mm_categorias;
create policy "publico lee categorias" on mm_categorias for select using (true);
drop policy if exists "publico lee productos activos" on mm_productos;
create policy "publico lee productos activos" on mm_productos for select using (activo);
drop policy if exists "publico lee tramos" on mm_precios_escala;
create policy "publico lee tramos" on mm_precios_escala for select using (true);
-- mm_clientes, mm_pedidos, mm_pedido_items, mm_bot_sesiones, mm_interacciones:
-- sin policies a propósito. Solo service_role (que salta RLS) las toca.
