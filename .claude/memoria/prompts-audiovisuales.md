# Estándar de prompts audiovisuales

Pedido de Benja (25-oct-2026). Todo prompt, brief o instrucción de animación, video, reel, motion, imagen generada o cualquier pieza audiovisual se escribe con este nivel de redacción y razonamiento. Vale tanto para prompts que se entregan a otra herramienta (Higgsfield, generadores de imagen y video, ElevenLabs) como para las instrucciones que Claude se da a sí mismo antes de producir.

Referencia: el prompt del anuncio conceptual de Duolingo ("The Path"), en `CONTENIDO/referencias/prompt-video-duolingo.pdf` (local, no versionado). Se toma su **forma de pensar y escribir**, no su contenido.

## Cómo escribe un prompt de este nivel

- **Imperativo, preciso y en frases cortas.** Una decisión por línea. Nada de relleno ni adjetivos vacíos.
- **Todo con número cuando se puede:** duración exacta, fps, resolución, hex, BPM, tonalidad, timecodes, LUFS, dBTP.
- **Cada decisión dice para qué existe.** Cada escena declara su objetivo emocional.
- **Dice lo que no se acepta.** Prohibiciones explícitas: efectos genéricos, transiciones por defecto, movimientos sin intención, apariciones por opacidad.
- **Una idea extraordinariamente clara** sostiene toda la complejidad. La complejidad está al servicio de la idea, nunca al revés.
- **Una vara de calidad explícita:** referencias de excelencia (adoptar su estándar de ejecución, nunca copiar escenas) y la pregunta que debe provocar en el espectador ("¿cómo hicieron esto?").
- **Honestidad técnica:** no fingir herramientas que no están disponibles; documentar la limitación y usar la mejor alternativa real. No declarar nada validado sin haber inspeccionado los archivos y fotogramas.
- **Reglas de desempate** para cuando dos criterios chocan (claridad > espectáculo, personalidad > corrección técnica, eliminar lo llamativo pero genérico).

## Estructura (se usa completa en piezas grandes y se resume en piezas chicas, sin saltarse el razonamiento)

0. **Directiva principal.** El equipo que se simula (roles concretos: director creativo, DF, animación, sonido, colorista…), la vara de calidad, la misión en una frase y lo que no se acepta.
1. **Estándar de calidad.** 3 a 5 cualidades que debe combinar la pieza + referencias de excelencia.
2. **Especificaciones no negociables.** Duración, fps, formatos (horizontal y vertical), pipeline reproducible, herramientas reales disponibles y calidad interna (antialiasing, ruido, banding, negros).
3. **Dirección de arte.** El concepto en una imagen ("la interfaz deja de estar en una pantalla y se vuelve un mundo físico"), el ambiente con valores exactos, qué evitar y los materiales objeto por objeto.
4. **Iluminación.** Key, fill, rim, prácticas y rebotes; cómo responde la luz a la historia y sus restricciones.
5. **Cámara.** Trayectoria (y por qué), cómo se justifica cada cambio de escena, curvas y aceleraciones. Los 6 puntos de cada movimiento: motivación, inicio compuesto, trayectoria interesante, aceleración expresiva, aterrizaje preciso, conexión con lo siguiente. Alternar energía explosiva, fluida y contemplativa.
6. **Animación.** Principios (anticipación, squash and stretch, inercia, superposición, rebotes amortiguados), la regla del movimiento (nada importante aparece o desaparece solo por opacidad), microanimaciones y la regla de que no todo rebota igual: depende del material, el peso y la función.
7. **Protagonista.** Personaje, producto o persona: qué debe transmitir y cómo se anima para que se sienta vivo.
8. **Guion visual escena por escena,** con timecode de entrada y salida, acción concreta, texto en pantalla y **objetivo emocional**.
9. **Locución.** Perfil de voz, guion, dirección de la interpretación y anclas de sincronía con timecode.
10. **Música.** BPM, tonalidad, instrumentación, dirección y los momentos exactos en que cambia la energía.
11. **Diseño sonoro.** Categorías de efectos, jerarquía (lo importante destaca porque lo secundario es discreto) y mezcla con números (voz sobre música, LUFS integrados, pico real).
12. **Composición y acabado.** Corrección de color y tratamiento final, más la lista de prohibiciones.
13. **Adaptación vertical real:** se recompone, no se recorta.
14. **Control de calidad.** Técnico (comprobaciones automáticas) y artístico: composición, movimiento, iluminación, narrativa y satisfacción, cada uno con nota de 1 a 10. Bajo 9 se revisa. Se registran los defectos reales; nada autocomplaciente.
15. **Pipeline por etapas:** preproducción → audio → construcción → animación → acabado → validación.
16. **Entregables** concretos.
17. **Reglas absolutas.**
18. **Prueba definitiva:** preguntas de sí o no ("¿los primeros 0,5 s detienen la atención?", "¿se entiende desde un teléfono?"). Si alguna da no, se corrige.
19. **Instrucción final.** Prioridades en orden (lo que más percibe el espectador) y reglas de desempate.

## Adaptación a HORIZON
- La identidad sale de `naming.md` (tokens, degradado, tipografías, sprite de íconos) y de `contenido.md` (voz, modos, reglas de video).
- La música es original con `scripts/reel-musica.py`; las texturas de cámara, con `scripts/reel-texturas.py`.
- Locución y textos en **tuteo chileno**, nunca voseo (el prompt de referencia está en voseo rioplatense: eso no se copia).
- Solo datos reales; lo ilustrativo se marca como ejemplo.
- Antes de prometer render 3D, motor o voz sintética, verificar qué está disponible en la sesión (hoy no hay Blender instalado) y decirlo.

## Lecciones aprendidas
- **Una pieza, un tema** (26-oct-2026). Benja descartó una versión que sumaba el caso Fitt (pantallas del prototipo y fusión de paletas HORIZON × Fitt) a la animación "La línea del horizonte". Se sintió como dos videos pegados. Prefirió la original: un solo tema, fluida, directo al grano y más dirigida al espectador. Si un caso o una segunda marca no cabe dentro de la idea central sin cambiar el tema, va en **otra pieza**, no se fusiona.
