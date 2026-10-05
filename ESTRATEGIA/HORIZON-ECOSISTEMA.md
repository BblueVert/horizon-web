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

### HORIZON Agencia — 4 planes
El producto principal, vendido a cualquier PyME de servicio (ver `HORIZON-BUYER-PERSONA.md`, Persona A) o a un restaurante bajo el pitch Mesa Cero (Persona B). Detalle funcional completo en `HORIZON-PRD-EL-SISTEMA.md`. Estructura de pricing vigente (octubre 2026, igual a la landing `Pages/HORIZON_Landing_2026.html#planes` y a `/plan-01` … `/plan-04`):

| Plan | Qué es | Implementación | Plazo | Soporte mensual (desde el mes 2) |
|---|---|---|---|---|
| 01 · Presencia Digital | Página web profesional + Google Business + WhatsApp + chatbot básico | $490.000 CLP | 3–4 semanas | $120.000 · con IA $290.000 |
| 02 · Ecosistema Digital | Web + sistema (reservas, tienda o caja) + CRM + dashboard | $990.000 CLP | 4–5 semanas | $200.000 · con IA $390.000 |
| 03 · Sistema con IA | Sistema de IA personalizado: Plan 02 + agente IA + n8n + Meta Ads | $1.990.000 CLP | 5–6 semanas | $350.000 Mantenimiento + Ads · $490.000 Sistema completo + IA |
| 04 · Agente IA Personalizado | Empleado virtual 24/7 en WhatsApp, Instagram y web; solo o sumado a otro plan | desde $1.490.000 CLP | 2–3 semanas | $290.000 |

- Todos los precios + boleta de honorarios. El primer mes de soporte va incluido; luego es mes a mes, sin permanencia.
- **Programa Fundadores** (3 negocios): mismo precio, sin descuento. Beneficios: segundo mes de soporte sin costo, valor del soporte congelado 12 meses, sesión de resultados a los 60 días y atención prioritaria por WhatsApp. A cambio: testimonio en video, permiso para mostrar el caso, encuesta a los 30 días y reseña voluntaria.
- Ya no se ofrecen como servicios aparte: Auditoría + Contenido, Contenido Mensual, Gestión de Ads (15% del spend) e Identidad Visual. La auditoría y Meta Ads quedan dentro del Plan 03.
- Claves internas en la BD de leads (OPS): `plan01` = Plan 01, `plan02` = Plan 02, `plan04` = Plan 03 Sistema con IA, `plan05` = Plan 04 Agente IA, `plan03` = plan anterior "Negocio Activo".

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
| Growth / pauta | **Meta Ads, Google Ads** | Ejecutados dentro del Plan 03 "Sistema con IA" |
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
