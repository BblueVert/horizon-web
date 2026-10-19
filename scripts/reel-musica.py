#!/usr/bin/env python3
"""Música original para reels HORIZON, generada a medida de cada video (sin derechos de terceros).

Misma línea sonora en todos los reels (la "voz" musical de la marca):
  bombo cálido · clap · hats · sub bajo con pump · pad de sintetizador · pluck brillante · stabs en los golpes.
Lo que cambia en cada video: tempo, tonalidad, progresión, energía por escena y los golpes sincronizados
con los cortes, toques y confirmaciones del video. Así cada reel suena distinto pero reconocible.

Uso:  python3 scripts/reel-musica.py cue.json salida.wav
Requiere: numpy, scipy, soundfile  (pip install numpy scipy soundfile)

cue.json (todos los tiempos en segundos):
{
  "bpm": 120, "root": 62, "mode": "major", "prog": [0, 7, 9, 5], "dur": 38.6, "seed": 4,
  "sections": [[0, 1, 0], [1, 2.5, 1], [2.5, 4.5, 3]],   # [desde, hasta, energía 0–3]
  "impacts": [1.0, 32.0],        # golpe fuerte (palabra clave, cierre)
  "hits": [2.5, 3.0, 3.5],       # acentos en cortes
  "taps": [14.45, 15.25],        # toques en pantalla
  "chimes": [18.75],             # confirmaciones / logros
  "risers": [[0, 1.0], [12, 14]],
  "whooshes": [4.5, 11, 14, 20, 25],
  "fade_out": [34.5, 38.6]
}
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

cue = json.load(open(sys.argv[1])); OUT = sys.argv[2]
SR = 44100
BPM = cue['bpm']; beat = 60 / BPM; bar = 4 * beat
DUR = cue['dur']; N = int(SR * (DUR + 1)); mix = np.zeros((N, 2))
rng = np.random.default_rng(cue.get('seed', 1))
ROOT = cue['root']; PROG = cue['prog']
SCALE = [0, 2, 4, 5, 7, 9, 11] if cue.get('mode', 'major') == 'major' else [0, 2, 3, 5, 7, 8, 10]
midi = lambda n: 440 * 2 ** ((n - 69) / 12)

def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x)

def add(sig, t0, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    a = max(0, -i); i = max(0, i); j = min(N, i + len(sig) - a)
    s = sig[a:a + (j - i)] * g
    mix[i:j, 0] += s * np.sqrt(0.5 * (1 - pan)); mix[i:j, 1] += s * np.sqrt(0.5 * (1 + pan))

def energy(t):
    for a, b, e in cue['sections']:
        if a <= t < b: return e
    return 0

def chord(t):
    k = int(t // bar) % len(PROG); r = ROOT + PROG[k]
    deg = SCALE.index(PROG[k] % 12) if PROG[k] % 12 in SCALE else 0
    third = ROOT + SCALE[(deg + 2) % 7] + 12 * ((deg + 2) // 7)
    fifth = ROOT + SCALE[(deg + 4) % 7] + 12 * ((deg + 4) // 7)
    return r, [r, third + (12 if third < r else 0), fifth + (12 if fifth < r else 0)]

def env(n, a, d, s=0.0, r=0.0):
    e = np.full(n, s, dtype=float); ai = max(1, int(a * SR)); di = max(1, int(d * SR))
    e[:ai] = np.linspace(0, 1, ai)[:n]
    if ai < n: e[ai:ai + di] = np.linspace(1, s, di)[:max(0, n - ai)]
    ri = int(r * SR)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e

def saw(f, n, det=0.0):
    t = np.arange(n) / SR; return 2 * ((f * (1 + det) * t) % 1) - 1

# ── Instrumentos ─────────────────────────────────────────────────────────────
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + 0.25 * filt(rng.normal(0, 1, n), 'high', 3000) * np.exp(-t * 90)

def clap():
    n = int(0.25 * SR); t = np.arange(n) / SR; x = filt(rng.normal(0, 1, n), 'band', [900, 3500])
    e = np.exp(-t * 22) + 0.6 * np.exp(-np.abs(t - 0.012) * 300) + 0.5 * np.exp(-np.abs(t - 0.024) * 300)
    return x * e * 0.6

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return filt(rng.normal(0, 1, n), 'high', 7000) * np.exp(-t * (18 if open_ else 70)) * 0.35

def pluck(m, ln=0.35):
    n = int(ln * SR); t = np.arange(n) / SR
    x = (saw(midi(m), n) + saw(midi(m), n, 0.004)) * 0.5
    x = filt(x, 'low', 2600) * np.exp(-t * 9)
    return x + 0.3 * np.sin(2 * np.pi * midi(m + 12) * t) * np.exp(-t * 14)

def pad(notes, ln):
    n = int(ln * SR); x = sum(saw(midi(m), n, d) for m in notes for d in (-0.004, 0.004)) / (2 * len(notes))
    return filt(x, 'low', 1400) * env(n, 0.25, 0.2, 0.85, 0.3)

def sub(m, ln):
    n = int(ln * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * midi(m) * t) + 0.25 * np.tanh(3 * np.sin(2 * np.pi * midi(m) * t))) * env(n, 0.01, 0.1, 0.8, 0.05)

def impact():
    n = int(1.6 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 10)) / SR) * np.exp(-t * 2.2)
    return boom + 0.5 * filt(rng.normal(0, 1, n), 'low', 1800) * np.exp(-t * 5)

def riser(d):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.normal(0, 1, n)
    out = np.zeros(n); seg = int(0.05 * SR)
    for i in range(0, n, seg):
        f = 400 + 7000 * (i / n) ** 2; out[i:i + seg] = filt(x[i:i + seg], 'band', [f * 0.7, f * 1.3])
    return out * (t / d) ** 2 * 0.5

def whoosh():
    n = int(0.5 * SR); x = filt(rng.normal(0, 1, n), 'band', [500, 4000]); return x * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.5

def tap():
    n = int(0.07 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 85)

def chime(base):
    n = int(1.6 * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for k, m in enumerate((base, base + 4, base + 7, base + 12)):
        i = int(k * 0.07 * SR); tt = t[:n - i]
        x[i:] += (np.sin(2 * np.pi * midi(m) * tt) + 0.3 * np.sin(2 * np.pi * midi(m) * 2.01 * tt)) * np.exp(-tt * 3.5)
    return x * 0.35

# ── Secuencia ────────────────────────────────────────────────────────────────
K = kick(); C = clap()
pump = np.ones(N)
nbeats = int(DUR / beat) + 1
for b in range(nbeats):
    t0 = b * beat; e = energy(t0); r, notes = chord(t0)
    if e >= 2 or (e == 1 and b % 2 == 0):
        add(K, t0, 0.9); i = int(t0 * SR); m = min(N, i + int(0.3 * SR))
        pump[i:m] = np.minimum(pump[i:m], 0.35 + 0.65 * np.linspace(0, 1, m - i) ** 0.6)
    if e >= 2 and b % 4 in (1, 3): add(C, t0, 0.55, 0.1)
    if e >= 2:
        add(hat(), t0 + beat / 2, 0.8, -0.3)
        if e >= 3: add(hat(), t0, 0.5, 0.3); add(hat(True), t0 + beat * 0.75, 0.35, 0.2)
    if e >= 1 and b % 4 == 0: add(sub(r - 24, bar * 0.98), t0, 0.5)
    if e >= 1:   # pluck en corcheas: arpegio del acorde
        for k in range(2):
            if e == 1 and k == 1: continue
            m = notes[(b * 2 + k) % 3] + 12 + (12 if e >= 3 and k == 1 else 0)
            add(pluck(m), t0 + k * beat / 2, 0.16 if e < 3 else 0.2, pan=-0.4 if k else 0.4)
for bb in range(int(DUR / bar) + 1):
    t0 = bb * bar; r, notes = chord(t0)
    add(pad(notes, bar + 0.3), t0, 0.32 if energy(t0) else 0.42)
mix *= pump[:, None] ** 0.7   # sidechain al bombo (más pegada)

for t0 in cue.get('impacts', []): add(impact(), t0, 0.8)
for t0 in cue.get('hits', []):
    r, notes = chord(t0); stab = sum(pluck(m + 12, 0.25) for m in notes) / 2; add(stab, t0, 0.35); add(K, t0, 0.6)
for a, b in cue.get('risers', []): add(riser(b - a), a, 0.7)
for t0 in cue.get('whooshes', []): add(whoosh(), t0 - 0.25, 0.5)
for t0 in cue.get('taps', []): add(tap(), t0, 0.45)
for t0 in cue.get('chimes', []): add(chime(ROOT + 24), t0, 0.5)

fo = cue.get('fade_out')
t = np.arange(N) / SR
if fo: mix *= np.clip((fo[1] - t) / (fo[1] - fo[0]), 0, 1)[:, None]
mix *= np.clip(t / 0.05, 0, 1)[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix = mix / (np.abs(mix).max() + 1e-9) * 0.89
sf.write(OUT, mix[:int(DUR * SR)], SR)
print('ok', OUT, f'{DUR:.1f}s', BPM, 'bpm')
