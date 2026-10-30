# Demos express de agentes WhatsApp

Para mostrarle a un negocio **su propio agente funcionando** en el número **Horizon Pruebas (+56 9 7696 2659)** —el mismo de la consultoría y del agente de Mesa Cero—, armado en minutos mientras vas llegando al local. No hay que dejar nada listo: cada demo es una ficha JSON.

```
Tú (celular, Claude)             Vercel                    Tu equipo (bot)                 WhatsApp
"voy a llegar a Tía Julia…" ──►  POST /api/demos  ──►  demo_fichas  ◄── GET cada 20 s ── bot.js ◄──► Horizon Pruebas
  skill demo-express:            (DEMOS_TOKEN)         (Supabase)         ✅ "Demo lista" en tu chat
  busca carta, precios,
  locales, horario → ficha
```

## Cómo se usa en terreno

1. A 5 minutos del local, dile a Claude: *"voy a llegar a Sanguchería X en Machalí, atiende la dueña, hacen mucho delivery por WhatsApp"*.
2. Claude (skill `demo-express`) busca en internet, arma la ficha y la publica. Te devuelve **link + QR + 3 frases para probar**.
3. A tu WhatsApp de Horizon Pruebas llega `✅ Demo lista: Sanguchería X`.
4. En el local: el dueño escanea el QR (o le mandas el link). Se abre el chat con el mensaje `…(demo: sangucheria-x)` → ese chat queda conectado a **su** demo.
5. Cuando confirma un pedido o reserva, al mismo chat le llega *"Así le llegaría este aviso al dueño"* con el resumen. Ese es el momento de cierre.

Puedes tener varias demos a la vez: cada chat habla con la suya.

## Demos por rubro (listas, a un mensaje)

Negocios ficticios en Rancagua para mostrar sin preparar nada. Escribe `#<slug>` en tu chat contigo mismo y escríbele a Horizon Pruebas desde otro número (o comparte el link de `#demos`).

| Slug | Negocio | Muestra |
|---|---|---|
| `estetica` | Studio Lumière (uñas, pestañas, cejas) | Reserva con hora + abono 30% por link + código de reserva |
| `barberia` | Barbería Don Fígaro | Reserva con barbero + pago opcional |
| `pasteleria` | Pastelería Dulce Abril | Encargo de torta 48 h + abono 50% + retiro o despacho |
| `cafeteria` | Café Esquina Norte | Pedido para retirar sin fila: hora + pago + código de retiro |
| `floreria` | Florería Rosa Blanca | Pedido con despacho, mensaje de tarjeta y pago |
| `veterinaria` | Veterinaria Patitas | Reserva de consulta/vacuna y derivación de urgencias |

En todas: precios y servicios, ubicación con **pin de WhatsApp**, horario, y al confirmar el aviso *"así le llega al dueño"*. Para un negocio real, Claude parte de la de su rubro y cambia nombre, dirección y precios (`fichas/rubro-*.json`).

**Al confirmar un pedido o reserva el cliente recibe:**
1. 💳 Link de pago (total o abono) → pantalla `/pago-demo` con el color del negocio → "Pago recibido" → *Volver a WhatsApp* con "Listo, ya pagué ✅ (R-1234)".
2. 🧾 Código de retiro (`R-1234`) o 📅 de reserva (`A-1234`).
3. 📲 El aviso que le llegaría al dueño.

## Comandos (desde el teléfono de Horizon Pruebas)

| Dónde | Comando | Qué hace |
|---|---|---|
| Tu chat contigo mismo | `#demos` | Lista de demos con su link + ayuda |
| Tu chat contigo mismo | `#<slug>` o `#demo <slug>` | Activa la demo (ej. `#cafeteria`, `#tia-julia`): te confirma en tu chat y el **próximo número nuevo** que le escriba al bot en 60 min (`DEMO_ARMADA_MIN`) queda conectado a ella. Una sola vez; te avisa "▶️ +569… empezó la demo" |
| Tu chat contigo mismo | `#demos recargar` | Vuelve a leer `fichas/` y la API |
| Cualquier chat | `#demo <slug>` | Conecta ese chat a una demo (el otro ve el comando; mejor usar el link) |
| Cualquier chat | `#demo off` · `#demo off todos` | Desconecta (en tu chat: desactiva la demo pendiente) |
| Cualquier chat | `#bot off` / `#bot on` | Silencia o reactiva el bot ahí |

Si escribes a mano en un chat de demo, el bot se calla 30 min en ese chat.

**Chats sin demo no se responden.** Es el número de la consultoría (está en todas las páginas de HORIZON): los prospectos que escriben sin link no reciben respuesta del bot y los atiendes tú. Deja `DEMO_POR_DEFECTO` vacío.

## Un solo puente para todo el número (Mesa Cero incluido)

WhatsApp deja vincular varios dispositivos, pero si dos bots quedan conectados al mismo número, **los dos responden cada chat**. Por eso este bot reemplaza al kit `mesa-cero-whatsapp-bot`:

| Ficha | Quién responde |
|---|---|
| Sin `motor` (las que arma Claude) | IA genérica con la ficha |
| `"motor": "mesa-cero"` (`fichas/ejemplo-motor-mesa-cero.json`, slug `tia-julia`) | Flujo n8n `wa-mesacero-v2` con la carta real (`{phone, mensaje}` → `{replyChunks}`, igual que el kit) |
| `"motor": "minimarket"` (`fichas/ejemplo-motor-minimarket.json`) | `verticales/minimarket` (`npm run agente`) |

**Los 14 restaurantes de Mesa Cero a la vez, sin reiniciar:** `npm run fichas-mesa-cero` crea una ficha por tenant con el slug del tenant (`tia-julia`, `cafe-haiti`, `sra-fang`, `magari`, `que-rolls`…: en WhatsApp, `#magari`). Cada chat le manda a n8n su `tenantSlug`, así que un chat puede estar en Café Haití y otro en Torino al mismo tiempo. Requiere el cambio de 1 nodo en n8n (`Parse Message`, ver `mesa-cero/_workflows-n8n/README.md`, 30-oct).

Para pasarte: en WhatsApp de Horizon Pruebas → Dispositivos vinculados → **cierra la sesión del kit de Mesa Cero**, y deja solo "HORIZON Demos". El n8n local sigue igual. URLs de motores en `MOTORES` (`.env`).

## Antes de salir a terreno (el bot solo corre cuando lo necesitas)

1. Prende el computador → Docker → n8n (como siempre).
2. Levanta el bot de demos (en el mismo Docker o `npm start`). La sesión de WhatsApp queda guardada: no hay que escanear el QR cada vez.
3. Te llega "🤖 Bot de demos conectado" a tu chat contigo mismo → listo para salir.

Toda la IA pasa por tu n8n: las demos de Mesa Cero por `wa-mesacero-v2` y las por rubro por `demo-ia` (`n8n/demo-ia.json`), con la **misma credencial DeepSeek** que ya tienes. El bot no tiene clave propia. Al volver, apaga el bot si quieres; los chats en demo siguen asignados 72 h.

## Instalación (una vez)

1. **Supabase** (proyecto principal HORIZON): corre `supabase-migration-015-demos.sql` en el SQL Editor.
2. **Token:** genera uno con `openssl rand -hex 32` y ponlo como `DEMOS_TOKEN` en:
   - Vercel → horizon-web → Environment Variables (y redeploy).
   - El entorno de Claude en la nube → variables de entorno (para que Claude publique desde el celular).
   - `.env` del bot (abajo).
3. **Bot** en un equipo que quede prendido:
   ```bash
   cd verticales/demos
   npm install
   cp .env.example .env   # DEMOS_TOKEN (la IA va por n8n: importa y activa n8n/demo-ia.json)
   npm start              # escanea el QR con el WhatsApp de Horizon Pruebas
   ```
   Te llega "🤖 Bot de demos conectado" a tu chat contigo mismo.

`/api/demos` funciona en producción solo cuando este cambio esté desplegado en Vercel (merge a `main`).

## Probar sin WhatsApp

```bash
npm run validar -- fichas/ejemplo-sangucheria.json
npm run simular -- fichas/ejemplo-sangucheria.json   # chat en la terminal con la IA real
npm test
```

## Archivos

| Archivo | Qué es |
|---|---|
| `FICHA.md` | Formato de la ficha |
| `fichas/` | Fichas locales (solo `ejemplo-*` va al repo; el resto queda fuera porque el repo es público) |
| `src/bot.js` | Puente Baileys: QR, agrupar ráfagas, "escribiendo…", reconexión |
| `src/conversacion.js` | Qué demo atiende cada chat, comandos, aviso al dueño |
| `src/agente.js` | Prompt desde la ficha + DeepSeek (JSON: respuestas + acción) |
| `src/fichas.js` | Fichas locales + sincronización con `/api/demos` (con copia offline en `datos/`) |
| `scripts/publicar.js` | Lo usa Claude: valida, publica, devuelve link y QR |
| `../../api/demos.js` | API (Vercel + `server.js`) con `DEMOS_TOKEN` |
| `../../.claude/skills/demo-express/` | El flujo que sigue Claude en terreno |

## Límites (es demo, no producción)
- La IA conversa con la ficha completa en el prompt. No hay stock, agenda real ni pagos.
- Precios: solo los de la ficha; lo que no tiene precio, "lo confirmo con el local".
- Los pedidos y reservas de demo quedan en `demo_acciones` (Supabase) para revisarlos después.
