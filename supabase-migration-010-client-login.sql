-- HORIZON OPS — migración 010: los clientes entran con su correo
-- Proyecto Supabase de HORIZON (dkitbnrpwmwrfnmztdfc). Requiere la 008.
-- Idempotente.
--
-- Roles:
--   · Administradores (equipo HORIZON): emails en public.ops_admins → entran a /ops
--   · Clientes: email en public.leads.email → entran a su portal (/c/<portal_token>)
-- Los clientes no ven nada de OPS: las policies de 008 solo abren las tablas a is_ops_admin().
-- Esta función es lo único que un cliente con sesión puede consultar, y solo devuelve su propio token.

create or replace function public.my_portal_token()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.portal_token
  from public.leads l
  where l.portal_token is not null
    and l.email is not null
    and lower(l.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by (exists (select 1 from public.projects p where p.lead_id = l.id)) desc, l.updated_at desc nulls last
  limit 1;
$$;

revoke all on function public.my_portal_token() from public;
grant execute on function public.my_portal_token() to authenticated;
