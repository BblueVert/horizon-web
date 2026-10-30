# Agente WhatsApp — Minimarket (detalle y mayorista)

Bot de pedidos por WhatsApp para un minimarket de barrio, con **precio por cantidad** (detalle → mayorista → caja). Se conecta a WhatsApp con un **puente Baileys** (WhatsApp Web, sin API de Meta) y tiene su **propia base de datos** en Supabase.

Negocio demo: **Minimarket La Esquina** (Rancagua) · 168 productos en 13 categorías · 319 tramos de precio.

Toma la arquitectura del flujo n8n de Mesa Cero (`mesa-cero/_workflows-n8n/`), pero está escrito desde cero como servicio Node: sin nodos que se desincronicen, con pruebas y versionado.

---

## Arquitectura

```
WhatsApp ──► puente.js (Baileys) ──POST /mensaje──► servidor.js ──► agente.js
   ▲            · agrupa ráfagas                                      │
   │            · pausa si responde un humano                         ├─ sesión + cliente + catálogo (Supabase)
   │            · "escribiendo…"                                      ├─ buscarCandidatos()  → ~40 productos, no los 168
   │                                                                  ├─ CAPA 1 · IA (DeepSeek) → solo JSON de intención
   │                                                                  ├─ CAPA 2 · motor.js → valida, cotiza, pregunta lo que falta
   │                                                                  ├─ rpc mm_crear_pedido → recalcula precios y descuenta stock
   │                                                                  └─ mm_interacciones → costo por turno
   └──────────────── replyChunks ◄────────────────────────────────────┘
```

| Paso Mesa Cero (n8n) | Aquí |
|---|---|
| Inbound Webhook + Parse Message | `servidor.js` (`POST /mensaje {telefono, mensaje}`) |
| Get Tenant / MenuItems / Locations | `db.cargarCatalogo()` con caché de 5 min |
| Get Session / Get Client | `db.obtenerSesion()` / `db.obtenerCliente()` |
| Build AI Prompt + Call DeepSeek | `prompt.js` + `llm.js` (con `thinking: disabled`) |
| Conversation Engine | `motor.js` (función pura, 100% testeable) |
| Upsert Client + Insert Order + Items | `mm_crear_pedido()` en una sola transacción |
| Upsert Session + Log Interaction | `guardarSesion()` + `registrarInteraccion()` |
| Respond With Reply | `{ replyChunks }` |

**Regla de oro:** la IA nunca pone un precio, un total ni confirma stock. Solo entiende el mensaje. Todo número sale del motor y lo vuelve a validar la base.

---

## Venta al por mayor

Cada producto tiene su precio detalle y tramos en `mm_precios_escala`. Gana el tramo con la cantidad mínima más alta que alcance la cantidad pedida.

Regla por defecto del seed (`scripts/generar-seed.js`, se puede editar producto por producto en la tabla):

| Tipo de producto | Mayorista | Caja |
|---|---|---|
| Por unidad con caja (ej. leche, caja 12) | desde la mitad de la caja (tope 12) · −6% | caja completa · −12% |
| Por unidad sin caja | desde 6 · −5% | — |
| Por kilo (pan, verduras, alimento mascota) | desde 5 kg · −8% | — |

Ejemplo leche Soprole 1 L: 1–5 a $1.290 · 6–11 a $1.210 · 12+ a $1.130.

Además:
- **Cliente mayorista registrado** (`mm_clientes.tipo = 'mayorista'`, ej. un almacén que compra seguido): paga al menos el primer tramo aunque lleve 1 unidad.
- **Empujón de venta:** si al cliente le falta poco para el próximo tramo, el bot le avisa ("Si llevas 12 te queda a $1.130 c/u").
- El resumen muestra el ahorro mayorista y el pedido guarda `descuento_mayorista` y `es_mayorista`.

---

## Qué hace el bot

- Arma el pedido en lenguaje natural ("mándame 2 cocas de 3 litros, medio kilo de tomate y un confort").
- Productos por kilo con fracciones (0,25 kg en adelante).
- Producto ambiguo ("leche") → ofrece opciones numeradas con precio.
- Consulta de precios con sus tramos, listado por categoría, horario, despacho, medios de pago, dirección.
- Pide en orden: nombre → retiro/despacho → dirección → pago → resumen → confirmación.
- Despacho: mínimo, costo y gratis sobre cierto monto (configurable en `mm_negocio`).
- Stock: no vende lo que no hay; si se agota justo al confirmar, ajusta y vuelve a mostrar el resumen.
- Nunca confirma un pedido sin haber mostrado antes el resumen.
- Carrito abandonado se olvida a las 6 h (recuerda nombre y dirección).
- Fuera de horario igual toma el pedido y avisa cuándo sale.

Puente:
- Solo chats individuales (ignora grupos, estados y canales).
- Junta los mensajes que llegan seguidos (2,5 s) en un solo turno.
- Si alguien del local escribe a mano en un chat, el bot se calla ahí 30 min. Desde el teléfono: `#bot off` / `#bot on` en el chat.
- `SOLO_NUMEROS` para demos: responde solo a esos números.

---

## Base de datos

`db/001-esquema.sql` (idempotente) + `db/002-seed.sql` (generado desde `db/catalogo.json`).

| Tabla | Qué guarda |
|---|---|
| `mm_negocio` | Nombre, dirección, horario, despacho, medios de pago (1 fila) |
| `mm_categorias` | 13 categorías: abarrotes, despensa, desayuno, lácteos, panadería, frutas y verduras, bebidas, golosinas, congelados, aseo personal, limpieza, hogar, mascotas |
| `mm_productos` | SKU, marca, formato, unidad (`un`/`kg`), precio detalle, unidades por caja, stock, alias |
| `mm_precios_escala` | Tramos por cantidad |
| `mm_clientes` | Teléfono, nombre, tipo (`detalle`/`mayorista`), dirección |
| `mm_pedidos` + `mm_pedido_items` | Pedido con código `MM-0001`, precios aplicados y tramo por línea |
| `mm_bot_sesiones` | Carrito en curso por teléfono |
| `mm_interacciones` | Mensaje, respuesta, tokens y costo CLP por turno |

RLS activado en todo. `anon` solo lee negocio, categorías, productos activos y tramos (sirve para una web catálogo a futuro). El resto solo lo toca `service_role` desde el servidor.

---

## Puesta en marcha

1. **Supabase:** crea un proyecto nuevo (solo para este minimarket) → SQL Editor → corre `db/001-esquema.sql` y después `db/002-seed.sql`.
2. **Instala:**
   ```bash
   cd verticales/minimarket
   npm install
   cp .env.example .env   # completa SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEPSEEK_API_KEY, AGENTE_TOKEN
   ```
3. **Prueba sin WhatsApp:** `DB_MODO=memoria npm run simular` (chat en la terminal con la IA real).
4. **Levanta todo:** `npm start` → escanea el QR con el WhatsApp del minimarket (Dispositivos vinculados).
5. **Ve los pedidos** en Supabase → `mm_pedidos` (estado `pendiente`).

Necesita un equipo encendido 24/7 (mini PC, VPS o Docker). No corre en Vercel: Baileys mantiene una conexión abierta.

Comandos:

| Comando | Qué hace |
|---|---|
| `npm start` | Agente + puente |
| `npm run agente` / `npm run puente` | Por separado (ej. agente en un VPS, puente en otro equipo) |
| `npm run simular` | Chat de prueba en terminal |
| `npm run seed` | Regenera `db/002-seed.sql` desde `db/catalogo.json` |
| `npm test` | 18 pruebas: precios, tramos, búsqueda y conversaciones completas |

## Cambiar precios o productos

- **En producción:** directo en Supabase (`mm_productos.precio_detalle`, `mm_precios_escala`, `stock`). El agente lo toma en ≤ 5 min.
- **Catálogo demo:** edita `db/catalogo.json` → `npm run seed` → vuelve a correr `002-seed.sql`.

## Ojo

- Baileys usa WhatsApp Web no oficial. Usa un número dedicado del minimarket; nada de envíos masivos.
- Si el teléfono cierra la sesión vinculada, borra `.wa-sesion/` y escanea de nuevo.
- `deepseek-chat` ya no existe: usa `deepseek-v4-flash` (o `deepseek-v4-pro`).
