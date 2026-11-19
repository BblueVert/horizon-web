import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { generarDocumento, llevaDocumento, fechaLarga, promptDocumento, datosDocumento } from '../src/documento.js';
import { mensajeInicial, validarFicha } from '../src/ficha.js';
import { crearEstado } from '../src/estado.js';
import { crearConversacion } from '../src/conversacion.js';

const ficha = {
  slug: 'banqueteria', nombre: 'Banquetería Demo', rubro: 'servicios', flujo: 'consultas', fuentes: ['test'],
  documento: {
    titulo: 'Propuesta de banquete', plantilla: 'plantillas/eventos.pdf', archivo: 'Propuesta - {novios}.pdf',
    mensaje: 'Te dejo la propuesta 💍', datos: { novios: 'nombres', barra: 'true si pidió barra' },
    campos: [
      { clave: 'novios', pagina: 0, x: 45, y: 114, ancho: 238, fuente: 'serif' },
      { clave: 'barra', pagina: 2, x: 368, y: 583, ancho: 96, alinear: 'centro', marca: true },
      { clave: 'emision', pagina: 2, x: 436, y: 789, ancho: 113 },
    ],
  },
};

test('el mensaje del link conserva lo que trae el cotizador y quita el código', () => {
  assert.equal(mensajeInicial('Hola! Quiero probar el asistente de Festiva (demo: eventos)'), 'Hola');
  assert.equal(mensajeInicial('demo: eventos'), 'Hola');
  assert.equal(
    mensajeInicial('Hola! Quiero cotizar el banquete para mi matrimonio. Invitados: aprox. 120. (demo: eventos)'),
    'Hola! Quiero cotizar el banquete para mi matrimonio. Invitados: aprox. 120.',
  );
});

test('genera el PDF sobre la plantilla con nombre de archivo según los datos', async () => {
  const { buffer, nombre } = await generarDocumento(ficha, { novios: 'Camila y Diego', barra: true });
  assert.equal(nombre, 'Propuesta - Camila y Diego.pdf');
  const pdf = await PDFDocument.load(buffer);
  assert.equal(pdf.getPageCount(), 4);
  assert.match(pdf.getTitle(), /Banquetería Demo/);
});

test('documento solo en las acciones configuradas; fecha de emisión en Chile', () => {
  assert.equal(llevaDocumento(ficha, { tipo: 'consulta' }), true);
  assert.equal(llevaDocumento(ficha, { tipo: 'derivar' }), false);
  assert.equal(llevaDocumento({ slug: 'x' }, { tipo: 'consulta' }), false);
  assert.equal(fechaLarga(new Date('2026-11-18T15:00:00Z')), '18 de noviembre de 2026');
  assert.match(promptDocumento(ficha), /"novios": nombres/);
});

test('la ficha valida el bloque documento', () => {
  assert.deepEqual(validarFicha(ficha).errores, []);
  const mala = { ...ficha, documento: { plantilla: '' } };
  assert.ok(validarFicha(mala).errores.some(e => /plantilla/.test(e)));
});

test('al confirmar la consulta se manda el PDF y el aviso lo menciona', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'estado.json'));
  const mensajes = [];
  const conv = crearConversacion({
    estado,
    fichas: { obtener: s => (s === ficha.slug ? ficha : null), todas: () => [ficha] },
    responder: async (_f, _h, mensaje) => {
      mensajes.push(mensaje);
      return mensajes.length === 1
        ? { respuestas: ['¡Felicitaciones! ¿Cómo se llaman los novios?'], accion: null }
        : { respuestas: ['Listo, te mando la propuesta'], accion: { tipo: 'consulta', resumen: 'Matrimonio 120 personas', datos: { cliente: 'Camila', documento: { novios: 'Camila y Diego', barra: true } } } };
    },
    generarDocumento: async (_f, datos) => ({ buffer: Buffer.from('pdf'), nombre: `Propuesta - ${datos.novios}.pdf` }),
    log: { error() {}, warn() {}, log() {} },
  });
  conv.conectado('56900000001@s.whatsapp.net', '56900000001');
  const jid = '56911112222@s.whatsapp.net';
  await conv.entrante({ jid, telefono: '56911112222', texto: 'Hola! Quiero cotizar el banquete para mi matrimonio. Invitados: aprox. 120. (demo: banqueteria)' });
  assert.match(mensajes[0], /Invitados: aprox\. 120/);
  const out = await conv.entrante({ jid, telefono: '56911112222', texto: 'Camila y Diego, sí confirmo' });
  const doc = out.find(m => m.documento);
  assert.equal(doc.documento.nombre, 'Propuesta - Camila y Diego.pdf');
  assert.equal(doc.texto, 'Te dejo la propuesta 💍');
  assert.ok(out.some(m => /PDF enviado: Propuesta - Camila y Diego\.pdf/.test(m.texto || '')));
});

test('los datos del cotizador llegan al PDF aunque la IA no los repita', async () => {
  const { readFileSync } = await import('node:fs');
  const conExtraer = {
    ...ficha,
    documento: {
      ...ficha.documento,
      extraer: {
        invitados: { re: 'invitados:\\s*(?:aprox\\.?\\s*)?(\\d{1,4})', valor: '$1 personas' },
        fecha: { re: 'fecha:\\s*([^.\\n]+?)\\.(?:\\s|$)' },
        lugar: { re: 'lugar:\\s*(.+?)\\.(?:\\s|$)' },
        formato: [{ re: 'formato:\\s*cena servida', valor: 'Cena servida' }],
        barra: { re: 'barra de tragos', valor: true },
        montaje: { re: 'montaje', valor: true },
      },
      alias: { novios: ['cliente'] },
    },
  };
  const cotizador = 'Hola! Quiero cotizar el banquete para mi matrimonio. Invitados: aprox. 120. Fecha: 14 de marzo de 2027. Lugar: Viña en Machalí. Formato: cena servida. También necesito: barra de tragos, garzones.';
  // La IA solo mandó el nombre en "cliente" y nada en "documento".
  const datos = datosDocumento(conExtraer, { tipo: 'consulta', datos: { cliente: 'Camila y Diego' } }, [cotizador, 'Camila y Diego', 'sí']);
  assert.deepEqual(datos, { invitados: '120 personas', fecha: '14 de marzo de 2027', lugar: 'Viña en Machalí', formato: 'Cena servida', barra: true, novios: 'Camila y Diego' });
  // Lo que manda la IA en documento gana (el cliente cambió de opinión en el chat).
  const corregido = datosDocumento(conExtraer, { tipo: 'consulta', datos: { documento: { invitados: '150 personas' } } }, [cotizador]);
  assert.equal(corregido.invitados, '150 personas');
  assert.ok(readFileSync);
});

test('el formato de respuesta pide el bloque documento cuando la ficha lo tiene', async () => {
  const { construirPrompt } = await import('../src/agente.js');
  assert.match(construirPrompt(ficha), /"documento": \{"novios": \.\.\., "barra": \.\.\.\}/);
});
