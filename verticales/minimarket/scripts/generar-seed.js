// Genera db/002-seed.sql desde db/catalogo.json (negocio, categorías, productos y tramos).
// Uso: npm run seed

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expandirCatalogo } from '../src/catalogo.js';

const raizProyecto = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = JSON.parse(readFileSync(join(raizProyecto, 'db/catalogo.json'), 'utf8'));
const { negocio, categorias, productos } = expandirCatalogo(json);

const q = (v) => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a) => `array[${a.map(q).join(', ')}]::text[]`;

const sql = [];
sql.push(`-- GENERADO por scripts/generar-seed.js desde db/catalogo.json. No editar a mano: edita el JSON y corre \`npm run seed\`.`);
sql.push(`-- Idempotente: actualiza precios/datos si ya existen, y reemplaza los tramos de cada producto.`);
sql.push(`-- ${productos.length} productos en ${categorias.length} categorías.\n`);

sql.push(`insert into mm_negocio (id, nombre, direccion, comuna, horario, despacho_activo, costo_despacho, despacho_gratis_desde, minimo_despacho, comunas_despacho, medios_pago, datos_transferencia)
values (1, ${q(negocio.nombre)}, ${q(negocio.direccion)}, ${q(negocio.comuna)}, ${q(JSON.stringify(negocio.horario))}::jsonb, ${negocio.despacho_activo}, ${negocio.costo_despacho}, ${negocio.despacho_gratis_desde}, ${negocio.minimo_despacho}, ${arr(negocio.comunas_despacho)}, ${arr(negocio.medios_pago)}, ${q(negocio.datos_transferencia)})
on conflict (id) do update set nombre = excluded.nombre, direccion = excluded.direccion, comuna = excluded.comuna,
  horario = excluded.horario, despacho_activo = excluded.despacho_activo, costo_despacho = excluded.costo_despacho,
  despacho_gratis_desde = excluded.despacho_gratis_desde, minimo_despacho = excluded.minimo_despacho,
  comunas_despacho = excluded.comunas_despacho, medios_pago = excluded.medios_pago,
  datos_transferencia = excluded.datos_transferencia, updated_at = now();\n`);

sql.push(`insert into mm_categorias (id, nombre, orden) values`);
sql.push(categorias.map(c => `  (${q(c.id)}, ${q(c.nombre)}, ${c.orden})`).join(',\n'));
sql.push(`on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden;\n`);

sql.push(`insert into mm_productos (sku, categoria_id, nombre, marca, formato, unidad, precio_detalle, unidades_caja, stock, alias) values`);
sql.push(productos.map(p =>
  `  (${q(p.sku)}, ${q(p.categoria_id)}, ${q(p.nombre)}, ${q(p.marca)}, ${q(p.formato)}, ${q(p.unidad)}, ${p.precio_detalle}, ${p.unidades_caja ?? 'null'}, ${p.stock}, ${arr(p.alias)})`
).join(',\n'));
sql.push(`on conflict (sku) do update set categoria_id = excluded.categoria_id, nombre = excluded.nombre, marca = excluded.marca,
  formato = excluded.formato, unidad = excluded.unidad, precio_detalle = excluded.precio_detalle,
  unidades_caja = excluded.unidades_caja, stock = excluded.stock, alias = excluded.alias, activo = true, updated_at = now();\n`);

sql.push(`delete from mm_precios_escala where sku in (${productos.map(p => q(p.sku)).join(', ')});`);
sql.push(`insert into mm_precios_escala (sku, cantidad_min, precio_unitario, etiqueta) values`);
sql.push(productos.flatMap(p => p.escalas.map(e =>
  `  (${q(p.sku)}, ${e.cantidad_min}, ${e.precio_unitario}, ${q(e.etiqueta)})`)).join(',\n') + ';\n');

writeFileSync(join(raizProyecto, 'db/002-seed.sql'), sql.join('\n'));
console.log(`db/002-seed.sql: ${productos.length} productos, ${productos.reduce((s, p) => s + p.escalas.length, 0)} tramos.`);
