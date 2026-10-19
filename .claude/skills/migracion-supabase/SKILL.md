---
name: migracion-supabase
description: Crea la siguiente migración SQL numerada de Supabase para HORIZON (tablas, columnas, RLS, policies). Usar cuando pidan "nueva tabla", "agregar columna", "migración" o cambios de base de datos en OPS, portal o SaaS.
---

# Migración Supabase

## Pasos
1. Calculá el número: `ls supabase-migration-*.sql` → tomá el mayor NNN y sumá 1 (3 dígitos).
2. Confirmá el proyecto destino: principal `dkitbnrpwmwrfnmztdfc` (OPS/portal/leads) o SaaS `khvfhvpqhcchgxrtmrjo` (peluquerías).
3. Copiá `templates/migracion.sql` a `supabase-migration-NNN-<tema>.sql` y completá.
4. Leé la migración de la que depende y nombrala en el encabezado ("Requiere la 0XX").
5. Si el front o `api/` usan la tabla nueva, actualizá esos archivos en el mismo cambio.
6. Recordale al usuario que la migración se corre **a mano** en el SQL Editor de Supabase.

## Reglas
- Idempotente siempre: `create ... if not exists`, `drop trigger if exists`, `drop policy if exists`.
- RLS activado en toda tabla nueva + policies explícitas por rol.
- Columnas internas (notas, comprobantes) sin `grant` a `anon`.
- `updated_at` con el trigger existente `public.set_updated_at()`.
