---
name: documentos-cliente
description: Genera los documentos formales de un cliente HORIZON (propuesta comercial, contrato de prestación de servicios con anexo de alcance, orden de inicio, acta de entrega) en HTML imprimible y PDF, a partir de la ficha del cliente. Usar cuando pidan "contrato", "propuesta", "cotización formal", "acta de entrega", "orden de inicio" o "documentos para el cliente".
---

# Documentos de cliente

## Entradas
- `CONTENIDO/clientes/<slug>/ficha.md` (datos del cliente y del acuerdo).
- `referencias/datos-horizon.md` (datos públicos del prestador) y `referencias/datos-privados.md` (RUT, domicilio, banco; local, no versionado).
- `referencias/condiciones.md` (condiciones comerciales por defecto).
- Alcance: `Pages/plan-0N.html` ("Qué incluye" y "No incluye") · Precios: `ESTRATEGIA/HORIZON-ECOSISTEMA.md`.

## Documentos disponibles
| Documento | Estructura | Cuándo |
|---|---|---|
| Propuesta comercial | `estructuras/propuesta.md` | Después del diagnóstico, antes de cerrar |
| Contrato + Anexo A (alcance) | `estructuras/contrato.md` | Al cerrar |
| Orden de inicio | `estructuras/orden-inicio.md` | En el kickoff |
| Acta de entrega | `estructuras/acta-entrega.md` | Al entregar el proyecto |

## Pasos
1. Leé la ficha, `datos-horizon.md`, `datos-privados.md` (si existe) y `condiciones.md`. Si la ficha no existe, pedí los datos mínimos (razón social o nombre, RUT, plan, monto).
2. Para cada documento: copiá `templates/base.html` y reemplazá `{{TITULO}}`, `{{SUBTITULO}}`, `{{CODIGO}}`, `{{FECHA}}` y `{{CUERPO}}` con el HTML armado según su estructura.
3. Guardá en `CONTENIDO/clientes/<slug>/AAAA-MM-DD-<documento>.html`.
4. Generá el PDF: `node scripts/doc-pdf.js <archivo.html>` (si no hay navegador disponible, avisá que se imprime desde el navegador → Guardar como PDF).
5. Devolvé rutas + lista de `[[FALTA: …]]` y `[[DEFINIR: …]]` que quedaron.

## Reglas
- Texto legal del contrato: **literal** desde `estructuras/contrato.md`. Solo se reemplazan variables; no se agregan ni quitan cláusulas sin que lo pidan.
- Tono formal en documentos (tercera persona / usted). El voseo es para redes, no para contratos.
- Montos en CLP con punto de miles (`$990.000`) y en palabras en el contrato.
- Cada documento lleva código `HZ-<AAAA>-<slug>-<tipo>` (PRO, CON, OI, AE).
- Dato que no está: `[[FALTA: …]]`. Condición sin definir: `[[DEFINIR: …]]`. Nunca inventar.
