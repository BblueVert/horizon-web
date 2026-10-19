# HORIZON — Remodelación del sistema (octubre 2026)
> Registro de todo lo que se cambió en la sesión del 19 de octubre de 2026: sitio, agenda, OPS, portal del cliente, pagos y documentos.
> Sirve para tres cosas: saber qué hay hoy, operarlo sin recordar detalles y arreglarlo si algo falla.

Este archivo está en un repo **público**: no tiene claves, tokens, RUT ni datos bancarios. Esos datos viven en Vercel y en `datos-privados.md`, que es local.

---

## Índice
1. [Resumen en 1 minuto](#1-resumen-en-1-minuto)
2. [Kit de agentes de Claude Code](#2-kit-de-agentes-de-claude-code)
3. [Sitio web en diseño claro](#3-sitio-web-en-diseño-claro)
4. [Agenda y Google Calendar](#4-agenda-y-google-calendar)
5. [OPS y Brief de reunión](#5-ops-y-brief-de-reunión)
6. [Portal del cliente](#6-portal-del-cliente)
7. [Pagos con Mercado Pago y entrega final](#7-pagos-con-mercado-pago-y-entrega-final)
8. [Documentos de cliente y condiciones comerciales](#8-documentos-de-cliente-y-condiciones-comerciales)
9. [WhatsApp](#9-whatsapp)
10. [Configuración: variables, servicios y base de datos](#10-configuración-variables-servicios-y-base-de-datos)
11. [Cómo se opera un cliente de punta a punta](#11-cómo-se-opera-un-cliente-de-punta-a-punta)
12. [Si algo falla](#12-si-algo-falla)
13. [Historial de cambios (PR #13 a #25)](#13-historial-de-cambios-pr-13-a-25)
14. [Pendientes](#14-pendientes)

---

## 1. Resumen en 1 minuto
- **Sitio:** todo HORIZON pasó a diseño claro y mobile-first, con iconografía propia (sin emojis), el logo oficial siempre sobre fondo oscuro y animaciones con GSAP y Lenis.
- **Agenda:** `/agendar` califica al prospecto antes del calendario (presupuesto desde $490.000), la sesión dura 30 min y crea el evento en Google Calendar con link de Meet.
- **Portal:** cada prospecto recibe su portal en la invitación. Antes del diagnóstico completa un brief. Si cierra, en el mismo link ve el avance, el presupuesto y la entrega.
- **Cobro:** el cliente paga cada ítem del presupuesto con Mercado Pago desde su portal. Al pagar el saldo se libera la entrega final sola. Probado con un pago real.
- **OPS:** funciona en el celular, con los tonos de marca, y se arreglaron 3 errores reales.
- **Documentos:** datos del prestador y condiciones comerciales completos. Los contratos y propuestas salen sin campos por definir.

---

## 2. Kit de agentes de Claude Code
Estructura en 5 capas para que Claude trabaje en este repo con las reglas de HORIZON.

| Capa | Dónde | Qué hace |
|---|---|---|
| 1 · Memoria | `CLAUDE.md` + `.claude/memoria/` (`architecture`, `naming`, `contenido`, `repo-map`, `casos`) | Reglas que no se negocian, stack, nombres, voz, casos reales. Se carga siempre. |
| 2 · Skills | `.claude/skills/` | `modo-terreno`, `documentos-cliente`, `nueva-pagina`, `migracion-supabase`, `reels`, `carrusel`, `stories`. |
| 3 · Hooks | `.claude/hooks/` + `.claude/settings.json` | Bloquean secretos fuera de `.env`, frases de IA en contenido y propuestas sin diagnóstico; validan `vercel.json`; recuerdan escuchar antes de diagnosticar. |
| 4 · Subagentes | `.claude/agents/` | `documentador`, `copy-reviewer`, `page-auditor`, `reel-writer`, `carrusel-maker`, `stories-builder`. |
| 5 · Plugin | `plugins/horizon-kit/` + `.claude-plugin/` | El kit empaquetado para instalarlo en otros proyectos. |

**En terreno:** di "modo terreno" y dicta los datos del negocio. El subagente `documentador` arma propuesta, contrato, orden de inicio y acta de entrega en tono formal, sin inventar datos.

---

## 3. Sitio web en diseño claro

### Sistema visual
- **Base compartida:**
  - `shared/hz-light.css`: tokens, header y footer oscuros, botones.
  - `shared/hz-motion.js`: menú, Lenis y apariciones.
  - `shared/hz-sprite.svg`: íconos propios.
- **Planes:** `shared/hz-plan.css`, con el color de cada plan en `<body class="c1…c4">`: 01 naranja, 02 coral, 03 rosa, 04 violeta.
- **Logo:** solo `Identidad/Logo HORIZON.svg`, siempre sobre fondo oscuro. Está prohibido usarlo con letras o bordes negros (manual de marca).
- **CTA principal:** el degradado HORIZON. Las superficies destacadas usan el degradado profundo desde azul-violeta.

### Páginas
| Página | Qué cambió |
|---|---|
| Landing `/` | Hero, cinta de logos en movimiento, problema, calculadora de ventas perdidas, sistema, planes diferenciados por color, proceso, enfoque, casos, FAQ y CTA final. Carruseles en celular y menos scroll antes de los planes. |
| `/agendar` | Primero 3 preguntas de calificación (presupuesto, consultas por semana, quién decide); después el calendario arriba y los datos abajo. Todo a 30 min. "Todavía no" no agenda: queda como lead frío y va a `/recursos`. |
| `/booking-confirm` | Fecha y hora sin error de zona horaria, link de Meet, botón "Ir a mi portal". Si Calendar no mandó la invitación, no la promete. |
| `/plan-01` a `/plan-04` | Una página por plan en diseño claro, con su color. |
| `/servicios` | Diseño claro y mobile-first. |
| `/recursos` | Diseño claro; se arregló el botón de WhatsApp que flotaba a mitad de página. |
| `/privacidad` | **Nueva.** Política de privacidad (Ley 19.628 y 21.719). Google la exige para la app de Calendar. |

### Casos en la landing (`#casos`)
VitalKine, Floremané, VitalFit y FITT, este último con hitos que se actualizan a medida que avanza. Cómo actualizarlos: `.claude/memoria/casos.md`.

---

## 4. Agenda y Google Calendar

### Cómo funciona
1. El prospecto completa `/agendar`.
2. `api/schedule-meet.js` hace esto:
   - Busca o crea el lead en Supabase.
   - Define su portal.
   - Crea el evento en Google Calendar con link de Meet y manda la invitación (`sendUpdates=all`).
3. La invitación es el correo de confirmación. Lleva un saludo, el **link al portal** y el WhatsApp.
   - La calificación interna (presupuesto, quién decide) **no** sale en la invitación: queda en OPS.
4. Si alguien vuelve a agendar con el mismo email, se **actualiza** su lead (no se duplica) y conserva su portal.

### El problema que hubo y cómo se resolvió
- **Síntoma:** se guardaba el lead, pero no se creaba el evento, no salía el link de Meet ni llegaba el correo.
- **Causa:** el token de Google estaba vencido (`invalid_grant`). La app de Google estaba en modo **Prueba**, y en ese modo el token caduca a los 7 días.
- **Solución:**
  - Se publicó la app (pasó a **En producción**). Para eso hizo falta la página `/privacidad`.
  - Se generó un token nuevo en OAuth Playground con las credenciales propias.
  - Se cargó el token en Vercel y se hizo redeploy.
  - Ahora el token **no vence**.
- **Datos de referencia:**
  - Proyecto de Google Cloud: **HORIZON - Scanner** (número `101602126664`).
  - Cliente OAuth: **HORIZON Calendar API**.
  - No borrar ese proyecto.

### Para probar
- Usa un correo **de otra cuenta**. Google no te manda invitaciones a ti mismo, ni siquiera a un alias `+test` de tu Gmail.

---

## 5. OPS y Brief de reunión
- **Celular:**
  - Barra superior con menú lateral deslizable en todos los módulos.
  - Pipeline en carrusel por etapa.
  - Clientes SaaS como tarjetas.
  - Agente IA con la lista de chats y el chat abierto por separado.
  - Formularios a una columna.
- **Marca:** crema, tinta, degradado HORIZON y logo oficial en SVG.
- **Errores arreglados:**
  - Clientes SaaS no cargaba porque `_sb` estaba declarado dos veces. Se renombró a `_opsSb`.
  - `/reunion` siempre expulsaba porque usaba un token del CRM viejo. Ahora usa la sesión de OPS.
  - `/reunion` usaba etapas viejas del pipeline. Ahora usa `propuesta`, `contactado` y `cerrado`.
  - `/reunion` rotulaba mal el plan: `plan04` es el Plan 03.
- **`/reunion`:** muestra la fecha del diagnóstico en el selector y ordena los leads por el más próximo.
- **Proyecto → Presupuesto:**
  - Casilla **"Libera la entrega final (saldo)"** en cada ítem.
  - Editor de links de la entrega final.
  - Etiqueta "Mercado Pago" en los ítems que se pagaron por esa vía.

---

## 6. Portal del cliente
Link único por cliente: `https://www.horizonweb.cl/c/<token>`.

| Momento | Qué ve el cliente |
|---|---|
| Recién agendó | Fecha y hora de la sesión, botón de Google Meet y un brief de 4 preguntas que se guarda solo. |
| Proyecto activo | Plan con etapas y calendario, actividad, comentarios, prioridades y presupuesto. |
| Presupuesto | Ítems con monto y estado; botón **Pagar con Mercado Pago** en cada pendiente. |
| Entrega final | Con candado hasta que paga el saldo; después, sus links (accesos, archivos, traspaso). |

- El portal es **neutro a propósito**: toma el color y la tipografía de cada cliente (co-branding). HORIZON aparece como sello oscuro con el logo.
- **Demo con datos de ejemplo**, para mostrarla en ventas: https://claude.ai/artifact/N5En5gPzaaFry2GcRMsjKQ (privada; se comparte desde su menú Share).

---

## 7. Pagos con Mercado Pago y entrega final

### Cómo funciona
1. El cliente toca **Pagar** en un ítem pendiente.
2. `api/pagos.js` crea el cobro (Checkout Pro) con el **monto de la base de datos**, nunca con el que mande el navegador.
3. El cliente paga en la pasarela de Mercado Pago.
4. Mercado Pago avisa a `https://www.horizonweb.cl/api/pagos?webhook=1`. El servidor:
   - valida la firma del aviso;
   - **consulta el pago en Mercado Pago**;
   - solo si el pago está aprobado, en pesos y por el monto correcto, marca el ítem como pagado.
5. Aparece "Pago recibido" en la actividad del portal. Si era el saldo, se libera la entrega final.

### Seguridad
- **Links de entrega:** viven en la tabla `project_deliveries`. El portal no puede leer esa tabla directo, solo a través de la función `portal_entrega_final()`, que revisa que el saldo esté pagado.
- **Avisos repetidos:** si Mercado Pago avisa dos veces del mismo pago, el sistema lo ignora y no pasa nada.

### Probado
- **Pago real de $1.000 el 19-10-2026:** se marcó pagado solo y se liberó la entrega.
- **No te puedes pagar a ti mismo.** Si estás logueado con tu cuenta de Mercado Pago, el botón "Pagar" queda gris. Para probar, paga como invitado o con otra cuenta.

---

## 8. Documentos de cliente y condiciones comerciales

### Datos del prestador
- **Públicos:** están en `.claude/skills/documentos-cliente/referencias/datos-horizon.md`.
  - Nombre, correo comercial (`soportebinks@gmail.com`), WhatsApp de la consultoría, sitio y ciudad.
- **Privados:** van en `datos-privados.md`, en la misma carpeta.
  - RUT, domicilio, cuenta para transferencias y email de comprobantes.
  - Ese archivo está en `.gitignore` y **nunca se sube**. Hay que crearlo en cada computador, usando como modelo `datos-privados.example.md`.

### Condiciones comerciales (confirmadas el 19-10-2026)
| Tema | Condición |
|---|---|
| Precio publicado | Es el **bruto** de la boleta de honorarios, sin IVA. En 2026 la retención es 15,25%: de $490.000 quedan ~$415.275 líquidos. |
| Implementación | 50% al firmar y 50% antes de la entrega final. |
| Entrega | Los avances se ven en el portal. La entrega final (accesos, archivos editables, traspaso de cuentas) se libera al pagar el saldo. |
| Soporte | El mes 1 va incluido. Desde el mes 2 se paga **al inicio del mes que cubre**, entre el día 25 y el 5. Si no se paga, el soporte se pausa. |
| Aviso para terminar el soporte | 15 días antes. |
| Rondas de diseño | 2 incluidas. |
| Plazo del cliente | 5 días hábiles para entregar o aprobar. Si se atrasa, la entrega se corre en los mismos días. |
| Término anticipado | Se paga lo trabajado; el anticipo no se devuelve. |
| Validez de la propuesta | 15 días. |
| Garantía | 30 días de corrección de errores, que coinciden con el mes de soporte incluido. |

Antes de fijar precios, confirmar el tratamiento de la boleta de honorarios con un contador.

---

## 9. WhatsApp
- **Consultoría: +56 9 7696 2659.** Está en todas las páginas HORIZON y en los documentos.
- **+56 9 4651 3068 es el número personal.** Solo queda en las demos de Binks Barber y en landings viejas de otros repos (`mesa-cero`, `horizon-restaurant-ecosystem`, `horizon-agenda`).
- El número de la consultoría se usa **a veces** para demos en vivo de Mesa Cero: se conecta el kit del bot por QR. Mientras está vinculado, el bot le responde a **todos**, también a los prospectos de HORIZON.
  - **Antes de la demo:** avisar.
  - **Al terminar:** WhatsApp → Dispositivos vinculados → cerrar la sesión del kit.

---

## 10. Configuración: variables, servicios y base de datos

### Variables en Vercel (solo los nombres)
| Variable | Para qué | Tipo |
|---|---|---|
| `GOOGLE_CLIENT_ID` | App de Calendar | Config |
| `GOOGLE_CLIENT_SECRET` | App de Calendar | Secret |
| `GOOGLE_REFRESH_TOKEN` | Permiso permanente para crear eventos | Secret |
| `GOOGLE_CALENDAR_ID` | Calendario donde se crean los eventos | Config |
| `MP_ACCESS_TOKEN` | Credencial de producción de Mercado Pago (`APP_USR-…`) | Secret |
| `MP_WEBHOOK_SECRET` | Clave secreta del webhook de Mercado Pago | Secret |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos | la service role es Secret |
| `SITE_URL` (opcional) | Dominio de los links. Si no se define, usa `https://www.horizonweb.cl` | Config |

Todas van en **Production y Preview**. Después de cambiar una variable, hay que hacer **Redeploy**.

### Servicios externos
- **Google Cloud:** proyecto *HORIZON - Scanner*, app OAuth publicada, cliente *HORIZON Calendar API* con redirect a OAuth Playground.
- **Mercado Pago:** app *HORIZON Web* (Checkout Pro, API de Preferences), webhook en modo productivo con el evento **Pagos**.
- **Supabase:** proyecto `dkitbnrpwmwrfnmztdfc`. Migración `supabase-migration-014-pagos-entrega.sql` corrida el 19-10-2026.

---

## 11. Cómo se opera un cliente de punta a punta
1. **Agenda:** el prospecto agenda en `/agendar`. Le llega la invitación con el link a su portal y aparece en OPS como `new`, con prioridad según su calificación.
2. **Antes de la sesión:**
   - Revisa su brief en el portal y su calificación en `/reunion`.
   - Escucha primero, pregunta y recién después diagnostica.
3. **Propuesta:** con `modo-terreno` o `documentos-cliente` armas la propuesta y el contrato.
4. **Cierre:**
   - En el pipeline, muévelo a **Arranque** y toca **▶ Activar Proyecto**.
   - En el proyecto → **Presupuesto**:
     - Anticipo 50%.
     - Saldo 50%, con **"Libera la entrega final"** marcado.
   - Mandale el link del portal para pagar el anticipo.
5. **Durante el proyecto:** carga avances e hitos en OPS. El cliente los ve en su portal y puede comentar y priorizar.
6. **Entrega:**
   - Carga los links en **Entrega final**.
   - Cuando paga el saldo, se le liberan solos.
7. **Soporte:** desde el mes 2, agrega cada mes un ítem "Soporte <mes>" para que lo pague entre el 25 y el 5.

---

## 12. Si algo falla
| Síntoma | Dónde mirar | Causa probable | Qué hacer |
|---|---|---|---|
| No llega la invitación ni aparece el link de Meet | Vercel → Logs → `schedule-meet` | `invalid_grant` (token rechazado) | Repetir OAuth Playground con **"Use your own OAuth credentials"** marcado antes del Step 1, pegar el token en Vercel y hacer Redeploy. |
| Log: "Google Calendar no configurado" | Variables de Vercel | Las `GOOGLE_*` no están en ese entorno | Marcarlas en Production y Preview, y hacer Redeploy. |
| Agendaste tú y no te llegó nada | — | Google no te manda invitaciones a ti mismo | Probar con un correo de otra cuenta. |
| El botón "Pagar" de Mercado Pago queda gris | — | Estás pagando con la misma cuenta que cobra | Pagar como invitado o con otra cuenta. |
| Se pagó pero el ítem sigue pendiente | Vercel → Logs → `[pagos]` | Firma inválida, monto distinto o webhook mal configurado | Revisar la URL del webhook, que el evento sea "Pagos", el `MP_WEBHOOK_SECRET` y Redeploy. |
| El portal no muestra el botón de pago | Variables de Vercel | Falta `MP_ACCESS_TOKEN` o el ítem no tiene monto | Cargar la variable o el monto. |
| La entrega final no aparece | OPS → proyecto → Presupuesto | No hay links o falta pagar un ítem bloqueante | Agregar los links o revisar los ítems marcados. |

---

## 13. Historial de cambios (PR #13 a #25)
| PR | Qué |
|---|---|
| #13 | Landing 2026 en fondo claro + kit de agentes HORIZON |
| #14 | Landing mobile-first: calculadora, carruseles, planes con color y CTA claros |
| #15 | `/agendar`: filtro de calificación antes del diagnóstico + diseño claro |
| #16 | Ajustes mobile: logos, panel, automatización, calculadora y orden de `/agendar` |
| #17 | Planes 01–04 y booking-confirm en diseño claro + casos Floremané, VitalFit y FITT |
| #18 | `/servicios` en diseño claro mobile-first |
| #19 | Recursos + OPS completo + Brief de reunión: diseño claro y mobile-first |
| #20 | Agenda: no prometer el email si Calendar falló; fecha del diagnóstico en `/reunion` |
| #21 | Página `/privacidad` (requisito de Google) |
| #22 | Portal: logo oficial y acento de marca |
| #23 | Documentos de cliente: datos sensibles fuera del repo público |
| #24 | WhatsApp de la consultoría y condiciones comerciales confirmadas |
| #25 | Portal desde la agenda + pagos con Mercado Pago + entrega final bloqueada |

---

## 14. Pendientes
- [ ] Cambiar el Client Secret de Google (quedó visible en una captura): en Google, *Add secret*; pegarlo en Vercel y hacer Redeploy; después, deshabilitar el viejo.
- [ ] Borrar los proyectos de Google Cloud que no se usan. **No tocar HORIZON - Scanner.**
- [ ] Crear `datos-privados.md` en el computador local (el contenido está en la conversación del 19-10-2026).
- [ ] Opcional: filtro en el bot de Mesa Cero para que solo responda mensajes de las demos.
- [ ] Opcional: generar el ítem de soporte mensual de forma automática.
- [ ] Usar la demo del portal en ventas y como contenido (reel Modo 3).
