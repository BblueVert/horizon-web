import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEstado } from '../src/estado.js';
import { crearConversacion } from '../src/conversacion.js';
import { validarFicha, codigoDemo, linkDemo, slugDe } from '../src/ficha.js';
import { construirPrompt, interpretar, avisoDueno } from '../src/agente.js';

const ejemplo = JSON.parse(readFileSync(new URL('../fichas/ejemplo-sangucheria.json', import.meta.url), 'utf8'));
const silencioso = { error() {}, warn() {}, log() {} };
const YO = '56900000001@s.whatsapp.net';
const CLIENTE = '56911112222@s.whatsapp.net';

function armar(respuestas = []) {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'estado.json'));
  const fichas = new Map([[ejemplo.slug, ejemplo]]);
  const llamadas = [];
  const acciones = [];
  let i = 0;
  const responder = async (ficha, historial, mensaje) => {
    llamadas.push({ ficha: ficha.slug, historial: [...historial], mensaje });
    return respuestas[i++] || { respuestas: ['ok'], accion: null };
  };
  const conv = crearConversacion({
    estado,
    fichas: { obtener: s => fichas.get(s) || null, todas: () => [...fichas.values()] },
    responder,
    registrarAccion: async a => { acciones.push(a); },
    log: silencioso,
  });
  conv.conectado(YO, '56900000001');
  return { conv, estado, llamadas, acciones };
}

test('chat sin demo no se responde (número compartido)', async () => {
  const { conv, llamadas } = armar();
  assert.deepEqual(await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'hola' }), []);
  assert.equal(llamadas.length, 0);
});

test('el link con código conecta el chat y saluda como el negocio', async () => {
  const { conv, estado, llamadas } = armar([{ respuestas: ['¡Hola! Soy Rincón 🥪'], accion: null }]);
  const out = await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'Hola! Quiero probar el asistente de Sanguchería El Rincón (demo: ejemplo-sangucheria)' });
  assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
  assert.equal(llamadas[0].mensaje, 'Hola');
  assert.deepEqual(out[0], { jid: CLIENTE, texto: '¡Hola! Soy Rincón 🥪' });
  assert.match(out[1].texto, /empezó la demo de Sanguchería El Rincón/);
  assert.equal(out[1].jid, YO);
});

test('código inexistente: respuesta amable y aviso a Benja', async () => {
  const { conv } = armar();
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'demo: no-existe' });
  assert.match(out[0].texto, /no está disponible/);
  assert.equal(out[1].jid, YO);
});

test('pedido confirmado: aviso "así le llega al dueño" y se registra', async () => {
  const { conv, estado, acciones, llamadas } = armar([
    { respuestas: ['Hola'], accion: null },
    { respuestas: ['¡Listo! Tu pedido quedó confirmado.'], accion: { tipo: 'pedido', resumen: '2 churrascos italianos, delivery', datos: { cliente: 'Ana', total: 15970 } } },
  ]);
  await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'demo ejemplo-sangucheria' });
  const out = await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'sí, confirmo' });
  assert.equal(llamadas[1].historial.length, 2, 'lleva el historial');
  assert.match(out[1].texto, /Así le llegaría este aviso al dueño[\s\S]*Nuevo pedido[\s\S]*Total: \$15\.970[\s\S]*\+56911112222/);
  assert.equal(acciones[0].tipo, 'pedido');
  assert.equal(estado.historial(CLIENTE).length, 4);
});

test('comandos desde el teléfono: #demo, respuesta a mano pausa, #demo off', async () => {
  const { conv, estado } = armar();
  let out = await conv.delLocal({ jid: CLIENTE, telefono: '56911112222', texto: '#demo ejemplo-sangucheria' });
  assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
  assert.equal(out[0].jid, CLIENTE);

  await conv.delLocal({ jid: CLIENTE, telefono: '56911112222', texto: 'hola, soy Benja, te explico' });
  assert.equal(estado.enPausa(CLIENTE), true);
  assert.deepEqual(await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'ok' }), []);

  out = await conv.delLocal({ jid: CLIENTE, telefono: '569', texto: '#demo off' });
  assert.equal(estado.demoDe(CLIENTE), null);
  assert.equal(out[0].jid, YO);
});

test('#demos lista las demos con su link en tu chat', async () => {
  const { conv } = armar();
  const [m] = await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#demos' });
  assert.equal(m.jid, YO);
  assert.match(m.texto, /Sanguchería El Rincón[\s\S]*https:\/\/wa\.me\/56900000001\?text=/);
});

test('en tu propio chat puedes probar la demo haciendo de cliente', async () => {
  const { conv, llamadas } = armar();
  await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#demo ejemplo-sangucheria' });
  await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '¿tienen promo?' });
  assert.equal(llamadas.at(-1).mensaje, '¿tienen promo?');
});

test('ficha: validación, código del link y slug', () => {
  assert.deepEqual(validarFicha(ejemplo).errores, []);
  assert.ok(validarFicha({ slug: 'X X', nombre: '' }).errores.length >= 3);
  assert.equal(codigoDemo(decodeURIComponent(linkDemo('+56 9 1234 5678', ejemplo).split('text=')[1])), 'ejemplo-sangucheria');
  assert.match(linkDemo('+56 9 1234 5678', ejemplo), /^https:\/\/wa\.me\/56912345678\?text=/);
  assert.equal(slugDe('Tía Julia — Rancagua'), 'tia-julia-rancagua');
});

test('prompt: incluye catálogo con precios, precio a confirmar y tuteo', () => {
  const p = construirPrompt(ejemplo);
  assert.match(p, /Churrasco italiano: \$6\.990/);
  assert.match(p, /Jugo natural del día: precio a confirmar/);
  assert.match(p, /Nunca voseo/);
  assert.match(p, /Mínimo: \$8\.000/);
});

test('interpretar: JSON, texto suelto y acción inválida', () => {
  assert.deepEqual(interpretar('{"respuestas":["a","b"],"accion":null}'), { respuestas: ['a', 'b'], accion: null });
  assert.deepEqual(interpretar('hola sin json'), { respuestas: ['hola sin json'], accion: null });
  assert.equal(interpretar('{"respuestas":["a"],"accion":{"tipo":"otra"}}').accion, null);
  assert.match(avisoDueno(ejemplo, { tipo: 'reserva', resumen: 'Mesa para 4', datos: {} }, '569'), /\*Nueva reserva\* · Sanguchería El Rincón/);
});
