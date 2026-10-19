# Convenciones de nombres

- Marca: **HORIZON** en mayúsculas en títulos y UI; "Horizon" aceptable en texto corrido.
- Páginas públicas: `Pages/<slug>.html` o `Pages/<slug>/index.html`, slug en minúsculas con guiones.
- OPS: `OPS/<modulo>.html` + `api/ops/<modulo>.js`, ruta pública `/ops/<modulo>`.
- Migraciones: `supabase-migration-NNN-<tema>.sql` (NNN = siguiente número, 3 dígitos). Idempotentes (`if not exists`, `drop ... if exists`).
- SQL: tablas y columnas en `snake_case`, en español cuando son de negocio (`nombre`, `monto`, `estado`).
- Claves de plan en BD de leads: `plan01`=Plan 01, `plan02`=Plan 02, `plan04`=Plan 03, `plan05`=Plan 04, `plan03`=legacy "Negocio Activo".
- Etapas del pipeline: `new` → `contactado` → `diagnóstico` → `propuesta` → `contrato`.
- Tokens CSS (landing): `--void --deep --surface --card --border --border2`, gradiente `--h1`…`--h7` (naranja #FF6B35 → violeta #4A3580), texto `--text --text2 --text3`, radios `--r` (12px) y `--r-lg` (20px).
- Contenido: `CONTENIDO/<formato>/AAAA-MM-DD-<slug>.md` (formato = reels | carruseles | stories).
