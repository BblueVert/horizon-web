# horizon-kit — Capa 5 (Distribución)

Empaqueta el sistema de contenido HORIZON para instalarlo en cualquier repo o máquina del equipo.

## Instalar (una vez por persona)
```
/plugin marketplace add BblueVert/horizon-web
/plugin install horizon-kit@horizon
```
Si el repo es privado, cada persona necesita acceso de lectura en GitHub.

## Qué trae
| Tipo | Piezas |
|---|---|
| Skills | `reels`, `carrusel`, `stories`, `ordenar-prompt` |
| Subagentes | `copy-reviewer`, `reel-writer`, `carrusel-maker`, `stories-builder` |
| Hooks | Bloqueo de frases de IA en `CONTENIDO/` + bloqueo de secretos + recordatorio de `ordenar-prompt` en pedidos largos |
| Comandos | `/horizon-kit:contenido-semana <foco>` |

## Actualizar (solo quien mantiene el kit)
1. Edita en `.claude/` (fuente de verdad), nunca acá directo.
2. `npm run plugin:sync`
3. Sube `version` en `.claude-plugin/plugin.json` y en `/.claude-plugin/marketplace.json`.
4. Commit + push. El equipo actualiza con `/plugin marketplace update horizon`.
