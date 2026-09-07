# Cuatro controles nuevos en las observaciones

Hoy el sistema detecta: saldo final negativo, saldo inicial declarado que no coincide, mes sin rendición y egresos sin comprobante. Se agregan cuatro controles más, con los mismos criterios de presentación (número rojo desplegable en el listado de auditoría y aviso dentro del libro del mes).

## Controles a agregar

1. **Mes cerrado fuera de plazo** — se compara la fecha de cierre del mes con un plazo configurable (por defecto, hasta el día 10 del mes siguiente). Si el cierre fue posterior, queda la observación con la cantidad de días de demora.
2. **Gasto que supera el tope** — cualquier egreso individual por encima de un monto configurable queda marcado, indicando el concepto y el importe.
3. **Comprobante repetido** — si dos o más movimientos de la misma cooperadora, dentro del mismo ejercicio, tienen el mismo número de comprobante, se avisa en los meses afectados. La comparación ignora mayúsculas y espacios.
4. **Ajustes contables del mes** — los meses que tienen correcciones por ajuste quedan destacados, con la cantidad de ajustes registrados.

## Parámetros configurables

Se agrega una pantalla simple de "Parámetros de control", visible solo para auditores, con dos valores:

- Día límite de cierre mensual (por defecto 10).
- Tope por gasto individual (por defecto un valor que definís vos; se propone $500.000, editable).

Los valores son provinciales (uno solo para todas las cooperadoras) y se aplican al recalcular las observaciones. Las cooperadoras los ven pero no los editan.

## Detalles técnicos

- Nueva tabla `parametros_control` (una sola fila): `dia_limite_cierre`, `tope_egreso`, con lectura para todos los autenticados y escritura solo para auditores mediante `has_role(auth.uid(), 'auditor')`; incluye GRANT a `authenticated` y `service_role`.
- `src/lib/libro.ts`: `cargarParametros()`, y `calcularEjercicio` pasa a recibir los parámetros y la lista completa de movimientos del ejercicio para detectar comprobantes repetidos. `ResumenMes.alertas` se mantiene como `string[]`, así el desplegable de auditoría y las exportaciones siguen funcionando sin cambios de forma.
- Cierre fuera de plazo: se usa `periodos.cerrado_en` contra el día límite del mes siguiente al período.
- Ajustes: se cuentan los movimientos con `ajusta_movimiento_id` no nulo.
- Nueva ruta `src/routes/_authenticated/parametros.tsx` + enlace en `AppShell` solo para auditores.
- Se ajusta `LibroMensual` y `anual.tsx` para pasar los parámetros al cálculo, y se verifica con `bunx tsgo --noEmit`.
