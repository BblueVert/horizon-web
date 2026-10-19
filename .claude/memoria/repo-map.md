# Mapa del repo — dónde vive cada cosa

| Ruta | Qué es | Por qué ahí |
|---|---|---|
| `Pages/` | Landing, planes, recursos, agendar, portal (`/c/:token`) | Sitio público, rutas en `vercel.json` |
| `OPS/` + `api/ops/` | CRM interno y su API | Herramienta del equipo, login en `/ops/login` |
| `api/` | Endpoints públicos (leads, agenda, portal, recursos, SaaS) | Funciones Vercel; `server.js` las monta en local |
| `verticales/peluquerias/` | SaaS Binks Barber | Producto vertical, Supabase SaaS |
| `verticales/_core/` | Config compartida de verticales | Reutilizable para próximos nichos |
| `shared/` | Íconos (`hz-icons.js`) | Compartido entre módulos |
| `Identidad/` | Logos, og-image, logos de partners | Activos de marca |
| `ESTRATEGIA/` | Buyer persona, market fit, ecosistema, PRD, plan 2026 | Fuente de verdad de negocio |
| `SISTEMA-DE-CIERRE.md` | Embudo de venta y modos de voz | Referencia de copy y CRM |
| `supabase-migration-*.sql` | Migraciones numeradas | Se corren a mano en Supabase |
| `.claude/` | Kit de agentes (memoria, skills, hooks, subagentes) | Capas 1–4 |
| `plugins/horizon-kit/` + `.claude-plugin/` | Plugin distribuible | Capa 5 |
| `CONTENIDO/` | Salida de contenido generado | Local: ignorado por git y Vercel |
