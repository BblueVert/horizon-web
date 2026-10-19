# HORIZON Web — CLAUDE.md (Capa 1 · Memoria del proyecto)

Siempre cargado. Es la constitución del agente en este repo.
Lo global (tu voz y preferencias en todos los proyectos) vive en `~/.claude/CLAUDE.md` → plantilla en `.claude/templates/global-CLAUDE.md`.

## Qué es este repo
Sitio, CRM interno (OPS), portal de clientes y SaaS vertical de **HORIZON**: sistema de crecimiento digital para PyMEs de servicio (Rancagua, Chile). No es una agencia tradicional: vendemos sistemas replicables (web + CRM + automatización + IA).

## Reglas que no se negocian
- **Nunca** escribir secretos en archivos versionados. Las claves van en `.env` (ver `.env.example`). El hook `PreToolUse` lo bloquea igual.
- Precios, planes y claves internas de plan: la fuente de verdad es `ESTRATEGIA/HORIZON-ECOSISTEMA.md` + `Pages/HORIZON_Landing_2026.html#planes`. No inventar precios.
- Copy en **español de Chile con voseo** ("vos ofrecés", "respondés"), directo, sin frases de ChatGPT (lista en `.claude/hooks/frases-ia.txt`).
- Cambios mínimos y del mismo estilo que el código vecino. No agregar frameworks ni build steps: es HTML/CSS/JS vanilla + Express + funciones de Vercel.
- Contenido generado (reels, carruseles, stories) y documentos de clientes (`CONTENIDO/clientes/<slug>/`) van a `CONTENIDO/` (no se versiona ni se publica).
- En terreno: skill `modo-terreno` → subagente `documentador`. Documentos formales en tono formal (usted), nunca con datos inventados.

## Detalle (se importa automáticamente)
@.claude/memoria/architecture.md
@.claude/memoria/naming.md
@.claude/memoria/contenido.md
@.claude/memoria/repo-map.md
