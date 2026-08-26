# HORIZON — Ecosistema
> Versión 1.0 · 26 agosto 2026
> Mapa de cómo encajan todas las piezas: negocio, productos y stack técnico.

---

## 1. Las dos capas de negocio

```
                            HORIZON
                               │
            ┌──────────────────┴──────────────────┐
            │                                      │
     HORIZON AGENCIA                    HORIZON VERTICAL SAAS
   (sistemas a medida,                  (producto propio, mensual,
    instalación presencial)              por nicho específico)
            │                                      │
   ┌────────┴────────┐                   ┌─────────┴─────────┐
   │                 │                   │                   │
 El Sistema      Mesa Cero          Binks Barber         Mesa Cero
 (cualquier      (pitch/demo        (peluquerías/         (cuando se
  PyME de        de restaurante,     barberías —           vende como
  servicio)       mismo pricing      1er nicho,            SaaS liviano
                  que El Sistema)    ya construido)         — legacy,
                                                             ver nota)
```

**Nota sobre Mesa Cero:** aparece en las dos capas porque el producto **pivoteó** (agosto 2026, documentado en `MESA-CERO-VISION-Y-POSICIONAMIENTO.md` del repo `mesa-cero`). Nació como SaaS liviano tipo Binks Barber ($29.900–$149.900/mes sin setup grande). El research de mercado mostró que estaba muy por debajo de su valor real, así que se pivoteó a venderse como El Sistema (Agencia): setup $990.000 + mantención $190.000/mes, con la demo y el pitch de restaurante (Tía Julia) en vez del genérico. Hoy vive como **una vertical de Agencia**, no de SaaS — este documento lo trata así.

---

## 2. Los productos, uno por uno

### HORIZON Agencia — "El Sistema" (Nivel 01 + add-ons)
El producto principal, vendido a cualquier PyME de servicio (ver `HORIZON-BUYER-PERSONA.md`, Persona A) o a un restaurante bajo el pitch Mesa Cero (Persona B). Detalle funcional completo en `HORIZON-PRD-EL-SISTEMA.md`. Estructura de pricing vigente (igual a la landing, `Pages/HORIZON_Landing_2026.html#planes`):

| Nivel | Ítem | Precio | Frecuencia |
|---|---|---|---|
| 01 · Principal | Setup: landing + sistema | $990.000 CLP | Único, 1-2 cuotas |
| 01 · Principal | Mantención | $190.000 CLP | Mensual, siempre |
| 02 · Opcional | Auditoría + estrategia de contenido | $450.000 CLP | Único |
| 02 · Opcional | Contenido mensual | $600.000 CLP mínimo | Mensual, si continúa |
| 02 · Extra | Gestión de Ads | 15% del spend | Mensual, solo si aplica |
| 03 · Sugerencia | Identidad visual | $200.000 CLP | Único |

### HORIZON Vertical SaaS — Binks Barber
Producto ya construido (`verticales/peluquerias/`), multi-tenant sobre Supabase con RLS. Vende por autoservicio/venta liviana, no requiere instalación presencial completa como El Sistema.

| Plan | Precio/mes | Staff máx. |
|---|---|---|
| Starter | $29.900 CLP | 1 |
| Pro | $79.900 CLP | 4 |
| Studio | $149.900 CLP | 10 |

Módulos: agenda, clientes, staff, comisiones, ventas/caja, WhatsApp, mi billetera (pagos a staff), reportes, configuración, booking público.

### HORIZON OPS — la herramienta interna
No se le vende a nadie — es el sistema con el que Benja opera el negocio, y a la vez la demo viva de qué tan bien construye HORIZON software (`OPS/HORIZON-OPS-PRD.md`). 4 módulos: Dashboard operacional, Proyectos activos (workspaces), Pipeline unificado (CRM), Agente HORIZON (IA interna en modo Socio de Negocios / Líder Técnico).

---

## 3. El viaje del cliente — los 6 canales que "El Sistema" conecta

Este mapa nace del modelo de Mesa Cero (`MESA-CERO-VISION-Y-POSICIONAMIENTO.md`) pero aplica, generalizado, a cualquier vertical de HORIZON Agencia:

| Fase | Qué pasa | Canal(es) |
|---|---|---|
| **01 · Descubrimiento** | El negocio se presenta antes de que exista intención de compra | Google Business Profile, Instagram como feed de contenido, presencia en apps de terceros (PedidosYa, directorios) |
| **02 · Interés** | Un mensaje entrante ya es un lead calificado | DM de Instagram, WhatsApp — con agente de IA respondiendo |
| **03 · Decisión** | El cliente busca, compara, decide | Web propia, llamada (agente de voz), perfil de Google |
| **04 · Conversión** | La compra/reserva se concreta | El canal que sea — delivery, retiro, consumo en local, booking |
| **05 · Operación interna** | El negocio gestiona lo que ya vendió | Panel del dueño, tablero de estados (para restaurantes: cocina/mesero; para servicios: agenda/staff) |
| **06 · Postventa** | Se cierra el loop y se siembra la próxima compra | Encuesta por el mismo canal de origen, remarketing |

**Capa transversal — Panel del dueño:** no es "el centro", es la vista que organiza y redirige todo lo que ya está pasando en el resto de las fases hacia un solo lugar.

---

## 4. Stack técnico — el ecosistema de herramientas

| Capa | Herramienta | Para qué |
|---|---|---|
| Hosting / deploy | **Vercel** | Landing, sitios de cliente, APIs serverless |
| Backend / runtime | **Node.js + Express** (`server.js`) | Servidor propio para rutas y APIs internas |
| Base de datos | **Supabase** (Postgres + RLS) | Multi-tenant real — cada vertical SaaS tiene su set de tablas, aislado por Row Level Security |
| Pagos | **MercadoPago** | Cobro de clientes finales dentro de los sistemas vendidos (ej. Mesa Cero) |
| Mensajería | **WhatsApp Business API** | Canal principal de atención automatizada por IA |
| Automatización | **n8n** (mencionado en `SISTEMA-DE-CIERRE.md` como `project-n8n`), **Make**, **Zapier** | Workflows reactivos hoy (ej. WhatsApp por cambio de estado de lead); seguimiento proactivo es un hueco identificado, no construido |
| IA / agentes | **Claude API** (Anthropic) | Agentes de WhatsApp/Instagram/voz para clientes, y el Agente HORIZON interno (Módulo D de OPS) |
| Growth / pauta | **Meta Ads, Google Ads** | Ejecutados dentro del Nivel 02 "Gestión de Ads" |
| CRM / GHL | **GoHighLevel** (logo en landing) | Presente en el stack mostrado al cliente como parte del ecosistema de herramientas que HORIZON integra |

Todo esto se muestra explícitamente en el marquee de logos de la landing (`Pages/HORIZON_Landing_2026.html`) — no es un detalle interno, es parte de cómo HORIZON demuestra credibilidad técnica frente al cliente.

---

## 5. Cómo se retroalimentan las piezas (por qué esto es un ecosistema y no una lista de productos)

1. **El Sistema financia y valida** — cada cliente de alto ticket paga por adelantado la operación y da el caso real (como Vitalkine, Floremané) que se usa para vender el siguiente.
2. **Binks Barber es el motor de volumen** — no depende de que Benja instale en persona con la misma intensidad, así que puede crecer sin estar limitado 1:1 por sus horas.
3. **OPS es el nervio que conecta todo** — sin él, cada capa (pipeline, proyectos, métricas) vive en archivos sueltos que no escalan (problema explícito que originó `OPS/HORIZON-OPS-PRD.md`).
4. **El Sistema de Cierre alimenta el contenido, y el contenido alimenta el pipeline** — cada diagnóstico genera una nota de voz con objeciones reales (Componente 5 de `SISTEMA-DE-CIERRE.md`), que se convierte en el ángulo de contenido de la semana, que atrae al siguiente lead. Es un loop, no un embudo lineal.
5. **La demo real de una vertical vende a la siguiente** — Mesa Cero se construyó reutilizando el motor de Binks Barber (mismo patrón de tablas multi-tenant), y cada vertical nueva hereda tiempo de desarrollo más corto que la anterior. Esa es la ventaja de costos real de HORIZON — no algo que haya que cobrarle al cliente (explícito en `MESA-CERO-VISION-Y-POSICIONAMIENTO.md`, sección 5).

---

*Documento vivo — cuando se sume una vertical nueva (además de peluquerías y restaurantes) o un módulo nuevo de OPS, este mapa se actualiza primero acá.*
