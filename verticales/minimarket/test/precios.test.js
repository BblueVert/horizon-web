import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria } from '../src/db/memoria.js';
import { indexarCatalogo, buscarCandidatos, tramosPorDefecto } from '../src/catalogo.js';
import { precioUnitario, cotizarCarrito, consejoMayorista, fichaPrecio } from '../src/precios.js';

const db = crearMemoria();
const cat = indexarCatalogo(db.datos);
const neg = db.datos.negocio;
const leche = cat.porSku.get('LAC-001'); // $1.290, caja 12

test('tramos por defecto: mitad de caja -6%, caja completa -12%', () => {
  assert.deepEqual(tramosPorDefecto('un', 1290, 12), [[6, 1210, 'mayorista'], [12, 1130, 'caja']]);
  assert.deepEqual(tramosPorDefecto('kg', 2190, null), [[5, 2010, 'mayorista']]);
  assert.deepEqual(tramosPorDefecto('un', 1190, null), [[6, 1130, 'mayorista']]);
});

test('el precio baja al llegar a cada tramo', () => {
  assert.deepEqual(precioUnitario(leche, 1), { precio: 1290, tramo: 'detalle' });
  assert.deepEqual(precioUnitario(leche, 5), { precio: 1290, tramo: 'detalle' });
  assert.deepEqual(precioUnitario(leche, 6), { precio: 1210, tramo: 'mayorista' });
  assert.deepEqual(precioUnitario(leche, 24), { precio: 1130, tramo: 'caja' });
});

test('cliente mayorista registrado paga el primer tramo desde 1 unidad', () => {
  assert.deepEqual(precioUnitario(leche, 1, 'mayorista'), { precio: 1210, tramo: 'mayorista' });
  assert.deepEqual(precioUnitario(leche, 12, 'mayorista'), { precio: 1130, tramo: 'caja' });
});

test('carrito: subtotal, ahorro mayorista y despacho', () => {
  const cot = cotizarCarrito([{ sku: 'LAC-001', cantidad: 12 }, { sku: 'PAN-001', cantidad: 1.5 }], cat, neg, 'despacho');
  assert.equal(cot.subtotal, 12 * 1130 + Math.round(2190 * 1.5));
  assert.equal(cot.ahorro, 12 * (1290 - 1130));
  assert.equal(cot.despacho, 1500);
  assert.equal(cot.esMayorista, true);
  const grande = cotizarCarrito([{ sku: 'LIM-003', cantidad: 4 }], cat, neg, 'despacho');
  assert.equal(grande.despacho, 0, 'gratis sobre el umbral');
});

test('consejo mayorista solo cuando falta poco', () => {
  assert.match(consejoMayorista(leche, 4), /Si llevas 6 .* \$1\.210 c\/u/);
  assert.equal(consejoMayorista(leche, 1), null);
  assert.match(consejoMayorista(leche, 10), /Si llevas 12/);
  assert.equal(consejoMayorista(leche, 12), null);
});

test('ficha de precio muestra los tramos', () => {
  assert.equal(fichaPrecio(leche), 'Leche entera Soprole 1 L: $1.290 · desde 6 a $1.210 c/u · desde 12 a $1.130 c/u');
});

test('búsqueda de candidatos entiende alias y plurales', () => {
  const skus = (t) => buscarCandidatos(cat, t).map(p => p.sku);
  assert.ok(skus('tienen confort?').includes('APE-001'));
  assert.ok(skus('quiero 2 cocas').includes('BEB-001'));
  assert.ok(skus('medio kilo de tomates').includes('FYV-002'));
  assert.ok(skus('pomarola').includes('DES-002'));
  assert.deepEqual(skus('hola buenas tardes'), []);
});
