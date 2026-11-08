'use strict';

// Correo saliente de HORIZON por la API de Gmail, con la cuenta comercial (la del OAuth de Google).
// Necesita un refresh token con el permiso gmail.send:
//   GMAIL_REFRESH_TOKEN (si no está, prueba con GOOGLE_REFRESH_TOKEN) + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
// Archivo con "_": no es una ruta pública en Vercel, solo lo usan otras funciones.

const https = require('https');

function formPost(urlStr, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = new URLSearchParams(data).toString();
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', timeout: 10_000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } },
      res => { let b = ''; res.on('data', c => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload); req.end();
  });
}

function jsonPost(urlStr, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = JSON.stringify(body);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', timeout: 15_000,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      res => { let b = ''; res.on('data', c => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload); req.end();
  });
}

const b64url = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encHeader = s => '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?=';

// → 'enviado' | 'sin-configurar' | 'error: <detalle>'
async function enviarCorreo({ to, subject, html, text, cc }) {
  const refresh = process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  if (!refresh || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !to) return 'sin-configurar';
  try {
    const t = await formPost('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh, grant_type: 'refresh_token',
    });
    const token = JSON.parse(t.body || '{}').access_token;
    if (!token) return 'error: token (' + t.status + ')';
    const borde = 'hz' + Date.now().toString(36);
    const mime = [
      'From: ' + encHeader('Benja · HORIZON') + ' <me>',
      'To: ' + to,
      cc ? 'Cc: ' + cc : null,
      'Subject: ' + encHeader(subject),
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="' + borde + '"',
      '',
      '--' + borde,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(text || '').toString('base64'),
      '--' + borde,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html || '').toString('base64'),
      '--' + borde + '--',
    ].filter(l => l !== null).join('\r\n').replace('<me>', '<' + (process.env.CORREO_REMITENTE || 'soportebinks@gmail.com') + '>');
    const r = await jsonPost('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', token, { raw: b64url(mime) });
    if (r.status >= 300) return 'error: gmail ' + r.status + ' ' + r.body.slice(0, 160);
    return 'enviado';
  } catch (e) {
    return 'error: ' + e.message;
  }
}

module.exports = { enviarCorreo };
