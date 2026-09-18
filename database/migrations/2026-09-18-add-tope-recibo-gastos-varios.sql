-- Control de Recibos de Gastos Varios para Auditoría.
-- 0 = control de monto por recibo desactivado.
-- Se aplica sobre la tabla institucional parametros_control.

ALTER TABLE parametros_control
  ADD COLUMN IF NOT EXISTS tope_recibo_gastos_varios NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN parametros_control.tope_recibo_gastos_varios IS
  'Monto máximo autorizado por cada Recibo de Gastos Varios. El valor 0 desactiva el control de monto.';
