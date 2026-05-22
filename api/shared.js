'use strict';

const https = require('https');
const crypto = require('crypto');

function sanitize(val, maxLen = 255) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/<[^>]*>/g, '')
    .replace(/['"`;\\]/g, '')
    .trim()
    .substring(0, maxLen);
}

function sanitizeEmail(val) {
  const s = sanitize(val, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

const _rl = new Map();
function rateLimit(ip, windowMs = 60_000, max = 10) {
  const now = Date.now();
  const e = _rl.get(ip) || { count: 0, start: now };
  if (now - e.start > windowMs) { e.count = 0; e.start = now; }
  e.count++;
  _rl.set(ip, e);
  return e.count > max;
}

function getIp(req) {
  return (String(req.headers['x-forwarded-for'] || '')).split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function httpsPost(urlStr, headers, body, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        timeout: timeoutMs,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpsRequest(method, urlStr, headers, body, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        timeout: timeoutMs,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function verifyHmac(secret, rawBody, signatureHeader) {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

module.exports = { sanitize, sanitizeEmail, rateLimit, getIp, httpsPost, httpsRequest, verifyHmac, uid };
