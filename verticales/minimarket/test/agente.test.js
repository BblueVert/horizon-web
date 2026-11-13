// Conversaciones completas con la IA simulada: cada turno entrega el JSON que
// devolvería la capa 1, y se verifica lo que hace el motor + la base en memoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria } from '../src/db/memoria.js';
import { crearAgente } from '../src/agente.js';

const silencioso = { error() {}, warn() {}, log() {} };
const martesMediodia = () => new Date('2026-10-27T15:00:00Z'); // 12:00 en Santiago

function conversacion(guion, { db = crearMemoria(), ahora = martesMediodia } = {}) {
  let turno = 0;
  const prompts = [];
  const extraer = async (prompt) => {
    prompts.push(prompt);
    return { ext: guion[turno++] || {}, tokensEntrada: 1200, tokensSalida: 90 };
  };
  const agente = crearAgente({ db, extraer, ahora, log: silencioso });
  const decir = (mensaje, telefono = '56911112222') => agente.manejarMensaje({ telefono, mensaje });
  return { db, decir, prompts };
}

test('pedido mayorista de punta a punta con despacho', async () => {
  const { db, decir } = conversacion([
    { saludo: true, reply: ['¡Hola! ¿Qué necesitas hoy?'] },
    { items: [{ sku: 'LAC-001', mencionado: 'leche soprole', cantidad: 10, accion: 'agregar' }, { sku: 'ABA-007', mencionado: 'aceite', cantidad: 6, accion: 'agregar' }] },
    { items: [{ sku: 'LAC-001', mencionado: 'leche', cantidad: 12, accion: 'cambiar' }] },
    { nombre: 'Rosa Muñoz' },
    { entrega: 'despacho' },
    { direccion: 'Pasaje Los Aromos 455, Rancagua' },
    { pago: 'transferencia' },
    { confirmar: 'si' },
  ]);

  let r = await decir('hola');
  assert.match(r.replyChunks[0], /Hola/);

  r = await decir('necesito 10 leches soprole y 6 aceites belmont');
  assert.match(r.replyChunks.join('\n'), /Anotado: 10 x Leche entera Soprole 1 L, 6 x Aceite vegetal Belmont 1 L/);
  assert.match(r.replyChunks.join('\n'), /Si llevas 12 de leche entera te queda a \$1\.130 c\/u \(precio caja\)/);
  assert.match(r.replyChunks.at(-1), /A nombre de quién/);

  r = await decir('ya, mejor que sean 12 leches');
  r = await decir('rosa muñoz');
  assert.match(r.replyChunks.at(-1), /retiras en el local o te lo despachamos/);
  r = await decir('despacho');
  assert.match(r.replyChunks.at(-1), /A qué dirección te lo mando, Rosa/);
  r = await decir('pasaje los aromos 455');
  assert.match(r.replyChunks.at(-1), /Cómo vas a pagar/);
  r = await decir('transferencia');
  const resumen = r.replyChunks.join('\n');
  assert.match(resumen, /12 x Leche entera Soprole 1 L — \$1\.130 c\/u \(caja\) = \$13\.560/);
  assert.match(resumen, /6 x Aceite vegetal Belmont 1 L — \$2\.150 c\/u \(mayorista\) = \$12\.900/);
  assert.match(resumen, /Ahorro por precio mayorista: \$2\.760/);
  assert.match(resumen, /Despacho: gratis/);
  assert.match(resumen, /\*Total: \$26\.460\*/);

  r = await decir('sí');
  assert.equal(r.pedido, 'MM-0001');
  assert.match(r.replyChunks[0], /Listo Rosa! Tu pedido \*MM-0001\* quedó confirmado por \$26\.460/);
  assert.match(r.replyChunks.join('\n'), /Te ahorraste \$2\.760/);
  assert.match(r.replyChunks.join('\n'), /datos de transferencia/);

  const p = db.pedidos[0];
  assert.equal(p.total, 26460);
  assert.equal(p.es_mayorista, true);
  assert.equal(db.datos.productos.find(x => x.sku === 'LAC-001').stock, 36 - 12, 'descuenta stock');
  assert.equal(db.interacciones.length, 8);
  assert.ok(db.interacciones[0].costo_clp > 0);
});

test('no confirma si no se mostró el resumen antes', async () => {
  const { db, decir } = conversacion([
    { items: [{ sku: 'GOL-001', mencionado: 'super 8', cantidad: 3 }], nombre: 'Pedro', entrega: 'retiro', pago: 'efectivo', confirmar: 'si' },
  ]);
  const r = await decir('3 super 8, soy pedro, retiro, pago efectivo, confirmo');
  assert.equal(db.pedidos.length, 0);
  assert.match(r.replyChunks.join('\n'), /Tu pedido:[\s\S]*3 x Super 8 Nestlé 29 g/);
  assert.match(r.replyChunks.at(-1), /Lo confirmo/);
});

test('producto ambiguo: ofrece opciones y luego resuelve', async () => {
  const { decir, prompts } = conversacion([
    { items: [{ sku: null, mencionado: 'leche', cantidad: 2, opciones: ['LAC-001', 'LAC-002', 'LAC-003'] }] },
    { items: [{ sku: 'LAC-003', mencionado: 'la sin lactosa', cantidad: 2 }] },
  ]);
  let r = await decir('2 leches');
  assert.match(r.replyChunks.join('\n'), /Cuál de "leche" quieres\?\n1\. Leche entera Soprole 1 L — \$1\.290/);
  r = await decir('la sin lactosa');
  assert.match(prompts[1], /LAC-003/, 'las opciones ofrecidas siguen en el prompt');
  assert.match(r.replyChunks[0], /Anotado: 2 x Leche sin lactosa Loncoleche 1 L/);
});

test('stock: limita la cantidad y avisa', async () => {
  const { decir } = conversacion([
    { items: [{ sku: 'APE-012', mencionado: 'pañales', cantidad: 5 }] },
  ]);
  const r = await decir('5 paquetes de pañales');
  assert.match(r.replyChunks.join('\n'), /solo me quedan 3, te dejé esa cantidad/);
});

test('consulta de precio no toca el carrito y muestra tramos', async () => {
  const { decir } = conversacion([{ consultaPrecios: ['BEB-001'] }]);
  const r = await decir('a cuánto la coca de 3 litros?');
  assert.equal(r.replyChunks[0], 'Coca-Cola original 3 L: $3.490 · desde 3 a $3.280 c/u · desde 6 a $3.070 c/u');
});

test('despacho bajo el mínimo pide agregar o retirar', async () => {
  const { decir } = conversacion([
    { items: [{ sku: 'GOL-001', cantidad: 2 }], nombre: 'Ana', entrega: 'despacho', direccion: 'Calle 1' },
  ]);
  const r = await decir('2 super 8 a calle 1, ana');
  assert.match(r.replyChunks.at(-1), /mínimo es \$8\.000 y llevas \$800/);
});

test('productos por kilo aceptan fracciones', async () => {
  const { decir } = conversacion([{ items: [{ sku: 'FYV-002', mencionado: 'tomate', cantidad: 0.5 }, { sku: 'PAN-001', cantidad: 1 }] }]);
  const r = await decir('medio kilo de tomate y un kilo de marraqueta');
  assert.match(r.replyChunks[0], /Anotado: 500 g Tomate, 1 kg Marraqueta/);
});

test('cliente mayorista registrado ve precio mayorista desde 1', async () => {
  const db = crearMemoria();
  db.clientes.set('56933334444', { telefono: '56933334444', nombre: 'Almacén Doña Tere', tipo: 'mayorista' });
  const { decir } = conversacion([
    { items: [{ sku: 'ABA-009', cantidad: 2 }], entrega: 'retiro', pago: 'efectivo' },
  ], { db });
  const r = await decir('2 azúcar, retiro, efectivo', '56933334444');
  assert.match(r.replyChunks.join('\n'), /2 x Azúcar granulada Iansa 1 kg — \$1\.300 c\/u \(mayorista\)/);
});

test('si se acaba el stock al confirmar, ajusta y vuelve a mostrar el resumen', async () => {
  const db = crearMemoria();
  const { decir } = conversacion([
    { items: [{ sku: 'BEB-015', cantidad: 5 }], nombre: 'Luis', entrega: 'retiro', pago: 'efectivo' },
    { confirmar: 'si' },
  ], { db });
  await decir('5 red bull, luis, retiro, efectivo');
  db.datos.productos.find(p => p.sku === 'BEB-015').stock = 2; // otro cliente compró
  const r = await decir('sí');
  assert.equal(db.pedidos.length, 0);
  assert.match(r.replyChunks[0], /quedan 2/);
  assert.match(r.replyChunks.join('\n'), /2 x Bebida energética Red Bull 250 ml/);
});

test('cancelar limpia el carrito pero recuerda el nombre', async () => {
  const { decir, db } = conversacion([
    { items: [{ sku: 'GOL-001', cantidad: 1 }], nombre: 'Ana' },
    { cancelar: true },
  ]);
  await decir('un super 8, soy ana');
  const r = await decir('olvídalo');
  assert.match(r.replyChunks[0], /sin efecto/);
  const ses = await db.obtenerSesion('56911112222');
  assert.deepEqual(ses.carrito, undefined);
  assert.equal(ses.nombre, 'Ana');
});

test('si la IA falla responde algo amable y no rompe la sesión', async () => {
  const db = crearMemoria();
  const agente = crearAgente({ db, extraer: async () => { throw new Error('timeout'); }, log: silencioso });
  const r = await agente.manejarMensaje({ telefono: '569', mensaje: 'hola' });
  assert.match(r.replyChunks[0], /me lo repites/i);
});
