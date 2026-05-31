# HORIZON OPS — Plan de Acción
> Secuencia de construcción con criterios de aceptación claros.
> Versión 1.0 · 31 mayo 2026

---

## Principio de Trabajo

**No se toca nada del sitio existente hasta la Fase 5.**

Landing, CRM, portal de cliente, agenda — todo sigue funcionando igual. HORIZON OPS se construye en `OPS/` en paralelo. La integración es el último paso, no el primero.

---

## FASE 1 — Base de Datos y Estructura
*Estimado: 1 sesión*

### 1.1 — Schema nuevas tablas
Ejecutar en Supabase SQL Editor (o vía MCP):
- Crear tabla `tasks` (backlog por proyecto)
- Agregar columna `mrr integer default 0` a `leads`
- RLS en `tasks`: misma lógica que `project_milestones`

**Criterio de aceptación:** Query `SELECT * FROM tasks LIMIT 1` ejecuta sin error.

### 1.2 — Estructura de archivos
Crear esqueleto vacío de la carpeta `OPS/` con todos los archivos definidos en el PRD. Solo estructura — sin contenido todavía.

**Criterio de aceptación:** Todos los archivos existen y son accesibles desde Express (`server.js`).

### 1.3 — Navegación lateral compartida + estilos base
Diseñar la barra de navegación lateral (sidebar) de HORIZON OPS. Identidad oscura, logo HORIZON, 5 items: Dashboard · Pipeline · Proyectos · Agente · (salir / volver al sitio).

**Criterio de aceptación:** La nav se ve correcta en todos los módulos sin repetir CSS.

---

## FASE 2 — Dashboard Operacional y Pipeline
*Estimado: 1–2 sesiones*

### 2.1 — Dashboard con datos reales
`OPS/index.html` muestra:
- MRR total (suma de `leads.mrr` donde `status = 'activo'`)
- Pipeline CLP (suma de `PLANS[plan].preciof` para leads en etapas `new/contactado/propuesta`)
- Proyectos activos (count de `projects` con `estado != 'entregado'`)
- Cupos restantes por plan (10 - count de leads por plan con `tipoprecio = 'fundador'`)
- Próximas reuniones (leads con `reunion_fecha > now()` ordenados por fecha)

**Criterio de aceptación:** Los números coinciden con los que se ven manualmente en Supabase.

### 2.2 — Pipeline unificado
`OPS/pipeline.html` es el CRM actual adaptado al sistema OPS (sidebar + estilos unificados). No cambia lógica, solo vive dentro del contenedor nuevo.

**Criterio de aceptación:** Todo lo que funciona en `Pages/CRM/pipeline.html` funciona igual acá.

### 2.3 — Flujo de promoción lead → proyecto activo
En la tarjeta de cada lead con `status = 'arranque'`, botón "Activar Proyecto":
1. Crea registro en `projects` (lead_id, nombre, plan, estado: 'init')
2. Crea 3 milestones base por defecto según el plan
3. Redirige al workspace del proyecto recién creado

**Criterio de aceptación:** Crear proyecto desde la tarjeta de Carlos Prueba (lead de prueba). Verificar que aparece en `OPS/proyectos.html`.

---

## FASE 3 — Workspaces de Proyectos
*Estimado: 2 sesiones*

### 3.1 — Lista de proyectos activos
`OPS/proyectos.html` muestra tarjetas de cada proyecto activo:
- Nombre del cliente + empresa
- Plan contratado + MRR
- % de avance (milestones completados / total)
- Próximo hito con fecha
- Acceso directo al workspace

### 3.2 — Workspace individual (proyecto-detalle.html)
4 tabs dentro de la vista de cada proyecto:
1. **Roadmap** — milestones con fechas, estado (pendiente/en progreso/hecho), deliverables
2. **Backlog** — lista de tareas, crear/editar/cambiar estado, prioridad
3. **Timeline** — cronología de eventos de `portal_events` del cliente
4. **Docs** — links a propuesta, contrato, repositorio, Notion, portal público

**Criterio de aceptación:** Crear un milestone y una tarea para el proyecto de prueba. Verificar que persisten en Supabase.

### 3.3 — Conexión con portal del cliente
En la pestaña Docs del workspace, link directo a `horizonweb.cl/c/{portal_token}`.
Bonus: indicador de si el cliente ya completó el brief (verificar campo `brief` en leads).

---

## FASE 4 — Agente HORIZON
*Estimado: 1 sesión*

### 4.1 — API proxy Claude
`OPS/api/agente.js` — endpoint POST que:
- Recibe `{ modo, mensaje, contexto }`
- Inyecta el system prompt correspondiente (Socio o Técnico)
- Llama a Claude API con el contexto real del negocio
- Devuelve la respuesta

Clave de API en `.env` como `ANTHROPIC_API_KEY`. Rate limit: 10 req/min.

### 4.2 — Chat con dos modos
`OPS/agente.html`:
- Toggle visible: "Modo Socio" / "Modo Técnico"
- Campo de texto + botón enviar + historial de conversación en la sesión
- Modo Socio: contexto = datos del dashboard (MRR, pipeline, leads)
- Modo Técnico: contexto = proyecto activo seleccionado (milestones, backlog, notas)
- Selector de proyecto activo cuando estés en Modo Técnico

**Criterio de aceptación:** Pregunta en Modo Socio: "¿Cuánto vale mi pipeline actual?" → Responde con el número real. Pregunta en Modo Técnico sobre el proyecto de prueba → Responde con los milestones reales.

---

## FASE 5 — Integración y Deploy
*Estimado: 1 sesión*

### 5.1 — Acceso protegido
HORIZON OPS es solo para Benja. Opciones:
- Password simple con cookie de sesión (sin Supabase Auth)
- O restringir a IP (más simple pero menos portable)
- Decisión final a confirmar con el usuario

### 5.2 — Rutas en Express
Agregar al `server.js` existente las rutas para `/ops`, `/ops/pipeline`, `/ops/proyectos`, etc.

### 5.3 — Link de acceso
Desde el CRM actual (`Pages/CRM/pipeline.html`): botón "Ir a HORIZON OPS" en el header.
Desde la landing: ningún link público — acceso solo por URL directa.

### 5.4 — Verificación final
- [ ] Todos los módulos cargando datos reales
- [ ] Flujo lead → proyecto activo funciona end-to-end
- [ ] Agente responde con contexto correcto en ambos modos
- [ ] No hay errores de consola en producción
- [ ] Eliminar lead de prueba "Carlos Prueba"

---

## Orden de Prioridad

Si hay que recortar alcance, este es el orden:

1. **Crítico** — Dashboard + Pipeline (Fases 1-2) → visibilidad del negocio
2. **Importante** — Workspaces básicos (Fase 3.1 + 3.2 sin Docs) → gestión de proyectos
3. **Nice to have** — Agente IA (Fase 4) → puede venir después
4. **Integración** — Fase 5 al final siempre

---

*El objetivo no es construir todo perfecto de una. Es tener cada módulo funcionando con datos reales antes de pasar al siguiente.*
