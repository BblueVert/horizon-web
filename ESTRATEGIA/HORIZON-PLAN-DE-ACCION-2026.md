# HORIZON — Plan de Acción 2026-2027
> Versión 1.0 · 26 agosto 2026 (hoy)
> Meta: facturación mensual de **$10.000.000 CLP limpios en diciembre 2026**.

---

## 0. Léelo antes de comprometerte con esto

Este plan asume que HORIZON puede cerrar **13 clientes de "El Sistema" ($990.000 + instalación presencial) entre septiembre y diciembre**, más construir una base de ~12 tenants SaaS y varios clientes recurrentes de contenido. Eso es un ritmo de **dedicación casi de tiempo completo**, en paralelo a ser estudiante de último año en INACAP.

No está inflado para que se vea bien — está construido hacia atrás desde la meta que se pidió, con supuestos de conversión que **todavía no están validados con datos reales** (ver sección 8 de `HORIZON-MARKET-FIT.md`). Es un objetivo exigente y alcanzable *si* el ritmo semanal se sostiene desde la Semana 1 y si el mix de ingresos no depende solo de cerrar proyectos grandes al final — depende de construir la base recurrente (mantención, contenido, SaaS) en paralelo, desde ahora.

**Si a fines de septiembre los números reales están muy por debajo de esta tabla, es la señal para recalibrar la meta de diciembre — no para forzar el ritmo ni para inflar los números del CRM.** Este mismo modelo, con los números reales de las primeras 4 semanas, sirve para saber qué meta SÍ es realista con las horas que de verdad hay disponibles.

---

## 1. El modelo financiero — cómo se llega a $10M/mes

La tentación es pensar "necesito cerrar 10 proyectos grandes en diciembre". Es la forma más frágil de llegar a la meta — todo el mes depende de cierres de último minuto. El modelo real reparte el ingreso de diciembre en **4 capas que se construyen en paralelo desde septiembre**:

| Capa | Qué es | Por qué importa |
|---|---|---|
| **Setups nuevos del mes** | Clientes Nivel 01 que cierran ESE mes ($990.000 c/u) | Es la única capa que hay que "cazar" cada mes — las otras tres se acumulan solas si se venden bien desde antes |
| **Mantención acumulada** | $190.000/mes de cada cliente Nivel 01 ya instalado en meses anteriores | Crece sola con cada cliente nuevo — por eso hay que empezar en septiembre, no en noviembre |
| **Contenido + Ads (Nivel 02)** | Upsell a clientes que ya confían en HORIZON | Ticket más alto que la mantención ($600.000/mes) — la conversación de upsell es tan importante como la puerta nueva |
| **SaaS (Binks Barber + tenants Mesa Cero-lite)** | Suscripciones de bajo ticket, alto volumen | El único ingreso que no depende de las horas de Benjamín instalando en persona |

### Proyección mes a mes (hipótesis de trabajo, a corregir con datos reales)

| Mes | Setups nuevos | Mantención acum. | Contenido mensual acum. | SaaS acum. | Otros (auditoría/identidad/ads) | **Total facturado** |
|---|---|---|---|---|---|---|
| Sep 2026 | 2 × $990.000 = $1.980.000 | $190.000 (1 cliente) | — | $160.000 (2 tenants) | $450.000 (1 auditoría) | **≈ $2.780.000** |
| Oct 2026 | 3 × $990.000 = $2.970.000 | $570.000 (3 clientes) | $600.000 (1 cliente) | $240.000 (3 tenants) | $450.000 (1 auditoría) | **≈ $4.830.000** |
| Nov 2026 | 3 × $990.000 = $2.970.000 | $1.140.000 (6 clientes) | $1.200.000 (2 clientes) | $400.000 (5 tenants) | $450.000 (1 auditoría) | **≈ $6.160.000** |
| **Dic 2026 (meta)** | 5 × $990.000 = $4.950.000 | $1.710.000 (9 clientes) | $2.400.000 (4 clientes) | $960.000 (12 tenants) | $1.150.000 (identidad ×2 + ads ×2) | **≈ $11.170.000** |

**Lectura de esta tabla, no solo los números:** subir la mantención de $79.900 a $190.000 CLP/mes le da al plan un colchón real sobre la meta (~$1.170.000 de margen en diciembre) sin depender de cerrar un sexto setup nuevo. Aun así, en diciembre los setups nuevos siguen siendo menos de la mitad del total facturado (~44%) — el resto es la base recurrente construida los tres meses anteriores. **Si en septiembre y octubre solo se persigue el cierre grande y se descuida vender Nivel 02 o SaaS, en diciembre falta buena parte del ingreso aunque se cierren los 5 setups nuevos.**

**Costos operativos estimados a descontar para el "limpio":** hosting (Vercel), Supabase, dominio, WhatsApp Business API, uso de Claude API, herramientas de automatización — del orden de $100.000–$250.000 CLP/mes a esta escala. No se resta explícitamente arriba porque el objetivo bruto ya deja margen amplio sobre eso; si al llegar a diciembre el margen es más ajustado, restar este rango de la meta bruta para confirmar el "limpio" real.

---

## 2. La mecánica semanal (el motor que hay que sostener)

Todo el modelo de arriba depende de una sola cadena que se repite cada semana, tomada de `SISTEMA-DE-CIERRE.md` y `GUION-VENTA-PUERTA-A-PUERTA-v3.md`:

```
PUERTAS TOCADAS  →  DIAGNÓSTICOS AGENDADOS  →  CIERRES  →  MRR SUMADO
   (prospección)         (~20-25% de puertas)   (~25-30% de       (mantención +
                                                   diagnósticos)     upsells)
```

Más dos motores paralelos que NO dependen de tocar puertas:
- **Contenido de Instagram (@horizon.webs)** — nutre leads que llegan solos (inbound), y reduce con el tiempo la dependencia de la puerta fría (ver Escalera de Consciencia, `SISTEMA-DE-CIERRE.md`).
- **Reuniones de expansión con clientes activos** — una conversación corta con cada cliente Nivel 01 ya instalado, ofreciendo Nivel 02. Es más barato vender contenido a alguien que ya confía que cerrar un cliente nuevo.

**Regla no negociable:** cada semana termina con un número real anotado en el CRM (`OPS/pipeline.html`) de puertas tocadas, diagnósticos agendados y cierres — no una sensación de "estuvo bien la semana". Sin esto, el modelo de la sección 1 nunca se corrige con la realidad.

---

## 3. Semana a semana — hasta el 31 de diciembre

Semanas de lunes a domingo. Hoy es miércoles 26 de agosto de 2026 (dentro de la Semana 0).

### Septiembre — arrancar la máquina

| Semana | Fechas | Puertas | Diagnósticos | Cierres | Foco adicional de la semana |
|---|---|---|---|---|---|
| **S0** (actual) | 24–30 ago | — | — | — | **No es semana de venta plena.** Sincronizar pricing en CRM y páginas de servicios (en curso). Instrumentar el pipeline para registrar puertas/diagnósticos/cierres semana a semana. Escribir el guion de apertura y cierre con el pricing nuevo ($990.000 + $190.000). Agendar las primeras puertas de S1. |
| **S1** | 31 ago–6 sep | 10 | 2 | 0–1 | Primera semana de campo con el pricing nuevo. Grabar nota de voz post-diagnóstico (Componente 5, `SISTEMA-DE-CIERRE.md`) desde el primer diagnóstico agendado. |
| **S2** | 7–13 sep | 10 | 2 | 1 | Primer cierre del período. Iniciar instalación en persona apenas se firme — no dejarla en cola. |
| **S3** | 14–20 sep | 12 | 2 | 0–1 | Publicar el primer contenido de Instagram basado en una objeción real recogida en S1-S2. |
| **S4** | 21–27 sep | 12 | 3 | 1 | Cerrar el mes con 2 clientes Nivel 01 firmados. Ofrecer Auditoría (Nivel 02) al primer cliente ya instalado. |

**Cierre de mes 1 (fin septiembre):** 2 clientes Nivel 01 activos, 1 auditoría vendida, primeros 2 tenants SaaS (Binks Barber o piloto Mesa Cero). Facturado del mes ≈ $2.780.000.

### Octubre — subir el ritmo

| Semana | Fechas | Puertas | Diagnósticos | Cierres | Foco adicional de la semana |
|---|---|---|---|---|---|
| **S5** | 28 sep–4 oct | 15 | 3 | 1 | Subir la cuota de puertas de 12 a 15 — validar que el diagnóstico sigue convirtiendo al mismo ritmo antes de subir más. |
| **S6** | 5–11 oct | 15 | 3 | 1 | Primera reunión de expansión: ofrecer Contenido Mensual (Nivel 02) al cliente de S2. |
| **S7** | 12–18 oct | 15 | 3 | 1 | Revisar el registro de objeciones acumulado — ¿qué objeción se repite más? Ajustar el guion si hace falta. |
| **S8** | 19–25 oct | 15 | 3 | 0–1 | Checkpoint de mitad de camino: comparar cierres reales de sep-oct contra la tabla de la sección 1. Si va por debajo, ver sección 6 (protocolo de ajuste). |
| **S9** | 26 oct–1 nov | 15 | 3 | 1 | Cerrar el mes. Confirmar que la mantención de los clientes de septiembre ya está facturando sin fricción. |

**Cierre de mes 2 (fin octubre):** +3 Nivel 01 (acumulado 5), +2 SaaS (acumulado 3), primer cliente en Contenido Mensual. Facturado del mes ≈ $4.830.000.

### Noviembre — construir la base antes del sprint final

| Semana | Fechas | Puertas | Diagnósticos | Cierres | Foco adicional de la semana |
|---|---|---|---|---|---|
| **S10** | 2–8 nov | 18 | 4 | 1 | Segunda reunión de expansión (Contenido o Identidad Visual) con un cliente de octubre. |
| **S11** | 9–15 nov | 18 | 4 | 1 | Evaluar si ya hay margen para delegar una tarea operativa (ej. carga de contenido) y liberar horas de founder para vender. |
| **S12** | 16–22 nov | 18 | 4 | 1 | Revisar el pipeline completo: ¿cuántos diagnósticos de meses anteriores siguen sin cerrar? Retomarlos antes de sumar puertas nuevas. |
| **S13** | 23–29 nov | 18 | 4 | 0–1 | Última semana antes del sprint de diciembre — dejar el pipeline de diciembre "cargado" (diagnósticos agendados para la primera semana de dic). |

**Cierre de mes 3 (fin noviembre):** +3 Nivel 01 (acumulado 8), +2 SaaS (acumulado 5), +1 Contenido Mensual (acumulado 2), 1 auditoría más. Facturado del mes ≈ $6.160.000.

### Diciembre — el mes de la meta

| Semana | Fechas | Puertas | Diagnósticos | Cierres | Foco adicional de la semana |
|---|---|---|---|---|---|
| **S14** | 30 nov–6 dic | 20 | 5 | 1–2 | Arranca el sprint. Ofrecer Identidad Visual y Gestión de Ads a los 2-3 clientes más antiguos y consolidados. |
| **S15** | 7–13 dic | 20 | 5 | 2 | Mitad del sprint — checkpoint duro contra la meta de $10M. Si el acumulado del mes va muy por debajo, priorizar cerrar lo que ya está en pipeline por sobre tocar puertas nuevas. |
| **S16** | 14–20 dic | 20 | 5 | 1–2 | Últimas puertas nuevas del año — las agendas de los clientes empiezan a complicarse por las fiestas. |
| **S17** | 21–27 dic | — | — | 1 | No se prospecta nueva puerta esta semana. Foco 100% en cerrar lo que ya está conversado. |
| **S18** | 28–31 dic | — | — | — | Cierre administrativo: facturación del mes, actualizar el dashboard de OPS con los números reales de todo el trimestre, y dejar listo el arranque de enero. |

**Cierre de mes 4 / meta de diciembre:** +5 Nivel 01 (acumulado 13), +7 SaaS (acumulado 12), +2 Contenido Mensual (acumulado 4), +2 Identidad Visual, +2 Gestión de Ads. **Facturado del mes ≈ $11.170.000 — supera la meta de $10.000.000 con margen, sin necesitar un sexto setup nuevo en diciembre.**

---

## 4. Mes 6 — sostener y consolidar (objetivo directo a febrero 2027)

A partir de aquí el plan deja de ser semanal — a 6 y 12 meses fingir precisión semana a semana no sirve, sirve tener la dirección clara. Estos son objetivos mensuales/trimestrales, no un cronograma cerrado.

**Contexto:** llegar a $10M/mes en diciembre no es el final — es la validación de que el modelo funciona. El riesgo real de esta etapa es que, sin ajustar nada, Benjamín se queda atrapado sosteniendo $10M/mes a costa de 100% de su tiempo, sin margen para crecer ni para terminar sus estudios.

**Objetivos de la etapa (dic 2026 → feb 2027):**
1. **Sostener ≥ $10M/mes** sin que la facturación dependa de cerrar la misma cantidad de setups nuevos cada mes — subir el peso de mantención + contenido + SaaS sobre el total (meta: que la base recurrente sea ≥ 55% del total, hoy en diciembre ya está en ~56% gracias al ajuste de mantención a $190.000, hay que no perder ese balance).
2. **Documentar el proceso de instalación** de "El Sistema" lo suficiente como para que una parte (no todo) se pueda delegar — es el primer paso real hacia dejar de ser el cuello de botella (mismo diagnóstico que HORIZON le hace a sus clientes, aplicado a HORIZON mismo).
3. **Cerrar el hueco de seguimiento proactivo a leads fríos** (Componente 4, `SISTEMA-DE-CIERRE.md`) — para que el pipeline no dependa 100% de la memoria de Benjamín.
4. **Meta de facturación de la etapa:** $12–14M CLP/mes hacia fines de febrero 2027.

---

## 5. Mes 12 — escalar más allá del founder (objetivo directo a agosto 2027)

**Objetivos de la etapa (feb 2027 → ago 2027):**
1. **Primera contratación o colaboración externa financiada por margen real** — no antes, y solo si el margen de los meses anteriores lo sostiene sin apalancar el negocio. Candidato natural: alguien que tome parte de la carga operativa de contenido o de instalación técnica, no ventas (las ventas puerta a puerta siguen siendo del founder mientras esa siga siendo la ventaja competitiva real, ver `HORIZON-MARKET-FIT.md`).
2. **Formalizar Binks Barber y Mesa Cero como productos con onboarding más autoservicio** — reducir el tiempo de founder por cliente SaaS nuevo, para que ese motor de volumen efectivamente escale sin techo de horas.
3. **Evaluar expansión geográfica o de vertical** — otra comuna de la región, o un tercer nicho, solo si los dos verticales actuales ya están estables.
4. **Evaluar la formalización societaria de HORIZON** (SpA u otra estructura) dado el volumen de facturación proyectado — esto es una decisión legal/tributaria que requiere asesoría contable real, este plan solo la señala como punto de decisión, no la resuelve.
5. **Meta de facturación de la etapa:** $18–25M CLP/mes hacia agosto 2027, con la base recurrente en ≥ 60% del total.

---

## 6. Protocolo de ajuste — qué hacer si los números reales no calzan

Este modelo se equivocará en algún punto — lo importante es tener ya decidido qué hacer cuando pase, no improvisar en el momento:

- **Si las puertas no convierten a la tasa asumida (menos de 1 diagnóstico cada 5 puertas):** el guion o el ángulo de apertura necesitan ajuste antes de subir el volumen de puertas — más puertas con la misma conversión baja no resuelve nada, solo cansa más rápido.
- **Si los diagnósticos no cierran a la tasa asumida (menos de 1 de cada 4):** revisar en qué nivel de consciencia (Componente 1, `SISTEMA-DE-CIERRE.md`) está llegando el lead al diagnóstico — puede ser un problema de calificación previa, no de la conversación de cierre en sí.
- **Si a fines de septiembre el acumulado real está muy por debajo de la tabla de la sección 1:** no forzar el ritmo de octubre para "compensar" — recalcular la meta de diciembre con el dato real de conversión, y decidir conscientemente si el objetivo pasa a ser una meta menor pero sostenible, o si se ajusta el mix (más peso en SaaS de bajo ticket, que no depende de instalación presencial, y menos en cierres de alto ticket).
- **Si el cuello de botella no es vender sino instalar** (se cierra más rápido de lo que se puede instalar en persona): es una señal positiva, no un problema — significa que ya es momento de adelantar el punto 2 de la sección 4 (documentar y delegar instalación) antes de lo planeado.

---

*Documento vivo — actualizar la tabla de la sección 1 y las metas semanales de la sección 3 cada vez que se cierre una semana, con los números reales del CRM, no con la proyección original.*
