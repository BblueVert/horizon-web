# HORIZON OPS — Prompt Maestro de Desarrollo
> El brief técnico que define cómo construir este sistema.
> Versión 1.0 · 31 mayo 2026

---

## Contexto del Proyecto

Estoy construyendo **HORIZON OPS**, el sistema interno de operaciones de HORIZON — una consultoría de ecosistemas digitales con IA para PyMEs de la Región de O'Higgins, Chile.

**Lo que ya existe y no se toca:**
- Sitio web + landing en `horizonweb.cl` (Express + vanilla JS + Supabase)
- CRM Pipeline en `Pages/CRM/pipeline.html` — kanban de leads conectado a Supabase
- Portal de Cliente en `Pages/portal/index.html` — acceso por UUID token
- Agenda en `Pages/agendar/index.html`
- DB Supabase (proyecto `dkitbnrpwmwrfnmztdfc`): tablas `leads`, `projects`, `project_milestones`, `portal_events`
- RLS activo en todas las tablas. Anon solo puede hacer INSERT en leads y UPDATE en leads.brief

**Lo nuevo que construimos:**
Sistema central en carpeta `OPS/` con 4 módulos. Todo el código nuevo va ahí hasta integración final.

---

## Stack Técnico

```
Frontend:     HTML + CSS + Vanilla JS (sin frameworks, igual que el resto del proyecto)
Backend:      Express.js (server.js ya existe, solo agregamos rutas)
Base de datos: Supabase (PostgreSQL) — misma instancia, nuevas tablas
IA:           Claude API (claude-sonnet-4-6) para el Agente HORIZON
Auth:         Cookie de sesión simple para proteger el acceso a /ops
Estilo:       Dark mode, identidad HORIZON — mismas CSS variables que el proyecto:
              --void: #07060e  --h1: #ff6b35  --h2: #ff8c42
              --fm: DM Mono    --fd: Bebas Neue  --fb: Plus Jakarta Sans
```

---

## Los 4 Módulos

### MÓDULO A — Dashboard Operacional (`OPS/index.html`)

**Qué muestra:**
```
┌─────────────────────────────────────────────────────┐
│  MRR            Pipeline CLP    Proyectos    Cupos   │
│  $XXX.000/mes   $X.XXX.000      X activos    XX/50   │
├─────────────────────────────────────────────────────┤
│  Próximas reuniones    │    Últimos movimientos      │
│  (desde reunion_fecha) │    (historial leads)        │
└─────────────────────────────────────────────────────┘
```

**Fuentes de datos:**
- MRR: `SELECT SUM(mrr) FROM leads WHERE status = 'activo'`
- Pipeline: calcular en JS con el objeto PLANS × leads por status
- Proyectos: `SELECT COUNT(*) FROM projects WHERE estado != 'entregado'`
- Cupos: 10 - count leads fundadores por plan

---

### MÓDULO B — Workspaces (`OPS/proyectos.html` + `OPS/proyecto-detalle.html`)

**Vista lista:** tarjetas con cliente, plan, % avance, próximo hito.

**Vista detalle — 4 tabs:**

**Tab 1: Roadmap**
Muestra y edita `project_milestones`. Cada milestone:
- Nombre, descripción, fecha_target, estado (pending/in_progress/done)
- Barra de progreso visual
- Collapsible con lista de deliverables (JSONB)

**Tab 2: Backlog**
CRUD sobre tabla `tasks`. Columnas: título, estado, prioridad, fecha.
Drag-and-drop entre estados (pendiente → en progreso → hecho).

**Tab 3: Timeline**
Cronología de `portal_events` del cliente, ordenada por fecha descendente.
Tipos de eventos con ícono: booking, brief, reunion, propuesta, nota, mensaje.

**Tab 4: Docs**
Formulario simple para actualizar campos en `leads`:
- propuesta_url, contrato_url, github_url, notion_url
- Link al portal del cliente (`/c/{portal_token}`)
- Indicador: ¿El cliente completó el brief? (verificar `leads.brief`)

---

### MÓDULO C — Pipeline Unificado (`OPS/pipeline.html`)

Migración del CRM actual dentro de HORIZON OPS.
**Sin cambios de lógica** — solo cambiar el contenedor para que use la sidebar y estilos de OPS.

**Agrega sobre el CRM actual:**
Botón "Activar Proyecto" en tarjetas con `status = 'arranque'`:
```javascript
async function activarProyecto(lead) {
  // 1. Crear project en Supabase
  // 2. Crear 3 milestones base según lead.plan
  // 3. Redirect a /ops/proyecto/:id
}
```

**Milestones base por plan:**
```javascript
const MILESTONES_BASE = {
  plan01: ['Diagnóstico y diseño', 'Desarrollo y contenido', 'Deploy y entrega'],
  plan02: ['Diagnóstico y arquitectura', 'Desarrollo core', 'Integraciones', 'Deploy y entrega'],
  plan03: ['Auditoría del negocio', 'Infraestructura digital', 'Automatizaciones', 'Campañas activas', 'Entrega y handoff'],
  plan04: ['Diagnóstico técnico', 'Arquitectura del sistema', 'Desarrollo IA', 'Automatizaciones n8n', 'Testing y deploy'],
  plan05: ['Brief y entrenamiento', 'Desarrollo del agente', 'Testing y ajuste', 'Deploy y monitoreo'],
};
```

---

### MÓDULO D — Agente HORIZON (`OPS/agente.html` + `OPS/api/agente.js`)

**API Endpoint:**
```javascript
// POST /api/ops/agente
// Body: { modo: 'socio' | 'tecnico', mensaje: string, contexto: object }
// Headers: Authorization (cookie de sesión)

const SYSTEM_PROMPTS = {
  socio: `Sos el consultor estratégico interno de HORIZON, una consultoría de
ecosistemas digitales con IA para PyMEs en Chile. Ayudás a Benja (el founder)
a tomar decisiones comerciales y operativas. Tenés acceso a los datos reales
del negocio que se te pasan como contexto. Hablás en español, tuteo chileno.
Sos directo, concreto, sin rodeos. Si no tenés el dato, pedilo.

Contexto del negocio:
{DASHBOARD_DATA}`,

  tecnico: `Sos el líder técnico interno de HORIZON. Ayudás a Benja a
planificar y ejecutar los proyectos que está construyendo para sus clientes.
Conocés el stack: Express + Vanilla JS + Supabase + n8n + Claude API.
Analizás el estado del proyecto que se te pasa como contexto y dás
recomendaciones específicas y accionables. Español, tuteo chileno.

Contexto del proyecto activo:
{PROJECT_DATA}`,
};
```

**Rate limiting:** 10 requests/minuto (reusar función `rateLimit` de `api/shared.js`).

**Context injection:**
- Modo Socio: pasar datos del dashboard (MRR, pipeline, leads activos, próximas reuniones)
- Modo Técnico: pasar datos del proyecto seleccionado (milestones, tasks, portal_events recientes, notas)

---

## Reglas de Desarrollo

**1. Consistencia visual**
Usar exactamente las mismas CSS variables, fuentes y tokens de color del proyecto existente. No inventar nuevos. El sistema OPS tiene que verse como parte del mismo producto.

**2. Sin frameworks**
Todo vanilla JS, igual que el resto del proyecto. Si necesitás algo de drag-and-drop, implementarlo liviano o buscar una lib de ~5kb.

**3. Primero funcional, después perfecto**
Cada módulo arranca mostrando datos reales aunque la UI sea básica. No bloquear un módulo por detalles visuales.

**4. Una fuente de verdad**
Supabase es la DB. No hay estado en localStorage para datos del negocio (sí para UI, como el tab activo). Si el usuario recarga, los datos siguen ahí.

**5. Seguridad**
- Acceso a `/ops/*` protegido por cookie de sesión
- Las API de OPS usan `SUPABASE_SERVICE_ROLE_KEY` (acceso total, solo backend)
- No exponer service role key en el frontend
- Rate limiting en todos los endpoints

**6. Commits por módulo**
Commitear al terminar cada módulo completo, no al terminar cada archivo.

---

## Preguntas a Resolver Antes de Empezar

Antes de la Fase 1, confirmar con el usuario:

1. **Autenticación:** ¿Password simple (un usuario, una clave en .env) o IP allowlist? ¿O ya tiene Supabase Auth configurado?
2. **Claude API Key:** ¿Ya tiene? ¿Necesita crearla?
3. **Acceso desde el CRM actual:** ¿Reemplazar `Pages/CRM/pipeline.html` con redirección a `OPS/pipeline.html`, o dejar los dos?
4. **Lead de prueba:** ¿Borrar "Carlos Prueba" antes de empezar o usarlo para testing?

---

*Este prompt es el brief técnico de referencia. Cualquier decisión de arquitectura que no esté cubierta acá se resuelve preguntando antes de implementar.*
