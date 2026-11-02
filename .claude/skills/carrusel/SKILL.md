---
name: carrusel
description: Arma carruseles de Instagram/LinkedIn para HORIZON (texto por slide, dirección visual y caption). Usar cuando pidan "carrusel", "post de slides", "contenido educativo en slides" o "infografía en pasos".
---

# Carrusel HORIZON

## Estructura (usar `templates/carrusel.md`)
- **Slide 1 — Portada:** promesa concreta o tensión. Máx. 8 palabras + subtítulo.
- **Slides 2–N-1:** una idea por slide, máx. 30 palabras. Numerar si es un sistema/pasos.
- **Slide N — CTA:** guardar / comentar palabra clave / diagnóstico (según modo).
- Largo ideal: 6–8 slides.

## Dirección visual: sistema "Burbujas" (plantilla oficial desde oct-2026)
Plantilla: `plantilla/piezas.html` (componentes) + `plantilla/exportar.js` (PNG por pieza).
- **Fondo claro** `--bg #FFFBF6` con semitono de puntos en degradado en dos esquinas (rosa arriba a la derecha, naranja abajo a la izquierda).
- **Titular** Plus Jakarta Sans 800, interletrado negativo, negro `--ink`; **una sola frase clave en degradado** de marca (`.g`). Ej.: "Pierdes clientes por **responder tarde**".
- **Subtítulo** con barra vertical en degradado y la cifra o promesa en naranja (`.sub em`).
- **Prueba visual con burbujas de chat** (`.bub.bad` con X roja / `.bub.good` con check verde). Nombres genéricos ("Cliente") y avatar con inicial: nunca caras ni nombres reales.
- **Etiquetas Sin / Con** (`.tag.dark` = el problema · `.tag.hz` = con HORIZON, en degradado).
- **Tarjeta de interfaz** (`.ui` + `.row`) para mostrar el sistema: bandeja, pasos, agenda.
- **CTA** botón en degradado (`.cta`). Etiquetas y numeración en DM Mono (`.kicker`, `.num`).
- **Logo:** solo dentro del sello oscuro (`.brand`), nunca sobre el fondo claro (manual de marca).
- Cifras: solo las reales (ej.: "menos de 60 segundos" es la respuesta medida del flujo `/agendar`). Nada de "3 veces más rápido" sin dato propio.
- Formatos: carrusel y post 1080×1350 (`.pz.post`) · historia 1080×1920 (`.pz.story`, zona segura: 150 px arriba y 250 px abajo).

### Plantillas de lámina
| Lámina | Componentes |
|---|---|
| Portada | `.brand` + `h1` con `.g` + `.sub` + `.num` |
| Problema | `.kicker` + `h1` + 2 `.bub.bad` + `.tag.dark` |
| Solución | `.kicker` + `h1` + `.bub.good` (cliente y negocio) + `.tag.hz` |
| Cómo funciona | `.kicker` + `h1` + `.ui` con 3–4 `.row` numeradas |
| CTA | `.brand` + `h1` + `.sub` + `.cta` (palabra clave o diagnóstico según modo) |

### Cómo producir
1. Copiar `plantilla/piezas.html` a `CONTENIDO/carruseles/AAAA-MM-DD-<slug>/piezas.html` (ajustar la ruta del logo a `../../../Identidad/Logo HORIZON.svg`).
2. Dejar solo las láminas que sirven, cambiar textos y `data-out`.
3. `NODE_PATH=$(npm root -g) node .claude/skills/carrusel/plantilla/exportar.js <piezas.html> <carpeta>/png`
4. Revisar cada PNG: nada encima del titular, textos dentro del lienzo.

## Entrega
- Guardar en `CONTENIDO/carruseles/AAAA-MM-DD-<slug>.md`.
- Pasar por `copy-reviewer` antes de entregar.
