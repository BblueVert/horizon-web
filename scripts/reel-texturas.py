#!/usr/bin/env python3
"""Texturas de grabación para reels e historias HORIZON, aplicadas en edición a videos grabados con celular.

Benja graba solo con el celular; las texturas del sistema de contenido (cinematográfica, espontánea,
digital de los 2000 y analógica) se logran aquí, sin apps de edición. Salida vertical 1080×1920, 30 fps, H.264 + AAC.

Uso:  python3 scripts/reel-texturas.py <textura> entrada.mp4 salida.mp4 [opciones]
  texturas: cine | espontanea | digicam | analogo
  --desde 3.5 --hasta 12      recorta el clip (segundos)
  --lenta 0.5                 cámara lenta (velocidad; quita el audio, pensado para planos de detalle)
  --fecha "25 10 '26"         texto de la fecha en digicam (por defecto, la fecha de hoy)
  --marco                     en digicam y analogo: ventana 3:4 sobre fondo tinta, en vez de pantalla completa
Requiere: ffmpeg con drawtext (libfreetype).
"""
import argparse, datetime, os, shutil, subprocess, sys

W, H = 1080, 1920
TINTA = '0x1A1626'

ap = argparse.ArgumentParser()
ap.add_argument('textura', choices=['cine', 'espontanea', 'digicam', 'analogo'])
ap.add_argument('entrada'); ap.add_argument('salida')
ap.add_argument('--desde', type=float); ap.add_argument('--hasta', type=float)
ap.add_argument('--lenta', type=float)
ap.add_argument('--fecha'); ap.add_argument('--marco', action='store_true')
ap.add_argument('--fuente', default='/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf')
a = ap.parse_args()

if not shutil.which('ffmpeg'):
    sys.exit('Falta ffmpeg')

# Encuadre vertical a pantalla completa (recorta lo que sobre, sin bandas)
def llenar(w, h):
    return f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1'

# Ventana 3:4 centrada sobre fondo tinta (el "formato foto" de digicam y rollo)
def enmarcar(cadena):
    return f'{llenar(960, 1280)},{cadena},pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={TINTA}'

fecha = a.fecha or datetime.date.today().strftime("%d %m '%y")

if a.textura == 'cine':
    # Altas luces suaves, sombras levemente frías y piel cálida, viñeta y grano casi invisible
    v = (f'{llenar(W, H)},'
         "curves=all='0/0.03 0.25/0.22 0.75/0.78 1/0.95',"
         'colorbalance=rs=-0.03:bs=0.04:rh=0.05:gh=0.01:bh=-0.04,'
         'eq=contrast=1.05:saturation=0.92,vignette=PI/6,noise=alls=3:allf=t')
elif a.textura == 'espontanea':
    # Tal cual: solo encuadre y frecuencia
    v = llenar(W, H)
elif a.textura == 'digicam':
    # Baja resolución + sobre-nitidez (sensor chico de los 2000), colores lavados, flash y fecha naranja
    base = ('scale=480:-2,unsharp=5:5:1.4,scale=iw*2:ih*2:flags=bilinear,'
            'eq=contrast=1.12:brightness=0.03:saturation=0.82:gamma=1.05,'
            'colorbalance=bh=0.03:rm=0.02,chromashift=cbh=2:crh=-2,noise=alls=9:allf=t')
    fecha_txt = fecha.replace("'", '’').replace(':', r'\:')
    sello = (f"drawtext=fontfile={a.fuente}:text='{fecha_txt}':fontcolor=0xFF8A1E:fontsize={{fs}}:"
             'x=w-tw-{m}:y=h-th-{m}:shadowcolor=0xFF4A00@0.55:shadowx=0:shadowy=0:borderw=1:bordercolor=0xFF6A00@0.4')
    if a.marco:
        v = enmarcar(f'{base},scale=960:1280,' + sello.format(fs=44, m=40))
    else:
        v = f'{llenar(W, H)},{base},scale={W}:{H},' + sello.format(fs=52, m=64)
elif a.textura == 'analogo':
    # Negros apagados, tono cálido, grano de rollo, parpadeo, leve vaivén del cuadro y viñeta fuerte
    base = ("curves=all='0/0.09 0.5/0.52 1/0.93':r='0/0.1 1/0.97':b='0/0.06 1/0.86',"
            'eq=saturation=0.86:contrast=1.04:brightness=0.01:eval=frame,'
            "eq=brightness='0.018*(random(1)-0.5)':eval=frame,"
            'gblur=sigma=0.6,noise=alls=20:allf=t+u,vignette=PI/4.2')
    temblor = "crop=iw-16:ih-16:'8+3*sin(t*5.1)':'8+3*sin(t*3.7+1)'"
    if a.marco:
        v = enmarcar(f'{base},{temblor},scale=960:1280')
    else:
        v = f'{llenar(W + 16, H + 16)},{base},{temblor}'

v += ',fps=30,format=yuv420p'
if a.lenta:
    v = f'setpts=PTS/{a.lenta},' + v

cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error']
if a.desde is not None:
    cmd += ['-ss', str(a.desde)]
if a.hasta is not None:
    cmd += ['-to', str(a.hasta)]
cmd += ['-i', a.entrada]

if a.textura == 'analogo':
    # Destello de luz cálido que se mueve lento, mezclado en modo pantalla
    cmd += ['-f', 'lavfi', '-i', f'gradients=s={W}x{H}:c0=0xFF7A2A:c1=0x000000:x0=0:y0=0:x1={W}:y1={H // 2}:speed=0.008:type=radial:r=30']
    # La mezcla va en RGB: en YUV el modo pantalla tiñe todo de morado
    filtro = (f'[0:v]{v},format=gbrp[b];[1:v]format=gbrp,gblur=sigma=40[l];'
              '[b][l]blend=all_mode=screen:all_opacity=0.22:shortest=1,format=yuv420p[v]')
    cmd += ['-filter_complex', filtro, '-map', '[v]']
else:
    cmd += ['-vf', v, '-map', '0:v']

if a.lenta:
    cmd += ['-an']
else:
    cmd += ['-map', '0:a?', '-c:a', 'aac', '-b:a', '192k']
cmd += ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', a.salida]

subprocess.run(cmd, check=True)
print(f'Listo: {a.salida} ({a.textura})')
