# Expectativas de contenido

## Voz
- Fundador visible (Benja), cercano, local, directo. **Tuteo chileno** (tú tienes, puedes, agenda, escríbenos). **Nunca voseo** (vos, tenés, podés, agendá): Benja es chileno, no argentino.
- Si existe `BRAND-VOICE.md` (local, no versionado), es la fuente de verdad y manda sobre este archivo.

## Los 3 modos de voz (de `SISTEMA-DE-CIERRE.md`)
| Modo | Nivel de consciencia | Objetivo | CTA |
|---|---|---|---|
| 1 · Impacto | Consciente del problema | Que se reconozca en el dolor | Seguir / guardar |
| 2 · Educativo | Conoce la solución | Entender qué es un "sistema digital" | Comentar palabra clave / recurso |
| 3 · Conversión | Conoce HORIZON | Paso formal | Diagnóstico gratuito (ask pequeño) |

Regla: **nunca** ofrecer el diagnóstico a alguien en Modo 1.

## Qué cuenta como conversión
- Comentario con palabra clave → DM → lead en OPS (`new`).
- Diagnóstico agendado (`/agendar`) = conversión principal. Antes del calendario, `/agendar` califica: presupuesto desde $490.000 (ahora / 1–2 meses / todavía no), consultas por semana y quién decide. Queda en OPS en `leads.hooks_respuestas.calificacion`, con resumen en `nota` y `prioridad` Alta/Media/Baja. "Todavía no" no agenda: queda como lead frío (`origen = agendar-sin-presupuesto`) y se envía a `/recursos`.
- Descarga de recurso (`/recursos`) = conversión secundaria (lead frío).

## Calendario base (ajustable)
- Lun: Reel Modo 1 · Mié: Carrusel Modo 2 · Vie: Reel/caso Modo 3 · Stories: diario.

## Video (reels)
- **Música original por video, generada a medida**, nunca música buscada o de terceros. Cada reel tiene su propia base (tempo, tonalidad y progresión distintos) pero la misma línea sonora HORIZON: bombo cálido, clap, sub bajo con pump, pad y pluck brillante. Los golpes, toques y confirmaciones se sincronizan con los cortes del video. Generador: `scripts/reel-musica.py` + un `cue.json` por video (guardado junto al reel en `CONTENIDO/reels/`).
- **Portada propia por video**, diseñada según lo que muestra (no un cuadro sacado del video). Lo importante dentro del recorte 4:5 central para la grilla.
- Mucho movimiento: cortes al ritmo, cámara con golpes, scroll real del sitio, toques en pantalla, tipografía cinética. Nada de capturas estáticas con subtítulos.
- **Pantallas: pantallazos, no barridos.** La web se muestra con capturas fijas que cambian con corte seco (cada una visible 1 s o más), no con scroll rápido. Celulares y navegadores siempre derechos y frontales: sin caída, giro ni 3D; la cámara solo hace un golpe corto en los toques. Lo clave dentro de la zona segura de Meta (y 270–1250 en 1080×1920). Motor: `engine.html` con `"flat": true`.
- Si no hay voz de Benja grabada, el reel se lee solo con texto en pantalla; la voz se agrega en Instagram (Editar → Voz en off) o la graba Benja y se mezcla.

## Calidad mínima
- Hook en la primera línea / primeros 2 segundos.
- Una idea por pieza. Un CTA por pieza.
- Cero frases genéricas de IA (lista en `.claude/hooks/frases-ia.txt`).
- Datos o casos reales (VitalKine, Floremané, FITT, Binks Barber, Mesa Cero; detalle en `casos.md`) > promesas.
