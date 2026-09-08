# Bloquear egresos sin saldo disponible

Una cooperadora no podrá registrar un egreso cuando el saldo acumulado a la fecha del movimiento sea cero o negativo, ni cuando el importe del egreso deje ese saldo en negativo. La regla vale para todos los usuarios, incluido el auditor.

## Cómo se calcula el saldo disponible

Saldo inicial del ejercicio + ingresos − egresos, contando todos los movimientos con fecha anterior o igual a la fecha del egreso que se quiere cargar. Los ajustes contables se cuentan como cualquier otro movimiento según su tipo.

## Qué cambia para la cooperadora

- Al registrar un egreso, si no hay saldo disponible aparece un aviso claro: "No hay saldo disponible a esa fecha: el saldo es $X" y el movimiento no se guarda.
- Si el importe supera el saldo disponible, el aviso indica el saldo disponible y el faltante, y tampoco se guarda.
- El formulario muestra, junto al importe, el saldo disponible a la fecha elegida, para que se vea antes de intentar guardar.
- Los ingresos no tienen ninguna restricción nueva.

## Detalle técnico

1. Migración: ampliar `public.validar_movimiento()` para que, cuando `NEW.tipo = 'egreso'`, calcule
   `saldo = cooperadoras.saldo_inicial_ejercicio + SUM(ingresos) - SUM(egresos)` sobre `movimientos` de la misma cooperadora con `fecha <= NEW.fecha` (excluyendo el registro nuevo), y levante excepción si `saldo <= 0` o si `NEW.monto > saldo`. Los mensajes de error se redactan en español para mostrarlos directamente al usuario. Sin cambios de RLS ni de permisos.
2. `src/components/LibroMensual.tsx`: en el formulario de movimiento, calcular el saldo disponible a la fecha con los movimientos ya cargados del ejercicio, mostrarlo como ayuda cuando el tipo es egreso, deshabilitar el guardado cuando no alcanza y mostrar el mensaje del servidor con `toast` si la validación falla del lado de la base.
3. Sin cambios en `src/lib/libro.ts` (las observaciones y el arrastre de saldos siguen igual).
