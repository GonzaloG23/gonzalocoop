-- Registro persistente del aviso de apertura de cuenta bancaria.
-- La fecha de vencimiento se fija al momento de la primera notificación
-- y no debe recalcularse en cada acceso de la escuela.

CREATE TABLE IF NOT EXISTS aperturas_cuentas_bancarias (
  id uuid PRIMARY KEY,
  cooperadora_id uuid NOT NULL UNIQUE,
  fecha_notificacion date NOT NULL,
  fecha_vencimiento date NOT NULL,
  motivos text[] NOT NULL,
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_vencimiento >= fecha_notificacion)
);

CREATE INDEX IF NOT EXISTS idx_aperturas_cuentas_bancarias_cooperadora
  ON aperturas_cuentas_bancarias(cooperadora_id);

-- El backend debe conservar la fecha de notificación y vencimiento.
-- La aplicación muestra una alerta a la Cooperadora mientras la cuenta
-- no esté declarada como abierta y registra la misma situación para Auditoría.
