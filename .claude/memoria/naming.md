# Convenciones de nombres

- Marca: **HORIZON** en mayúsculas en títulos y UI; "Horizon" aceptable en texto corrido.
- Páginas públicas: `Pages/<slug>.html` o `Pages/<slug>/index.html`, slug en minúsculas con guiones.
- OPS: `OPS/<modulo>.html` + `api/ops/<modulo>.js`, ruta pública `/ops/<modulo>`.
- Migraciones: `supabase-migration-NNN-<tema>.sql` (NNN = siguiente número, 3 dígitos). Idempotentes (`if not exists`, `drop ... if exists`).
- SQL: tablas y columnas en `snake_case`, en español cuando son de negocio (`nombre`, `monto`, `estado`).
- Claves de plan en BD de leads: `plan01`=Plan 01, `plan02`=Plan 02, `plan04`=Plan 03, `plan05`=Plan 04, `plan03`=legacy "Negocio Activo".
- Etapas del pipeline: `new` → `contactado` → `diagnóstico` → `propuesta` → `contrato`.
- Tokens CSS (landing 2026, fondo claro): `--bg #FFFBF6 --bg2 #FFF4EA --surface --ink #1A1626 --ink2 --ink3 --line --line2`, tintes `--peach --rose --lilac --mint`, acento `--acc #F2690C`, degradado de marca `--grad` (naranja → rosa → violeta). Header oscuro (`--ink`) con logo blanco; resto claro. Íconos: sprite SVG propio en la landing (trazo 1.75, sin emojis). Animación: GSAP + ScrollTrigger + Lenis desde jsDelivr, siempre con fallback y `prefers-reduced-motion`. Las páginas `plan-0N`, `servicios` y OPS siguen con los tokens oscuros anteriores (`--void --deep --card…`) hasta migrarlas.
- Contenido: `CONTENIDO/<formato>/AAAA-MM-DD-<slug>.md` (formato = reels | carruseles | stories).
