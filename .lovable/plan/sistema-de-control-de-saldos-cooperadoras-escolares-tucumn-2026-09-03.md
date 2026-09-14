# Sistema de Control de Saldos — Cooperadoras Escolares (Tucumán)

Aplicación web para registrar y controlar los movimientos económicos de cada cooperadora escolar: saldo inicial, ingresos, egresos y saldo final, mes a mes, con cierre anual.

## Principio central: libro inalterable

Ningún movimiento se elimina ni se edita. Si hay un error, se registra un **ajuste contable** (movimiento de corrección) que queda vinculado al movimiento original. Todo queda con fecha, usuario y motivo. La auditoría siempre puede ver la historia completa.

## Usuarios y accesos

- **Cooperadora**: se registra con usuario y contraseña, carga sus propios movimientos, ve solo su institución.
- **Auditor (vos)**: ve todas las cooperadoras, sus planillas, reportes comparativos y alertas. No carga datos por ellas, pero puede revisar y observar.

## Pantallas

1. **Ingreso / registro** — login y creación de cuenta; alta de la cooperadora (nombre de escuela, CUE, localidad, CUIT, año de ejercicio).
2. **Panel de la cooperadora** — saldo actual, resumen del año en curso, meses pendientes de rendición, alertas propias.
3. **Libro mensual** — seleccionás mes: saldo inicial (heredado del mes anterior, no editable), lista de movimientos, totales de ingresos y egresos, saldo final calculado. Botón "Cerrar mes" que congela el período.
4. **Nuevo movimiento** — fecha, tipo (ingreso/egreso), rubro, concepto, monto, medio de pago, número de comprobante, observaciones.
5. **Ajuste contable** — desde un movimiento existente: se crea un movimiento de ajuste con motivo obligatorio; el original queda marcado como "ajustado" pero visible.
6. **Resumen anual** — los 12 meses en una tabla: saldo inicial, ingresos, egresos, saldo final, y el saldo anual final. Gráfico de evolución.
7. **Panel del auditor** — listado de todas las cooperadoras con saldo actual, estado de rendiciones y alertas; acceso al libro de cada una.
8. **Reportes y exportación** — planilla mensual y anual a Excel y PDF; comparativo entre cooperadoras (para el auditor).

## Alertas de control (automáticas)

- Saldo final negativo en un mes.
- Mes sin rendición (sin movimientos ni cierre) dentro del ejercicio.
- Saldo inicial que no coincide con el saldo final del mes anterior.
- Egreso sin número de comprobante.
- Movimiento con fecha fuera del mes al que se imputa.

## Rubros iniciales (editables)

Ingresos: cuota de cooperadora, donaciones, aportes del Estado, kiosco/cantina, eventos y rifas, otros.
Egresos: refacciones y mantenimiento, útiles y material didáctico, servicios, limpieza, equipamiento, gastos bancarios, otros.

## Detalles técnicos

- **Backend**: Lovable Cloud (base de datos, autenticación y funciones de servidor). Se activa como primer paso.
- **Tablas**: `cooperativas` (institución), `perfiles` (usuario ↔ cooperadora), `user_roles` (rol `auditor` / `cooperadora` en tabla separada, con función `has_role`), `rubros`, `periodos` (mes/año, saldo inicial, estado abierto/cerrado), `movimientos` (con `ajusta_movimiento_id`, `motivo_ajuste`, `creado_por`, `creado_en`).
- **Inalterabilidad**: sin políticas de DELETE ni UPDATE sobre `movimientos`; solo INSERT y SELECT. Los ajustes son inserciones nuevas. Períodos cerrados rechazan nuevas inserciones vía validación en el servidor.
- **Seguridad**: RLS en todas las tablas — cada cooperadora ve solo sus filas; el auditor lee todo mediante `has_role(auth.uid(), 'auditor')`. GRANTs explícitos por tabla.
- **Cálculos**: saldo final = saldo inicial + ingresos − egresos, calculado en base de datos (vista o función) para que nunca haya divergencia con lo cargado.
- **Exportación**: Excel y PDF generados en el cliente desde los datos ya cargados.
- **Idioma**: toda la interfaz en español, montos en pesos argentinos, fechas dd/mm/aaaa.

## Orden de construcción

1. Activar Lovable Cloud y crear el esquema con RLS, roles y rubros iniciales.
2. Autenticación + alta de cooperadora + roles.
3. Libro mensual: carga de movimientos y cálculo de saldos.
4. Ajustes contables y cierre de mes.
5. Resumen anual con gráfico.
6. Panel del auditor y alertas.
7. Exportación a Excel y PDF.
