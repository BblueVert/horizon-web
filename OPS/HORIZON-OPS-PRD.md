# HORIZON OPS — Centro de Operaciones
> Documento de referencia para el desarrollo del sistema interno de HORIZON.
> Versión 1.0 · 31 mayo 2026

---

## El Contexto

HORIZON arrancó como una agencia web. Ya no es solo eso.

Lo que estás construyendo es un sistema de consultoría con software propio — donde cada cliente recibe un ecosistema a medida, no solo una web. Eso requiere una operación interna a la altura.

El CRM que ya existe (`pipeline.html`) es bueno. Pero gestionar leads, proyectos activos, métricas de negocio y desarrollo técnico de clientes desde archivos separados no escala. **HORIZON OPS centraliza todo eso en un solo sistema.**

Y además de ser funcional para vos, es una demo en vivo del nivel de software que HORIZON entrega.

---

## Qué existe hoy (base sobre la que construimos)

| Componente | Archivo | Estado |
|---|---|---|
| CRM Pipeline | `Pages/CRM/pipeline.html` | ✅ Activo |
| Portal de Cliente | `Pages/portal/index.html` | ✅ Activo |
| Agenda / Booking | `Pages/agendar/index.html` | ✅ Activo |
| Reunión Brief | `Pages/reunion/index.html` | ✅ Activo |
| DB — leads | Supabase `public.leads` | ✅ Con RLS |
| DB — projects | Supabase `public.projects` | ✅ Creada |
| DB — milestones | Supabase `public.project_milestones` | ✅ Creada |
| DB — portal_events | Supabase `public.portal_events` | ✅ Activa |

HORIZON OPS no reemplaza nada de esto — lo absorbe.

---

## El Sistema: 4 Módulos

### MÓDULO A — Dashboard Operacional

**Para qué sirve:** Vista de alto nivel del negocio. Entrás a HORIZON OPS y en 10 segundos sabés cómo está el negocio.

**Qué muestra:**
- MRR consolidado (suma de retainers activos en CLP)
- Valor total del pipeline (leads × precio del plan)
- Proyectos activos vs. leads en etapa de diagnóstico
- Cupos fundadores restantes por plan (del 1 al 5)
- Próximas reuniones agendadas (desde `reunion_fecha`)
- Últimos movimientos del pipeline (historial reciente)

**Qué NO hace:** No es un analytics externo. Es el pulso del negocio operado por Benja, con los datos reales de Supabase.

---

### MÓDULO B — Proyectos Activos (Workspaces)

**Para qué sirve:** Cuando un lead pasa a `status: arranque`, automáticamente tiene un espacio de trabajo en HORIZON OPS. Acá gestionás todo lo que estás construyendo para ese cliente.

**Cada workspace contiene:**
- **Roadmap** — hitos del proyecto con fechas y estado (usa tabla `project_milestones`)
- **Backlog técnico** — lista de tareas del proyecto (tabla nueva: `tasks`)
- **Timeline** — cronología de eventos: reuniones, entregas, mensajes (tabla `portal_events`)
- **Docs** — links a propuesta, contrato, repositorio, Notion (campos en `leads`)
- **Portal del cliente** — acceso directo al portal público del cliente (por `portal_token`)
- **Notas internas** — campo `session_notas` de la tabla leads, solo visible acá

**El flujo es:**
```
Lead nuevo → Diagnóstico → Reunión → Arranque → Proyecto Activo → Entregado
```
Cuando cambiás el status a `arranque`, el workspace se activa solo.

---

### MÓDULO C — Pipeline Unificado

**Para qué sirve:** Es el CRM actual, pero integrado. El kanban que ya existe (`pipeline.html`) vive dentro de HORIZON OPS como uno de los módulos, no como una página aparte.

**Qué agrega sobre lo que ya hay:**
- Botón "Promover a Proyecto Activo" en la tarjeta del lead (crea el workspace en Módulo B)
- Vista de lista + kanban (el kanban ya existe, la lista también)
- Filtros por plan, prioridad, status — igual que hoy
- Stats bar con Pipeline CLP usando los precios nuevos (ya corregidos)

**Lo que no cambia:** Los datos son los mismos. La tabla `leads` no se toca. Solo cambia el contenedor visual.

---

### MÓDULO D — Agente HORIZON (IA Interna)

**Para qué sirve:** Un consultor interno que conoce el contexto completo de HORIZON y de cada proyecto. Dos modos, conmutables con un clic.

**Modo 1 — Socio de Negocios:**
Contexto: métricas del dashboard, clientes activos, pipeline, planes y precios, historial del negocio.
Para: "¿Qué lead tiene más probabilidad de cerrar esta semana?", "¿Cuánto MRR podría sumar si cierro los 3 leads actuales?", "¿Qué plan vendo más y por qué?"

**Modo 2 — Líder Técnico:**
Contexto: el proyecto activo que estés viendo, stack del cliente, milestones, backlog, notas técnicas.
Para: "¿Qué está bloqueando el proyecto de Floremané?", "Armame la arquitectura para el chatbot de este cliente", "¿Qué queda por entregar en el roadmap?"

**Stack:** Claude API (claude-sonnet-4-6). Context injection desde los datos del módulo activo. Sin historial persistente — cada conversación arranca limpia desde el contexto del momento.

---

## Schema de Base de Datos — Tablas Nuevas

### Tabla `tasks` (backlog por proyecto)
```sql
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects(id) on delete cascade,
  titulo       text not null,
  descripcion  text,
  estado       text default 'pendiente', -- pendiente | en_progreso | hecho
  prioridad    text default 'media',     -- alta | media | baja
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
```

### Modificaciones a tablas existentes
- `leads.tipoprecio`: agregar valor `'retainer'` además de `'fundador'` y `'normal'`
- `leads.mrr`: campo nuevo `integer default 0` para retainer mensual en CLP

---

## Estructura de Archivos (carpeta OPS/)

```
OPS/
  index.html              → Dashboard Operacional (Módulo A)
  proyectos.html          → Vista de Proyectos Activos (Módulo B)
  proyecto-detalle.html   → Workspace individual de un cliente
  pipeline.html           → Pipeline Unificado (Módulo C, basado en CRM existente)
  agente.html             → Agente HORIZON (Módulo D)
  api/
    ops-data.js           → Endpoint datos del dashboard
    tasks.js              → CRUD de tareas
    promote-lead.js       → Promover lead → proyecto activo
    agente.js             → Proxy Claude API
  shared/
    nav.html              → Barra de navegación lateral (compartida)
    ops-styles.css        → Estilos base del sistema OPS
```

---

## Fases de Construcción

### Fase 1 — Estructura y DB (sin tocar nada existente)
- [ ] Crear schema de tablas nuevas en Supabase
- [ ] Agregar columna `mrr` a `leads`
- [ ] Estructura de archivos en `OPS/`
- [ ] Barra de navegación lateral compartida
- [ ] Estilos base del sistema

### Fase 2 — Dashboard + Pipeline
- [ ] Dashboard operacional con datos reales de Supabase
- [ ] Pipeline unificado (migrar CRM actual a OPS/pipeline.html)
- [ ] Flujo de promoción lead → proyecto activo

### Fase 3 — Workspaces de Proyectos
- [ ] Lista de proyectos activos
- [ ] Vista detalle: roadmap, backlog, timeline, docs
- [ ] Conexión con portal del cliente

### Fase 4 — Agente HORIZON
- [ ] API proxy para Claude
- [ ] Chat con dos modos (Socio / Técnico)
- [ ] Context injection por módulo

### Fase 5 — Integración y Deploy
- [ ] Vincular desde la landing y el portal existente
- [ ] Acceso protegido (solo Benja)
- [ ] Mover CRM actual a OPS como ruta legacy o reemplazar
- [ ] Deploy y pruebas en producción

---

## Criterios de Éxito

1. Entrás a HORIZON OPS y en menos de 10 segundos sabés cómo está el negocio
2. Podés mover un lead a proyecto activo y que el workspace aparezca inmediatamente
3. El Agente HORIZON responde con contexto real del negocio, no respuestas genéricas
4. El sistema se ve como software de $890.000 — no como un panel interno mal hecho
5. No hay duplicidad de datos: todo lee de la misma DB de Supabase

---

*HORIZON OPS es, al mismo tiempo, la herramienta interna y la demostración viva de lo que HORIZON construye para sus clientes.*
