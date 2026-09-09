# Datos del proveedor en los egresos

Cuando una cooperadora registra un egreso, el formulario pedirá además los datos del proveedor.

## Campos nuevos (solo egresos)

- Nº Comprobante (ya existe; pasa a ser obligatorio en egresos)
- CUIT del proveedor (11 dígitos, con validación de formato)
- Razón Social / Nombre del comercio (obligatorio)
- Tipo de factura: B, C o Ticket factura (lista de opciones)

En los ingresos el formulario queda igual que hoy.

## Dónde se ven

- Formulario de registro: bloque "Datos del proveedor" que aparece al elegir Egreso.
- Listado del mes: se muestra la razón social y el tipo de factura junto al comprobante.
- Vista del auditor: los mismos datos, en modo lectura.
- Exportaciones a PDF y Excel: se agregan las columnas CUIT, Razón Social y Tipo de factura.

## Detalles técnicos

- Migración: agregar a `movimientos` las columnas `proveedor_cuit text`, `proveedor_razon_social text` y `tipo_factura text` (permitidas: `B`, `C`, `ticket`), todas nulas para no afectar los movimientos ya registrados.
- Validación en el cliente dentro de `LibroMensual` (CUIT de 11 dígitos, razón social y tipo de factura requeridos cuando `tipo = 'egreso'`).
- Validación en base mediante ampliación del trigger `validar_movimiento`: si el tipo es egreso, exigir comprobante, CUIT, razón social y tipo de factura válidos.
- Actualizar el tipo `Movimiento` en `src/lib/libro.ts` y las salidas de `src/lib/exportar.ts`.
- El control de comprobantes repetidos existente sigue funcionando sin cambios.
