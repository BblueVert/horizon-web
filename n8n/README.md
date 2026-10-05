# Agente HORIZON — Instagram + WhatsApp

```
Instagram / WhatsApp ──► n8n "Entrantes" ──► horizonweb.cl/api/bot/mensaje  (cerebro)
                                │                    │
                                │◄── responder / espera / silencio
                                ▼
                        n8n "Enviar" ──► Meta Graph API ──► cliente
                                ▲
     OPS /ops/bandeja (aprobar borrador) ─┘        n8n "Seguimientos" (cada hora)
```

- **Cerebro** (`api/bot.js` + `api/_bot-core.js`): busca en la base de conocimiento, decide si responde solo o deja un borrador, guarda la conversación, crea el lead y programa el seguimiento.
- **Base de conocimiento** (`kb_items` en Supabase): glosario, respuestas, objeciones, palabras clave y reglas. Se edita en **OPS → Bandeja IA → Base de conocimiento**.
- **Aprendizaje**: lo que el agente no sabe queda en **Por aprender**. Al responderlo (o al aprobar un borrador con "Guardar en la base") pasa a la base, y desde ahí responde solo.
- **n8n**: solo conecta Meta con el cerebro. Los tokens de Meta viven únicamente en el flujo "Enviar".

## Modo mixto (cómo decide)

| Situación | Qué hace |
|---|---|
| Palabra clave (CONTEXTO, PROMPTS, FICHA, AUDITORÍA, LISTA) | Responde solo con el link |
| Pregunta cubierta por la base, confianza ≥ 75% | Responde solo |
| No está en la base, baja confianza o tema sensible (descuentos, cuotas, reembolsos) | Borrador para Benjamín + mensaje de espera (máx. 1 cada 6 h) + aviso por Telegram |
| Piden hablar con una persona | Avisa y el agente queda en silencio en esa conversación |
| Conversación "tomada" en OPS | El agente no responde hasta que se devuelva |

**Reglas de Meta respetadas:** solo se responde dentro de las 24 h desde el último mensaje del cliente. El seguimiento automático es uno solo, a las ~20 h y solo si hubo interés. Pasadas las 24 h, se escribe a mano desde la app.

## Puesta en marcha

### 1. Supabase
Correr en el SQL Editor, en este orden:
1. `supabase-migration-013-agente.sql`
2. `supabase-seed-013-conocimiento.sql` (56 entradas iniciales; no pisa lo que edites después)

### 2. Vercel → Environment Variables (Production)
| Variable | Valor |
|---|---|
| `HORIZON_BOT_SECRET` | Una clave larga inventada (ej. generada con un gestor de contraseñas). La misma va en n8n. |
| `N8N_SEND_URL` | `https://TU-TUNEL/webhook/horizon-agente-enviar` |
| `DEEPSEEK_API_KEY` | Ya existe. Sin ella el agente solo responde coincidencias claras y deja el resto como borrador. |
| `DEEPSEEK_MODEL` | Opcional. Por defecto `deepseek-chat`. |

### 3. n8n local + túnel
Meta necesita llegar a tu n8n por una URL pública con HTTPS. Con n8n en Docker local:
- **ngrok** (más simple): cuenta gratis → dominio estático gratis → `ngrok http --url=TU-DOMINIO.ngrok-free.app 5678`.
- **Cloudflare Tunnel**: si el DNS de horizonweb.cl está en Cloudflare, `n8n.horizonweb.cl` → `localhost:5678`.

Al iniciar n8n agrega `WEBHOOK_URL=https://TU-TUNEL/` para que muestre las URLs correctas.
⚠️ Si el computador o el túnel se apagan, los mensajes de ese rato no se responden (Meta reintenta un tiempo y luego los descarta).

Importa los 3 flujos (n8n → Workflows → Import from file), completa los nodos **Config** y actívalos:
1. `1-agente-entrantes.json`
2. `2-agente-enviar.json`
3. `3-agente-seguimientos.json`

### 4. Meta
- **WhatsApp Cloud API** (developers.facebook.com → tu app → WhatsApp): webhook `https://TU-TUNEL/webhook/horizon-agente`, token de verificación = `VERIFY_TOKEN`, suscribir `messages`. Copiar Phone Number ID y un token permanente (usuario del sistema) al flujo "Enviar".
- **Instagram** (Instagram API con inicio de sesión de Instagram): misma URL de webhook, suscribir `messages`. Token de la cuenta @horizon.webs al flujo "Enviar". La cuenta debe ser profesional.
- Mientras la app esté en modo desarrollo, solo responde a cuentas agregadas como testers: ideal para probar antes de abrirlo.

### 5. Telegram (opcional, recomendado)
Para recibir en el celular cada borrador por aprobar: crea un bot con @BotFather, copia el token y tu chat id en el Config de "Entrantes".

## Opción 3: sin n8n (todo en Vercel)
El mismo cerebro puede recibir directo los webhooks de Meta: se agrega `/api/bot/meta` (verificación + normalización, lo mismo que hoy hace "Entrantes") y el envío pasa a Vercel con los tokens como variables de entorno. Los seguimientos corren con Vercel Cron cada hora.
- **A favor:** siempre encendido, sin túnel ni servidor, gratis, y todo en un solo lugar con el sitio y Supabase.
- **En contra:** el flujo se edita en código, no en la interfaz visual de n8n, y agregar pasos nuevos (Sheets, correo, CRM externo) es más lento que arrastrar un nodo.
- **Migración:** como el cerebro ya vive en horizon-web, pasar a la opción 3 es agregar un archivo y mover los tokens. No se rehace nada.
