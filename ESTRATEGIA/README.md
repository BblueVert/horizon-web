# HORIZON — Paquete de Estrategia
> Versión 1.0 · 26 agosto 2026 · Preparado para Benjamín (Binks)

---

Este es el set de documentos que responde a una pregunta: **¿qué es HORIZON hoy, para quién existe, y qué hay que hacer cada semana para que a fin de año esté facturando $10.000.000 CLP limpios al mes?**

No son documentos teóricos. Cada uno está construido con lo que ya existe en los repos `horizon-web` y `mesa-cero` — el código real, el pricing real (`Pages/HORIZON_Landing_2026.html`, sección Planes), el sistema de venta real (`SISTEMA-DE-CIERRE.md`, `GUION-VENTA-PUERTA-A-PUERTA-v3.md`) y el producto real (`verticales/peluquerias`, la demo de Mesa Cero). Donde falta un dato real (tamaño de mercado, tasas de conversión), se marca explícitamente como **supuesto a validar**, no se inventa como si fuera un hecho.

## Los documentos

| Documento | Qué responde |
|---|---|
| [`HORIZON-BUYER-PERSONA.md`](./HORIZON-BUYER-PERSONA.md) | ¿A quién le vendo, exactamente? Los 3 perfiles reales de cliente (agencia general, Mesa Cero, Binks Barber). |
| [`HORIZON-MARKET-FIT.md`](./HORIZON-MARKET-FIT.md) | ¿Por qué esto puede funcionar en Rancagua y la Región de O'Higgins? Tamaño de mercado, competencia real, por qué ahora. |
| [`HORIZON-ECOSISTEMA.md`](./HORIZON-ECOSISTEMA.md) | ¿Qué es HORIZON como sistema completo? Las dos capas de negocio, los productos, el stack técnico, cómo se conectan entre sí. |
| [`HORIZON-PRD-EL-SISTEMA.md`](./HORIZON-PRD-EL-SISTEMA.md) | ¿Qué es "El Sistema" (Nivel 01) exactamente, como producto? Alcance, lo que es real hoy vs. lo que es visión, arquitectura, roadmap. |
| [`HORIZON-PLAN-DE-ACCION-2026.md`](./HORIZON-PLAN-DE-ACCION-2026.md) | ¿Qué hago esta semana? Plan semana a semana hasta fin de año, más los hitos de 6 y 12 meses. |

## Cómo se interpretó el objetivo

El pedido fue: *"a fin de año estar facturando limpios $10.000.000 CLP"*. Se interpretó así (queda documentado para poder corregirlo si no era la intención):

- **"Facturando limpios $10.000.000 CLP"** = facturación **mensual** (no acumulada del año) de **diciembre 2026**, sumando todo lo que entra ese mes: setups nuevos, mantenciones activas, contenido mensual, SaaS (Binks Barber / Mesa Cero), auditorías e identidad visual — **neta de los costos operativos directos** (hosting, APIs, dominio), que a esta escala son bajos (~$100.000–200.000 CLP/mes) frente al objetivo, así que "limpio" y "bruto" no se alejan mucho todavía.
- **Hoy es 26 de agosto de 2026.** Fin de año son ~18 semanas. Los hitos de 1 y 3 meses son escalones hacia esa meta de diciembre. Los hitos de 6 y 12 meses son **posteriores** a la meta — qué hacer una vez que ya se llegó a $10M/mes, para no soltar el ritmo ni estancarse ahí.
- El plan semanal detallado cubre las ~18 semanas hasta el 31 de diciembre. Los meses 6 y 12 se dan a nivel de objetivos mensuales/trimestrales, no semana a semana — no tiene sentido fingir precisión semanal a un año de distancia.

## Cómo se usa esto

No es un documento que se lee una vez y se guarda. **El Plan de Acción se revisa cada semana contra los números reales del CRM** (`OPS/pipeline.html` o `Pages/CRM/pipeline.html`). El modelo financiero de este plan es un punto de partida con supuestos explícitos (tasa de cierre, puertas por diagnóstico, etc.) — la primera tarea real de la Semana 1 es empezar a medir esos números de verdad para poder corregir el modelo con datos, no con esperanza.

---

*Índice vivo — si alguno de estos documentos se actualiza, actualizar la fecha de versión de ese documento, no la de este índice.*
