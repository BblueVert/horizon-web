# PRD — HORIZON "El Sistema" (Nivel 01)
> Versión 1.0 · 26 agosto 2026
> Documento de producto para el ítem que genera más facturación de HORIZON Agencia.
> Complementa (no reemplaza) `OPS/HORIZON-OPS-PRD.md`, que es la herramienta *interna*. Este PRD es sobre lo que se le vende y se le instala al cliente.

---

## 1. El problema que resuelve

El cliente (ver `HORIZON-BUYER-PERSONA.md`) recibe clientes por 3 a 6 canales sueltos — WhatsApp, Instagram, web (si tiene), teléfono, local físico — y ninguno habla con el otro. Nadie ve todo junto. El dueño es el único punto de conexión entre canales, y cuando el dueño no está disponible, el negocio tampoco.

**"El Sistema" no es una página web.** Es la capa que conecta esos canales entre sí, con un agente de IA atendiendo en los que el dueño no alcanza a cubrir, y un panel donde el dueño ve todo en un solo lugar.

---

## 2. Usuarios

| Usuario | Qué necesita del sistema |
|---|---|
| **Dueño del negocio** | Ver todo lo que está pasando (leads, pedidos, reservas) en un panel, sin tener que revisar 4 apps distintas. Delegar la atención fuera de horario a un agente de IA que suene como su negocio. |
| **Staff (cuando aplica)** | Una vista simple de lo que le corresponde a cada rol (ej. cocina, mesero, recepción) — sin necesitar capacitación larga. |
| **Cliente final** | Poder contactar por el canal que prefiera (WhatsApp, Instagram, web, teléfono, QR en el local) y recibir la misma calidad de respuesta, la misma info, el mismo precio, sin importar la puerta de entrada. |

---

## 3. Alcance funcional — qué es real hoy y qué es visión

Esta tabla es la parte más importante del documento. Se adapta directamente del patrón que ya usa Mesa Cero (`GUION-VENTA-PUERTA-A-PUERTA-v3.md`, sección "Qué es real y qué es visión de producto") — **la regla de no vender en el pitch algo que no se puede demostrar en el momento aplica a todo El Sistema, no solo a Mesa Cero.**

| Funcionalidad | Estado |
|---|---|
| Landing/sitio de pedido o de contacto propio, con dominio y SSL | **Real** — es lo primero que se entrega, base del resto |
| Panel del dueño (métricas, leads/pedidos en vivo) | **Real**, con datos reales del cliente una vez instalado |
| Chatbot básico en web + WhatsApp Business integrado | **Real** |
| Bot de WhatsApp con IA que conversa en lenguaje natural (no respuestas fijas) | **Real, pero requiere el número de WhatsApp Business del negocio dado de alta ante Meta** — no está activo el mismo día de la instalación si el cliente no tiene ese número listo |
| DM automatizado de Instagram con el mismo motor | **Parcial** — depende de permisos de la cuenta de Instagram del cliente (Meta Business) |
| Agente de voz para llamadas | **Existe como demo funcional** (ver Mesa Cero). Para producción real requiere número de teléfono dedicado — no prometer como "ya activo" en el pitch si no se lleva corriendo en la instalación |
| Automatización de leads (registro + notificación al dueño) | **Real** |
| CRM básico / dashboard de métricas | **Real** para lo que ya existe en `OPS`/`Pages/CRM/pipeline.html`; para el cliente final depende del alcance contratado |
| Cobro integrado (MercadoPago) | **Conectado técnicamente, con datos de prueba** — falta el token real del negocio de cada cliente nuevo, se activa en la instalación |
| SEO técnico + local | **Real** |
| GEO (optimización para que IAs como ChatGPT/Perplexity mencionen el negocio) | **Real** en estructura (schema markup, contenido). Su efecto (que un modelo lo mencione) no es medible ni garantizable — se vende como buena práctica, no como resultado asegurado |
| Automatizaciones avanzadas (n8n) más allá de las reactivas por estado | **Visión** — el seguimiento proactivo a leads fríos está identificado como hueco (`SISTEMA-DE-CIERRE.md`, Componente 4) pero no construido todavía |
| Multi-tenant con roles (ej. cocina/mesero/dueño, o staff/comisiones) | **Real** cuando el vertical ya lo tiene construido (Binks Barber, Mesa Cero). Para un cliente de agencia genérica sin vertical, el alcance de roles se define en el diagnóstico, no es un checkbox automático |

**Regla de aplicación para el pitch y la instalación:** antes de cada demo o instalación, repasar esta tabla. Lo que está en "Real" se muestra andando. Lo que está en "Parcial" o "Visión" se presenta como "hacia dónde va esto", nunca como funcionalidad activa del día uno.

---

## 4. Fuera de alcance (explícito)

- **No es un POS/caja con facturación electrónica SII.** Convive con el sistema de caja que el negocio ya tenga (o no tenga) — no lo reemplaza.
- **No es un ERP ni maneja inventario/stock complejo.**
- **No integra profundamente con apps de delivery de terceros** (PedidosYa, etc.) — esas son vitrinas de presencia en la fase de Descubrimiento, no un canal transaccional a integrar en el corto plazo.
- **No garantiza posicionamiento en buscadores ni menciones de IA** — se construye la base técnica correcta, el resultado depende de factores externos.

---

## 5. Arquitectura (alto nivel)

- **Frontend:** HTML/CSS/JS a medida por cliente (no un builder tipo Wix), desplegado en Vercel.
- **Backend:** Node.js + Express (patrón de `server.js` de `horizon-web`), APIs serverless donde aplica.
- **Datos:** Supabase (Postgres) con Row Level Security — cada cliente/tenant aislado a nivel de fila, siguiendo el patrón ya probado en `verticales/_core`.
- **IA:** Claude API para los agentes conversacionales (WhatsApp/Instagram/web), con contexto inyectado del negocio específico del cliente (menú, servicios, precios, preguntas frecuentes reales).
- **Mensajería:** WhatsApp Business API (oficial, requiere aprobación de Meta por negocio).
- **Pagos:** MercadoPago, con token propio por cliente.

Ninguna pieza de este stack es exclusiva de un cliente — el mismo motor se reutiliza y adapta, lo que mantiene el costo real de HORIZON por debajo de lo que le costaría a un cliente construir esto desde cero (ver `HORIZON-MARKET-FIT.md`, sección 2C).

---

## 6. Métricas de éxito del producto

No son metas de negocio (esas están en `HORIZON-PLAN-DE-ACCION-2026.md`) — son señales de que el producto, como tal, está funcionando:

| Métrica | Objetivo |
|---|---|
| Tiempo desde firma hasta instalación completa | ≤ 4 semanas (rango real documentado: 3–6 semanas) |
| Tiempo de respuesta del agente de IA (WhatsApp/web) | < 30 segundos en horario, siempre activo fuera de horario |
| % de leads que llegan por un canal y quedan registrados en el panel | 100% — ningún lead se pierde por canal suelto |
| Rondas de revisión post-entrega necesarias | ≤ 2 (lo que ya promete la FAQ pública de la landing) |
| Clientes Nivel 01 activos que suben a Nivel 02 (Auditoría/Contenido) | Métrica a empezar a medir desde el primer cliente — hoy no hay dato |

---

## 7. Roadmap de producto (ligado al Plan de Acción)

| Horizonte | Qué se construye/mejora |
|---|---|
| **Ahora – Mes 1** | Sincronizar todo el pricing interno (CRM, páginas de detalle de servicios) con el modelo de 3 niveles ya vigente en la landing. Sin esto, cualquier venta corre el riesgo de citar un precio que ya no existe. |
| **Mes 1–3** | Cerrar el hueco de seguimiento proactivo a leads fríos (Componente 4 de `SISTEMA-DE-CIERRE.md`) — es la pieza de automatización con más impacto directo en tasa de cierre y today no existe. |
| **Mes 3–6** | Avanzar el CRM único + base de conocimiento autoaprendiente (la idea de mayor impacto identificada en `MESA-CERO-VISION-Y-POSICIONAMIENTO.md`, sección 3) — que las conversaciones reales mejoren las respuestas del agente con el tiempo, no solo guiones fijos. |
| **Mes 6–12** | Evaluar productizar partes de "El Sistema" para reducir tiempo de instalación por cliente (plantillas configurables sobre el mismo motor) — el paso necesario para que la Agencia deje de depender 1:1 de las horas de Benjamín. |

---

## 8. Criterios de éxito del documento

1. Nadie en HORIZON (o sea, Benjamín) promete en un pitch algo que la tabla de la sección 3 marca como "Visión".
2. Cada vez que el pricing cambie en la landing, este documento y el CRM se actualizan el mismo día — no queda una fuente de verdad desincronizada de otra.
3. Las métricas de la sección 6 se empiezan a registrar con datos reales antes de que termine el Mes 1 del Plan de Acción.

---

*Documento vivo — actualizar la tabla de la sección 3 cada vez que una funcionalidad pase de "Visión" a "Real".*
