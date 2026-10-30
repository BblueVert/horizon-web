import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../src/config.js';
import { responderMotor } from '../src/motores.js';
import { crearEstado } from '../src/estado.js';
import { crearConversacion } from '../src/conversacion.js';

const silencioso = { error() {}, warn() {}, log() {} };

test('motor: habla el formato del kit de Mesa Cero ({phone, mensaje} → {replyChunks})', async () => {
  let recibido;
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
      recibido = JSON.parse(b);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ replyChunks: ['¡Hola! Bienvenido a Tía Julia', '¿Qué te gustaría pedir?'] }));
    });
  });
  await new Promise(r => srv.listen(0, r));
  config.motores['n8n-falso'] = `http://localhost:${srv.address().port}/webhook/wa-mesacero-v2`;
  const r = await responderMotor('n8n-falso', '56911112222', 'hola');
  srv.close();
  assert.equal(recibido.phone, '56911112222');
  assert.equal(recibido.mensaje, 'hola');
  assert.deepEqual(r, { respuestas: ['¡Hola! Bienvenido a Tía Julia', '¿Qué te gustaría pedir?'], accion: null });
});

test('motor sin URL configurada falla con mensaje claro', async () => {
  await assert.rejects(responderMotor('no-existe', '569', 'hola'), /sin URL/);
});

test('ficha con motor no pasa por la IA genérica; el resto sí', async () => {
  const tia = { slug: 'tia-julia', nombre: 'Tía Julia', rubro: 'restaurante', flujo: 'pedidos', motor: 'mesa-cero' };
  const otra = { slug: 'otra', nombre: 'Otra', rubro: 'tienda', flujo: 'pedidos' };
  const fichas = new Map([[tia.slug, tia], [otra.slug, otra]]);
  const usados = [];
  const conv = crearConversacion({
    estado: crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json')),
    fichas: { obtener: s => fichas.get(s) || null, todas: () => [...fichas.values()] },
    responder: async () => { usados.push('ia'); return { respuestas: ['ia'], accion: null }; },
    responderMotor: async (m, tel, txt) => { usados.push(`${m}:${txt}`); return { respuestas: ['n8n'], accion: null }; },
    log: silencioso,
  });
  conv.conectado('569@s.whatsapp.net', '569');
  const a = await conv.entrante({ jid: 'a@s.whatsapp.net', telefono: '561', texto: 'Hola (demo: tia-julia)' });
  await conv.entrante({ jid: 'b@s.whatsapp.net', telefono: '562', texto: 'demo otra' });
  assert.deepEqual(usados, ['mesa-cero:Hola', 'ia']);
  assert.equal(a[0].texto, 'n8n');
});
