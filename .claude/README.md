# agent-dev-kit HORIZON — cinco capas, un sistema

| Capa | Dónde | Qué hace |
|---|---|---|
| **L1 · Memoria** | `/CLAUDE.md` + `.claude/memoria/` (+ `templates/global-CLAUDE.md` → `~/.claude/CLAUDE.md`) | Siempre cargado: reglas, arquitectura, nombres, contenido, mapa del repo |
| **L2 · Conocimiento** | `.claude/skills/` | Bajo demanda: `nueva-pagina`, `migracion-supabase`, `reels`, `carrusel`, `stories`, `modo-terreno`, `documentos-cliente` |
| **L3 · Guardrails** | `.claude/settings.json` + `.claude/hooks/` | Deterministas, sin IA: bloquea secretos y frases de ChatGPT, valida `vercel.json` y rutas, carga contexto, registra actividad |
| **L4 · Delegación** | `.claude/agents/` | Ventana propia, solo devuelven resultados: `copy-reviewer`, `reel-writer`, `carrusel-maker`, `stories-builder`, `page-auditor`, `documentador` |
| **L5 · Distribución** | `plugins/horizon-kit/` + `/.claude-plugin/marketplace.json` | Plugin instalable por todo el equipo |

**Flujo:** CLAUDE.md pone las reglas → Skills dan la expertise → Hooks aseguran la calidad → Subagentes delegan el trabajo → Plugins lo distribuyen al equipo.

## Hooks activos
| Evento | Script | Efecto |
|---|---|---|
| `SessionStart` | `inicio-sesion.js` | Rama, últimos commits, próxima migración, piezas en `CONTENIDO/` |
| `UserPromptSubmit` | `recordatorio-consultor.js` | En mensajes de terreno/ventas inyecta un ancla de `anclas.txt`: escuchar → preguntar → reflejar → diagnosticar → proponer |
| `PreToolUse` (Write/Edit) | `pre-escritura.js` | Bloquea `service_role`/`sk-...` fuera de `.env`, frases de `frases-ia.txt` en `CONTENIDO/` y propuestas/contratos sin diagnóstico en la ficha |
| `PostToolUse` (Write/Edit) | `post-escritura.js` | Valida `vercel.json`, exige rewrite para páginas nuevas en `Pages/`, avisa `[[FALTA]]`/`[[DEFINIR]]` en documentos de cliente, log |
| `Stop` / `SubagentStop` | `registro.js` | Log en `.claude/logs/actividad.log` (no se versiona) |

Requisito: Node (el mismo del proyecto). Sin bash ni jq, así corre igual en Windows y Mac.

## Uso rápido
- "estoy en terreno" / `/modo-terreno` → respuestas cortas, ficha del cliente y documentos (propuesta, contrato, orden de inicio, acta) en PDF
- "escribime un reel sobre clientes que se pierden por WhatsApp" → skill `reels`
- "usá reel-writer para 3 reels sobre agenda online" → subagente
- "nueva página para el caso Floremané" → skill `nueva-pagina` → `page-auditor`
- Agregar frases prohibidas: una línea más en `hooks/frases-ia.txt`
- Cambiaste skills/agentes de contenido → `npm run plugin:sync`
