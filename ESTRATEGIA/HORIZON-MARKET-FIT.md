# HORIZON — Market Fit
> Versión 1.0 · 26 agosto 2026

---

## Nota sobre los números de este documento

Los tamaños de mercado de abajo son **estimaciones de planificación**, construidas con datos públicos generales (población INE, proporciones típicas de PyMEs por rubro en Chile), no un estudio de mercado con fuentes primarias. Están marcadas como tal a propósito. Antes de usarlas para decisiones grandes (ej. cuánta pauta invertir), vale la pena validarlas con datos reales: registro de patentes comerciales de la Municipalidad de Rancagua, directorio SII por rubro, o simplemente contar puerta a puerta en las calles que ya se están recorriendo.

---

## 1. Tamaño de mercado (TAM / SAM / SOM)

**Región de O'Higgins:** ~950.000 habitantes (INE). **Rancagua** (comuna base de HORIZON): ~260.000 habitantes, capital regional.

| Nivel | Definición | Estimación | Fuente / supuesto |
|---|---|---|---|
| **TAM** | Todas las PyMEs de servicio con local físico en la Región de O'Higgins que podrían necesitar un sistema digital | ~15.000–20.000 negocios | Estimación basada en densidad típica de PyMEs por habitante en regiones chilenas (SII, orden de magnitud, no cifra exacta) |
| **SAM** | Las que están en el rango de facturación y madurez del ICP ($1,5M–$8M CLP/mes, 2+ años operando, sin sistema digital real) — restaurantes, peluquerías/barberías, clínicas, talleres, comercio especializado | ~2.500–4.000 negocios | Recorte por rubro + facturación, estimado |
| **SOM (año 1)** | Los que HORIZON puede realmente atender con la capacidad de un founder solo, en Rancagua y comunas cercanas (Machalí, Graneros, Doñihue) | 30–60 clientes activos entre Agencia + Vertical SaaS | Limitado por la capacidad de instalación en persona, no por demanda |

**La conclusión que importa:** el mercado direccionable (SAM) es más de 50x la capacidad real de atención de un founder solo en el primer año. **El techo de HORIZON en 2026 no es demanda, es capacidad de entrega** — de ahí que el plan de acción priorice construir apalancamiento (SaaS, contenido que vende sin que Benja esté presente) por sobre solo aumentar puertas tocadas.

---

## 2. Competencia real (no la competencia "de librero")

HORIZON no compite contra "otras agencias digitales" en la cabeza del cliente. Compite contra estas tres alternativas, en este orden de frecuencia real:

### A. "No hacer nada" / seguir como está
El competidor más común. El dueño de PyME lleva años sin sistema y el negocio sobrevive — la inercia es fuerte. Se gana con el costo de inacción calculado con números del propio negocio, no con argumentos de tecnología.

### B. Plataformas genéricas sin fundador visible (el rival directo de precio)
- **Apps de delivery** (PedidosYa, Uber Eats) para restaurantes — cobran 30% de comisión. No son "un software que se compra", son el status quo que ya le cuesta plata al cliente todos los meses — el ángulo comparativo más fuerte que tiene HORIZON (ver `HORIZON-contexto-ventas.md` del repo `mesa-cero`).
- **Software SaaS genérico por rubro** — Fudo (POS gastronómico, 30.000+ negocios LatAm), AgendaPro (agenda para peluquerías/servicios), constructores de sitios tipo Wix/plantillas de freelancers. Venden sin permanencia, precio mensual bajo, pero **sin nadie que instale, personalice ni conteste el teléfono** — el dueño queda solo configurando algo que no entiende.
- Esto define la posición de Mesa Cero frente a Fudo (ver `MESA-CERO-VISION-Y-POSICIONAMIENTO.md`): **HORIZON no compite ahí, convive con eso.** Mesa Cero no reemplaza el POS/caja — es la capa de experiencia omnicanal encima.

### C. Diseñador o desarrollador freelance / agencia genérica de Santiago
Cobra por proyecto (landing sola: $300.000–$1.200.000; sistema a medida con panel/roles: $1.500.000–$10.000.000, según research de mercado documentado en `GUION-VENTA-PUERTA-A-PUERTA-v3.md`), entrega y desaparece. No hay mantención real, no hay founder visible, no conoce el negocio del cliente después de la entrega. **Este es el comparador que justifica el pricing de HORIZON** — el research de mercado mostró que el bundle de HORIZON (landing + sistema completo, $990.000) está muy por debajo de lo que costaría ese mismo alcance comprado por separado.

---

## 3. Por qué HORIZON, y por qué ahora

**El hueco que nadie más llena en Rancagua:** ni el freelancer (caro, sin mantención, sin conocimiento del negocio) ni el SaaS genérico (barato, sin instalación, sin founder visible) resuelven lo mismo que HORIZON — **sistema a medida + instalación en persona + fundador que responde + precio de mercado regional, no de Santiago.**

**Por qué esto es viable recién ahora, no hace 3 años:**
1. **Los agentes de IA (WhatsApp/Instagram/voz) dejaron de requerir un equipo de ingenieros.** Lo que hoy arma un desarrollador senior solo (con Claude API, n8n, Supabase) hace 3 años requería un equipo completo. Eso es lo que le permite a un founder estudiante entregar, solo, algo que antes solo una agencia grande podía construir.
2. **La brecha digital regional sigue intacta.** Rancagua y la Región de O'Higgins no tienen una oferta local seria de este tipo — la oferta que existe es o de Santiago (cara, remota, sin visita presencial) o genérica sin personalización.
3. **El founder visible es una ventaja competitiva real, no un discurso de marca.** En un mercado de PyMEs que compran por confianza y boca a boca, que Benjamín mismo instale y responda pesa más que cualquier caso de estudio.

**El riesgo que hay que vigilar (no ignorar):** la ventaja de "founder visible + instalación en persona" es también el techo de escala — no se puede clonar a Benjamín. Por eso el modelo de negocio necesita DOS motores, no uno: el motor de alto ticket con instalación presencial (Agencia + Mesa Cero) y el motor de bajo ticket sin fricción de founder (Binks Barber SaaS, autoservicio). El primero valida y financia; el segundo es el que puede escalar sin que las horas de Benjamín sean el límite duro del negocio. Esto se desarrolla en `HORIZON-ECOSISTEMA.md` y se traduce en metas concretas en `HORIZON-PLAN-DE-ACCION-2026.md`.

---

## 4. Supuestos a validar (lista corta, honesta)

Estos son los supuestos del modelo financiero del plan de acción que hoy **no** están validados con datos reales de HORIZON — están basados en research de mercado general y en la lógica del embudo, no en conversión medida:

- Tasa de conversión puerta tocada → diagnóstico agendado
- Tasa de conversión diagnóstico → cierre
- Tiempo real de instalación de un Nivel 01 (el guion dice 3–6 semanas, pero no hay todavía un caso a tiempo completo medido)
- Tasa de upsell de un cliente Nivel 01 activo hacia Nivel 02 (Auditoría/Contenido)
- Retención mensual de clientes SaaS (Binks Barber) — cuántos meses se queda un tenant activo en promedio

La primera prioridad operativa del plan de acción (Semana 1) es instrumentar el CRM para que estos números dejen de ser supuestos.

---

*Documento vivo — actualizar cada vez que una cifra estimada se reemplace por un dato real medido en el CRM.*
