# Estructura — Contrato de prestación de servicios + Anexo A

> Plantilla base. **Antes de usarla con clientes reales, hacela revisar una vez por un abogado.**
> Se usa literal: solo se reemplazan las variables `{{…}}`. Cada cláusula va como `<h2><span class="n">N.</span>TÍTULO</h2>` + párrafos.

- Título: `Contrato de Prestación de Servicios`
- Subtítulo: `Implementación {{PLAN_NOMBRE}} — {{CLIENTE_NOMBRE_FANTASIA}}`
- Código: `HZ-{{AAAA}}-{{slug}}-CON`

---

**Comparecencia.** En Rancagua, a {{FECHA_LARGA}}, comparecen: por una parte, **{{PRESTADOR_NOMBRE}}**, RUT {{PRESTADOR_RUT}}, con domicilio en {{PRESTADOR_DOMICILIO}}, que opera bajo el nombre comercial HORIZON, en adelante "el Prestador"; y por la otra, **{{CLIENTE_RAZON_SOCIAL}}**, RUT {{CLIENTE_RUT}}, representada por {{CLIENTE_REPRESENTANTE}}, RUT {{CLIENTE_REPRESENTANTE_RUT}}, ambos con domicilio en {{CLIENTE_DOMICILIO}}, comuna de {{CLIENTE_COMUNA}}, en adelante "el Cliente". Las partes acuerdan el siguiente contrato:

**1. Objeto.** El Prestador se obliga a diseñar, construir, configurar y entregar funcionando el {{PLAN_NOMBRE}} para el negocio del Cliente, según el alcance detallado en el Anexo A, que forma parte integrante de este contrato.

**2. Alcance.** Los servicios comprenden exclusivamente lo indicado en el Anexo A. Todo trabajo no incluido en él se considera adicional y se cotizará por separado antes de realizarse. Lo que el Anexo A señala como "No incluido" no forma parte de este contrato.

**3. Plazo de implementación.** El plazo estimado es de {{PLAZO}} contadas desde la reunión de inicio (kickoff), que se realizará una vez recibido el pago inicial y los insumos indicados en la Orden de Inicio. Si el Cliente entrega insumos, accesos o aprobaciones fuera del plazo de {{PLAZO_CLIENTE}}, el plazo de entrega se extenderá en los mismos días de atraso.

**4. Precio y forma de pago.** El precio de la implementación es de **{{MONTO_IMPLEMENTACION}} ({{MONTO_EN_PALABRAS}} pesos)**, {{NOTA_BOLETA}}. Se pagará de la siguiente forma: {{FORMA_DE_PAGO}}. Los pagos se realizarán por transferencia bancaria a la cuenta que el Prestador indique por escrito. El Prestador emitirá boleta de honorarios por cada pago recibido.

**5. Soporte mensual.** El primer mes de soporte posterior a la entrega está incluido en el precio. Desde el segundo mes, el Cliente podrá contratar el soporte {{SOPORTE_NOMBRE}} por **{{MONTO_SOPORTE}} mensuales**, pagaderos {{PAGO_SOPORTE}}. El soporte es mes a mes y sin permanencia: cualquiera de las partes puede ponerle término avisando por escrito con {{AVISO_TERMINO}} de anticipación al siguiente período.

**6. Revisiones y aprobaciones.** El diseño se presentará al Cliente para su aprobación antes de construirse. Se incluyen {{RONDAS_REVISION}} de cambios sobre el diseño. Las aprobaciones podrán darse por correo electrónico o WhatsApp y se entenderán definitivas. Los cambios posteriores a una aprobación o que excedan las rondas incluidas se cotizarán aparte.

**7. Obligaciones del Cliente.** El Cliente se obliga a: (a) entregar oportunamente la información, contenidos, imágenes y accesos necesarios; (b) designar una persona de contacto con facultades para aprobar; (c) pagar el precio en la forma convenida; y (d) garantizar que los contenidos que entrega no infringen derechos de terceros.

**8. Servicios y costos de terceros.** El dominio, el hosting y las cuentas en plataformas de terceros (Google, Meta, WhatsApp Business API, proveedores de inteligencia artificial u otros) quedarán a nombre del Cliente y sus costos serán de su cargo, salvo que el Anexo A indique otra cosa. La inversión en publicidad se paga directamente a la plataforma correspondiente. El Prestador no responde por cambios, caídas o políticas de dichas plataformas.

**9. Propiedad y uso.** Pagado íntegramente el precio, el Cliente será dueño del sitio, los contenidos y las configuraciones entregadas para su negocio. El Prestador conserva la propiedad de sus metodologías, plantillas, componentes y herramientas reutilizables, y otorga al Cliente una licencia de uso indefinida sobre aquellos incorporados en la entrega. {{CLAUSULA_CASO}}

**10. Confidencialidad y datos personales.** Las partes mantendrán reserva sobre la información comercial de la otra a la que accedan con motivo de este contrato. El Prestador tratará los datos personales de clientes del Cliente solo para prestar los servicios contratados y conforme a la Ley N° 19.628 sobre protección de la vida privada y sus modificaciones.

**11. Garantía.** El Prestador corregirá sin costo los errores de funcionamiento atribuibles a su trabajo que se reporten dentro de los 30 días siguientes a la entrega.

**12. Resultados.** El Prestador se obliga a entregar los servicios descritos con diligencia profesional. Las ventas, el posicionamiento en buscadores o el rendimiento de campañas dependen también de factores ajenos al Prestador, por lo que no se garantizan resultados comerciales específicos.

**13. Término anticipado.** Si el Cliente pone término al contrato antes de la entrega, {{TERMINO_ANTICIPADO}}. Cualquiera de las partes podrá terminarlo si la otra incumple gravemente sus obligaciones y no lo corrige dentro de 10 días desde que se le notifique por escrito.

**14. Domicilio y firma.** Para todos los efectos de este contrato, las partes fijan su domicilio en la ciudad de Rancagua y se someten a la competencia de sus tribunales. Este contrato podrá firmarse en papel, en dos ejemplares, o mediante firma electrónica simple conforme a la Ley N° 19.799, con igual valor.

**Firmas:** bloque `.firmas` con Prestador (nombre, RUT) y Cliente (razón social, representante, RUT).

---

## Variables que salen de `condiciones.md`
| Variable | Fuente |
|---|---|
| `{{NOTA_BOLETA}}` | "monto líquido; el impuesto de la boleta de honorarios es adicional" **o** "monto bruto, con boleta de honorarios", según lo definido |
| `{{FORMA_DE_PAGO}}`, `{{PAGO_SOPORTE}}`, `{{AVISO_TERMINO}}`, `{{RONDAS_REVISION}}`, `{{PLAZO_CLIENTE}}`, `{{TERMINO_ANTICIPADO}}` | Condiciones por defecto o lo pactado en la ficha |
| `{{CLAUSULA_CASO}}` | Fundadores: "Conforme al Programa Fundadores, el Cliente autoriza al Prestador a mostrar el proyecto como caso de estudio y se compromete a entregar un testimonio en video." · Resto: "El Prestador podrá mostrar el proyecto en su portafolio solo con autorización escrita del Cliente." |

## Anexo A — Alcance (página nueva, `<h2>` "Anexo A — Alcance del servicio")
1. **Plan contratado** y plazo.
2. **Incluye:** tabla copiada de "Qué incluye" de `Pages/plan-0N.html` (entregable · detalle).
3. **Sistema elegido** (Plan 02/03): reservas, tienda o caja + inventario.
4. **No incluye:** texto de "No incluye" de la misma página.
5. **Ítems adicionales** pactados en la ficha, con su monto.
6. **Programa Fundadores** (si aplica): beneficios y compromisos.
7. Firmas abreviadas (iniciales de ambas partes).
