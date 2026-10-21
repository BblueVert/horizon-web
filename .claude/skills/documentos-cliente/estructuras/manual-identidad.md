# Estructura · Manual de identidad (versión PyME)

Estándar completo: `ESTRATEGIA/HORIZON-ENTREGABLES-DE-MARCA.md` (sección C). Este archivo dice cómo se arma.

## Archivos
| Archivo | Qué es |
|---|---|
| `templates/marca/manual-identidad.html` | Plantilla 16:9 (1920 × 1080). No se edita por cliente |
| `<carpeta>/marca.js` | Los datos de la marca (`window.MARCA`). Base: `Identidad/manual/marca.js` (HORIZON) |
| `<carpeta>/img/IMG-NN.webp` | Imágenes del manual. Se cargan solas |
| `<carpeta>/prompts-imagenes.md` | Un prompt por cada `IMG-NN`. Base: `Identidad/manual/prompts-imagenes.md` |
| `scripts/marca-pdf.js` | Arma `<carpeta>/manual-identidad.html` + `.pdf` |

Cliente: `CONTENIDO/clientes/<slug>/marca/` (no se versiona). HORIZON: `Identidad/manual/`.

## Pasos
1. Copia `Identidad/manual/marca.js` a la carpeta del cliente.
2. Reemplaza todos los datos con los de la estrategia del cliente (Tramo 0). Rutas de logos relativas a la carpeta.
3. Dato que no está → `[[FALTA: …]]`. Nunca inventar precios, clientes ni frases.
4. Adapta `prompts-imagenes.md` a la paleta y al rubro del cliente.
5. `node scripts/marca-pdf.js <carpeta>` → revisa el PDF página por página.

## Páginas (40 con los datos completos)
Portada · Índice · 0.1 Cómo usar · por capítulo: separador + secciones · Cierre.

| Capítulo | Secciones | Datos en `marca.js` |
|---|---|---|
| 1 Esencia | Frase (impacto) · Cliente · Palabras clave | `esencia` |
| 2 Logo | Versiones · Margen · Tamaño mínimo · Fondos · Usos incorrectos | `logo` |
| 3 Color | Paleta (grupo `atardecer`/principal + neutros) · Degradado · Proporciones · Contraste AA calculado | `colores`, `paleta_idea`, `degradado`, `degradado_simbolo`, `contrastes` |
| 4 Tipografía | Familias · Jerarquía | `tipografias`, `jerarquia`, `canva`, `fuentes_google` |
| 5 Voz | Escalas · No decimos / sí decimos · WhatsApp | `voz` |
| 6 Fotografía | Tres reglas · Con el celular | `fotografia`, `fotografia_celular` |
| 7 Aplicaciones | Post · Story · Perfil y destacadas · Catálogo y Google · Tarjeta con QR · Firma y letrero · Medidas | `aplicaciones` |
| 8 Archivos | Carpetas y formatos · Respaldo | `archivos` |

## Reglas
- Marco HORIZON (crema, tinta, naranja para marcar, superficie profunda de atardecer). El color y la letra del cliente van solo dentro de los ejemplos.
- `logo.fondo_obligatorio: 'oscuro'` si el logo solo funciona sobre oscuro (caso HORIZON).
- `rol` en colores: `tinta`, `fondo`, `fondo2`, `acento` (los usa la página de proporciones).
- Copy de los ejemplos en tuteo chileno y segunda persona. Nunca voseo, salvo como ejemplo tachado en "No decimos".
