# Demos express de agentes WhatsApp

Para mostrarle a un negocio **su propio agente funcionando** en el número **Horizon Pruebas**, armado en minutos mientras vas llegando al local. No hay que dejar nada listo: cada demo es una ficha JSON.

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

## Comandos (desde el teléfono de Horizon Pruebas)

| Dónde | Comando | Qué hace |
|---|---|---|
| Tu chat contigo mismo | `#demos` | Lista de demos con su link + ayuda |
| Tu chat contigo mismo | `#demo <slug>` | Conecta tu propio chat: pruebas la demo haciendo de cliente |
| Tu chat contigo mismo | `#demos recargar` | Vuelve a leer `fichas/` y la API |
| Cualquier chat | `#demo <slug>` | Conecta ese chat a una demo (el otro ve el comando; mejor usar el link) |
| Cualquier chat | `#demo off` · `#demo off todos` | Desconecta |
| Cualquier chat | `#bot off` / `#bot on` | Silencia o reactiva el bot ahí |

Si escribes a mano en un chat de demo, el bot se calla 30 min en ese chat.

**Chats sin demo no se responden.** Así el número puede seguir usándose normal. Ojo: si en el mismo número está vinculado otro bot (ej. el kit de Mesa Cero), los dos responden: desvincula el que no uses.

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
   cp .env.example .env   # DEMOS_TOKEN y DEEPSEEK_API_KEY
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
