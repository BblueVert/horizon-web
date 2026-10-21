---
name: ordenar-prompt
description: Ordena cualquier pedido largo, dictado por audio o desordenado en la anatomía de 6 bloques (Rol · Tarea · Contexto · Razonamiento · Formato de salida · Condiciones de finalización) antes de ejecutarlo. Usar al comenzar un proyecto nuevo, cuando Benja pegue un prompt largo o una transcripción de audio, o cuando pida "ordena este prompt", "arma el prompt", "prompt para ChatGPT/Midjourney/n8n" o "mejora este prompt".
---

# Ordenar prompt (anatomía de 6 bloques)

Un pedido desordenado da un resultado a medias. Antes de ejecutar, lo pasas por estos 6 bloques. Si un bloque queda vacío, el resultado sale genérico.

## Los 6 bloques
| # | Bloque | Pregunta que responde | ❌ Normal | ✅ Ordenado |
|---|---|---|---|---|
| 1 | **Rol** | ¿Qué experto tiene que ser la IA? | "Actúa como diseñador" | Experto + nicho exacto + punto A (dónde está el cliente) + punto B (adónde quiere llegar) + tipo de oferta |
| 2 | **Tarea** | ¿Qué hace y para qué objetivo de negocio? | "Hazme una landing" | Entregable concreto + objetivo medible (agendar diagnóstico, vender plan, captar lead) + partes obligatorias |
| 3 | **Contexto** | ¿Qué necesita saber para que el resultado venda, no solo se vea bien? | "Es una peluquería" | Nicho, oferta y precio, promesa, cliente ideal, qué ya intentó y falló, qué evitar |
| 4 | **Razonamiento** | ¿Con qué criterio decide antes de crear? | "Sé creativo" | Criterios de calidad ligados a conversión: hook, payoff, qué filtra, qué tiene que sentir quien llega al final |
| 5 | **Formato de salida** | ¿Cómo lo recibo para usarlo hoy? | "Dame ideas" | Tabla, archivo, columnas, secciones, extensión, ruta donde se guarda |
| 6 | **Condiciones de finalización** | ¿Cuándo está terminado? | (nada) | Checklist verificable: cantidades, elementos por ítem, reglas cumplidas |

## Flujo
1. **Extrae** del texto o audio lo que corresponde a cada bloque. Los dictados vienen en desorden y con repeticiones: junta, limpia y no pierdas datos concretos (nombres, cifras, plazos, links).
2. **Rellena con la memoria de HORIZON** lo que ya está definido, sin preguntarlo:
   - Voz: español de Chile con tuteo, sin frases de IA (`.claude/hooks/frases-ia.txt`).
   - Planes y precios: solo de `ESTRATEGIA/HORIZON-ECOSISTEMA.md`. Nunca inventar.
   - Modos de voz y conversión: `.claude/memoria/contenido.md`. Casos reales: `.claude/memoria/casos.md`.
   - Marca y tokens: `.claude/memoria/naming.md`. Stack y reglas técnicas: `.claude/memoria/architecture.md`.
3. **Detecta huecos.** Si falta algo que cambia el resultado (casi siempre Contexto o Condiciones de finalización), haz **máximo 3 preguntas cortas** y espera. Si el hueco es menor, asume y márcalo `[SUPUESTO: …]`.
4. **Muestra el prompt ordenado** con la plantilla `templates/prompt-6-bloques.md`. Corto: cada bloque en 1–5 líneas.
5. **Ejecuta** según el caso:
   - Pedido para ti (Claude) → muestra el prompt ordenado en versión compacta y ejecútalo en la misma respuesta, salvo que haya preguntas pendientes del paso 3.
   - Prompt para otra herramienta (ChatGPT, Midjourney, Figma AI, agente n8n, DeepSeek de OPS) → entrega solo el bloque listo para copiar, en un code block.
   - Proyecto nuevo → ver abajo.
6. **Cierra verificando** el bloque 6: recorre cada condición y marca ✓ o lo que faltó. Si algo no se cumplió, dilo; no lo des por terminado.

## Proyecto nuevo
Cuando Benja diga "proyecto nuevo", "arrancamos con X" o describa un cliente/producto desde cero:
1. Arma el prompt maestro del proyecto con los 6 bloques. En Contexto incluye: negocio, rubro y ciudad, plan HORIZON (si aplica), cliente ideal, competencia o intentos previos, activos existentes (logo, web, redes), restricciones (plazo, presupuesto, stack).
2. En Condiciones de finalización define el entregable de la **primera fase**, no del proyecto entero.
3. Guarda el prompt en `CONTENIDO/prompts/AAAA-MM-DD-<slug>.md` (local, no se versiona) para reusarlo en cada sesión del proyecto. Si es de un cliente con carpeta, guárdalo en `CONTENIDO/clientes/<slug>/prompt-maestro.md`.
4. Si el proyecto tiene skill propia (`nueva-pagina`, `documentos-cliente`, `reels`, `carrusel`, `stories`, `migracion-supabase`), el prompt ordenado alimenta esa skill: no dupliques sus reglas.

## Reglas
- Un prompt = una tarea. Si el dictado trae 3 pedidos distintos, son 3 prompts (dilo y ordénalos por prioridad).
- Rol específico siempre: nicho + punto A + punto B. "Experto en marketing" no sirve.
- Contexto con cifras y nombres reales. Nada de datos inventados; si no hay dato, `[FALTA: …]`.
- Razonamiento orientado a resultado de negocio (agendar, vender, retener), no a "creatividad".
- Formato que se pueda copiar y usar hoy.
- Condiciones verificables (números, elementos, reglas), no "que quede bien".
- No muestres la tabla de teoría a Benja. Muéstrale su prompt ordenado.

## Ejemplo HORIZON (dictado → ordenado)
Dictado: *"oye necesito contenido para el mes, algo para las barberías, que vean lo de Binks, que agenden, nada muy vendedor al principio, en tabla porfa"*

```
ROL
Estratega de contenido para barberías independientes de Rancagua que hoy agendan por WhatsApp a mano y quieren llenar su agenda sin depender de responder mensajes todo el día.

TAREA
Calendario de 30 días para Instagram de HORIZON que lleve a dueños de barbería a agendar el diagnóstico gratuito (/agendar). Cada pieza: hook, cuerpo y un CTA. Alterna Modo 1 Impacto, Modo 2 Educativo y Modo 3 Conversión.

CONTEXTO
Oferta: SaaS Binks Barber (reservas + recordatorios). Caso real: Binks Barber (ver casos.md).
Cliente ideal: dueño que corta y atiende el teléfono a la vez; ya probó agendas gratis que nadie usa.
Evitar: frases motivacionales, promesas sin caso, diagnóstico en Modo 1.

RAZONAMIENTO
Antes de crear, verifica que cada hook nombre un dolor concreto del rubro y que cada pieza Modo 3 tenga un dato o caso real. El contenido debe filtrar a quien no tiene presupuesto (desde $490.000).

FORMATO DE SALIDA
Tabla: | Día | Modo | Formato (reel/carrusel/story) | Hook | Tema | CTA |

CONDICIONES DE FINALIZACIÓN
30 filas completas, 6 columnas llenas, calendario base respetado (Lun reel M1 · Mié carrusel M2 · Vie reel M3), ningún Modo 1 con CTA de diagnóstico, cero frases de frases-ia.txt.
```
