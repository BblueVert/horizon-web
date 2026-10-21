# Manual de identidad HORIZON · Prompts de imágenes

Cada imagen tiene un código (`IMG-01` … `IMG-20`). En el manual, ese código aparece en el espacio donde va la imagen.

**Cómo cargarlas**
1. Guarda cada imagen como `Identidad/manual/img/IMG-NN.jpg`. Usa JPG: con WebP o PNG el PDF pesa casi 4 veces más.
2. Corre `node scripts/marca-pdf.js Identidad/manual`.
3. El script las detecta y las pone en su lugar. No hay que tocar `marca.js`.

Los prompts están en inglés porque los generadores responden mejor así. Arriba de cada uno va qué es y dónde va.

---

## Versión elegida (octubre 2026)
De cada prompt se generaron 2 versiones. Se eligió una por estos criterios: sin texto, trazo de línea parejo, paleta atardecer y celulares derechos.

| Código | Elegida | Por qué |
|---|---|---|
| IMG-01 | Sol a la derecha, rayos largos | Deja libre la zona del título |
| IMG-02 | Kinesióloga de frente con el celular | Luz de atardecer y un fondo más limpio |
| IMG-03 | Arco grueso en degradado | Simétrica; se lee como atardecer |
| IMG-04 | Objetos en diagonal sobre crema | Pasa de claro a oscuro, como el atardecer |
| IMG-05 | Papelería con letras fragmentadas | Las letras se leen menos; el recorte las deja afuera |
| IMG-06 | Barbero con WhatsApp | Es WhatsApp, no otra app de mensajes |
| IMG-07 | Dueña fotografiando productos | Más orden y celular derecho |
| IMG-08 | Flat lay sin texto | La otra traía "7 · Aplicaciones" escrito |
| IMG-09 | Carpetas en línea | Mismo trazo que el resto; la otra tenía rellenos |
| IMG-10 | Kinesióloga en recepción, de frente | Centrada para el recorte vertical |
| IMG-11 | Local en esquina con plantas | Dueño visible y más cercano |
| IMG-12 | Sala con ventana | Más luz y orden |
| IMG-13 | Kinesióloga con paciente al fondo | Composición natural con espacio para el texto |
| IMG-14 | Sol con reflejos | Más presencia detrás del título |
| IMG-15 a 17 | Versiones de solo línea | Iguales entre sí, sin confeti |
| IMG-18 | Diseñador con vista a la ciudad | Muestra lo local |
| IMG-19 | Producto junto a la ventana | Horizonte derecho y fondo despejado |
| IMG-20 | Camino en degradado con estrellas | Más profundidad |

---

## Estilo base: pégalo al final de cada prompt

### A · Realista (fotografía HORIZON)
```
editorial documentary photography, real small service business in Rancagua, Chile, natural window side light, warm golden-hour color grade with soft orange highlights and gentle violet shadows (sunset palette), clean uncluttered background, one clear subject, candid not posed, 35mm lens, shallow depth of field, phones and screens always straight and frontal, no text, no logos, no watermark
```

### B · Ilustración (línea HORIZON)
```
minimal flat vector line illustration, single consistent thin stroke weight with rounded caps and rounded joins, geometric and calm, generous negative space, sunset gradient accents (#FBE396 yellow sun, #F2690C orange, #CC3253 red, #C4467A pink, #7B3FA0 violet), background deep night violet #1E1744 OR cream #FFFBF6 as indicated, no text, no letters, no emojis, no 3D, no glossy effects, no gradients on the background
```

### Negativo (si el generador lo acepta)
```
text, letters, words, logo, watermark, emoji, stock photo smile, tilted phone, dutch angle, 3D render, plastic skin, oversaturated, cluttered background, HDR
```

**Paleta de referencia:** el atardecer. El sol amarillo `#FBE396` pasa por naranja `#F2690C`, rojo `#CC3253`, rosa `#C4467A` y violeta `#7B3FA0`, y termina en la noche `#1E1744`. Los neutros son tinta `#1A1626`, crema `#FFFBF6` y arena `#FFF4EA`.

---

## Portada y separadores

### IMG-01 · Portada · ilustración (B, fondo noche) · 16:9 · 3840×2160
Va de fondo en la portada, mezclada sobre la superficie oscura. El título va abajo a la izquierda, así que esa zona queda tranquila.
```
wide horizon line across the lower third, a large half sun setting on the right side drawn as concentric thin arcs, rays as fine lines, sky fading from deep night violet at the top to warm orange and yellow near the horizon on the right, left half almost empty and dark for a title, minimal flat vector line illustration, single consistent thin stroke weight with rounded caps, sunset gradient accents #FBE396 #F2690C #CC3253 #C4467A #7B3FA0, background deep night violet #1E1744, no text, no letters
```

### IMG-02 · Separador 1 · Esencia · realista (A) · 1:1 · 2048×2048
```
a Chilean woman around 38, owner of a small physiotherapy studio, standing in her tidy treatment room holding her phone at her side, calm and confident, looking slightly off camera, late afternoon window light warming one side of her face, + estilo A
```

### IMG-03 · Separador 2 · Logo · ilustración (B, fondo noche) · 1:1 · 2048×2048
Es un trazado de construcción, no un logo nuevo.
```
geometric construction drawing like a designer's logo grid: two concentric circles, a horizontal horizon line through the center, thin guide lines at 45 degrees, small measurement ticks, one arc highlighted with a sunset gradient stroke from yellow to violet, technical and elegant, + estilo B (background deep night violet #1E1744)
```

### IMG-04 · Separador 3 · Color · realista (A) · 1:1 · 2048×2048
```
overhead flat lay on cream paper: a pale yellow ceramic cup, an orange paper folder, a red-pink linen napkin, a magenta notebook, a violet fabric swatch and a deep navy card arranged in a diagonal from light to dark like a sunset, soft natural shadows, minimal, + estilo A
```

### IMG-05 · Separador 4 · Tipografía · realista (A) · 1:1 · 2048×2048
La IA escribe mal: pide letras desenfocadas, sin palabras legibles.
```
close-up of printed stationery on a cream desk: business cards and an A4 sheet with large bold sans-serif letterforms, letters out of focus and not legible, a pencil and a metal ruler, warm side light, shallow depth of field, + estilo A
```

### IMG-06 · Separador 5 · Voz · realista (A) · 1:1 · 2048×2048
```
hands of a barber holding a phone straight and frontal, a chat conversation on screen with blurred unreadable bubbles, barbershop softly out of focus behind, warm evening light, + estilo A
```

### IMG-07 · Separador 6 · Fotografía · realista (A) · 1:1 · 2048×2048
```
a small beauty studio owner photographing her neatly arranged products with her phone held upright and level, next to a window with soft side light, clean table, view from behind her shoulder, + estilo A
```

### IMG-08 · Separador 7 · Aplicaciones · realista (A) · 1:1 · 2048×2048
```
overhead flat lay on a cream desk: a dark business card, a small printed card with a square QR-like pattern, a phone lying straight showing a grid of colorful square posts (abstract, no text), a coffee cup, a pen, accents in orange, pink and violet, soft shadows, + estilo A
```

### IMG-09 · Separador 8 · Archivos · ilustración (B, fondo noche) · 1:1 · 2048×2048
```
three stacked folders, a cloud and a small shield with a check mark, connected by one continuous thin line, arranged on a subtle dot grid, + estilo B (background deep night violet #1E1744)
```

---

## Páginas de contenido

### IMG-10 · 1.2 Cliente principal · realista (A) · 2:3 · 1600×2400
```
portrait of a Chilean woman around 38, owner of a local service business (physiotherapy studio), sitting at her reception desk with her phone in hand, slight genuine smile, looking at the camera, waist-up framing, natural window light, + estilo A
```

### IMG-11 · 6.1 Regla 2 · Negocios de la zona · realista (A) · 3:4 · 1800×2400
Es una referencia de estilo. En publicaciones reales se usan fotos reales.
```
a small service business storefront on a quiet street in Rancagua, Chile at golden hour, the owner standing at the door with arms relaxed, low-rise buildings and Andes hills soft in the background, + estilo A
```

### IMG-12 · 6.1 Regla 3 · Luz y orden · realista (A) · 3:4 · 1800×2400
```
a tidy treatment room with a single treatment table by a large window, soft side light, one plant, nothing else on surfaces, calm and orderly, + estilo A
```

### IMG-13 · 7.1 Post y 2.4 Foto oscurecida · realista (A) · 4:5 · 2160×2700
El tercio de abajo va más oscuro porque ahí va el texto y el sello.
```
a kinesiologist answering a client message on her phone at the reception counter while a patient waits relaxed in the background, phone held upright, warm late-afternoon light, lower third of the frame darker and simple for text overlay, + estilo A
```

### IMG-14 · 7.2 Story · ilustración (B, fondo noche) · 9:16 · 2160×3840
```
vertical sunset sky: thin horizon line at 70% height, half sun as concentric arcs sitting on the line, fine rays, the upper part deep night violet and quiet for a title, warm orange and yellow glow only near the horizon, + estilo B (background deep night violet #1E1744)
```

### IMG-15 · 7.4 Catálogo · Diagnóstico · ilustración (B, fondo crema) · 1:1 · 2160×2160
```
a video call window with a small magnifying glass over a tiny storefront drawing inside it, a clock icon with 30 minutes marked, + estilo B (background cream #FFFBF6)
```

### IMG-16 · 7.4 Catálogo · Kit Responde y Agenda · ilustración (B, fondo crema) · 1:1 · 2160×2160
```
a phone drawn straight and frontal with three chat bubbles, next to it a calendar card with one day highlighted and a short checklist with check marks, + estilo B (background cream #FFFBF6)
```

### IMG-17 · 7.4 Catálogo · Plan 01 · ilustración (B, fondo crema) · 1:1 · 2160×2160
```
a browser window connected by one flowing line to a calendar card and then to a client portal card with a check mark, showing a simple journey from website to booking to portal, + estilo B (background cream #FFFBF6)
```

### IMG-18 · 7.4 Portada de Google Business · realista (A) · 16:9 · 3840×2160
Referencia. La portada real tiene que ser una foto tuya trabajando.
```
a young Chilean digital designer working at a wooden desk with a laptop showing a clean website layout (no legible text) and a phone standing upright beside it, window with soft evening light and city of Rancagua out of focus outside, + estilo A
```

### IMG-19 · 6.2 Con el celular · realista (A) · 9:16 · 2160×3840
Se ve dentro del celular, con la cuadrícula encima. Dejar el centro despejado.
```
vertical photo as seen through a phone camera: a neatly arranged service product on a clean table next to a window, soft side light, subject centered on the rule-of-thirds intersection, level horizon, + estilo A
```

### IMG-20 · Cierre · ilustración (B, fondo noche) · 1:1 · 2048×2048
```
a straight path drawn with two thin converging lines leading to a sun setting on the horizon, the sun as concentric arcs, a few small stars in the night sky above, + estilo B (background deep night violet #1E1744)
```

---

## Antes de usarlas
- [ ] Ninguna tiene texto ni logos inventados. Si aparecen letras, se borran o se regenera.
- [ ] Celulares y pantallas derechos y de frente.
- [ ] Las ilustraciones comparten trazo y paleta. Si una sale con otro grosor, se regenera.
- [ ] Las personas se ven reales: sin piel de plástico ni sonrisa de stock.
- [ ] IMG-11, IMG-12 e IMG-18 son referencias de estilo. En la web y en redes van fotos reales.
