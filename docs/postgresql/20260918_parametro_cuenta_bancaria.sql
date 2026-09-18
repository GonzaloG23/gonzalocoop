-- Parámetro de control para cuentas bancarias de Cooperadoras.
-- El valor lo establece Auditoría.
-- Si el saldo actual del Libro es igual o superior a este monto y la
-- Cooperadora declara no poseer cuenta, la aplicación genera una alerta.

ALTER TABLE parametros_control
  ADD COLUMN IF NOT EXISTS saldo_minimo_cuenta_bancaria numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE parametros_control
  DROP CONSTRAINT IF EXISTS parametros_control_saldo_minimo_cuenta_bancaria_check;

ALTER TABLE parametros_control
  ADD CONSTRAINT parametros_control_saldo_minimo_cuenta_bancaria_check
  CHECK (saldo_minimo_cuenta_bancaria >= 0);
