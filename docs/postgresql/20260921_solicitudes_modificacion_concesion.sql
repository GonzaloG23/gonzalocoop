-- Pedidos de rectificación de datos de una concesión.
-- La Cooperadora solicita corregir valores o fechas ingresados incorrectamente.
-- Los datos vigentes no cambian hasta que Auditoría autoriza la solicitud.

CREATE TABLE IF NOT EXISTS concesion_solicitudes_modificacion (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cooperadora_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  solicitada_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  datos_actuales JSONB NOT NULL,
  datos_solicitados JSONB NOT NULL,
  motivo TEXT NOT NULL,

  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),

  resuelta_en TIMESTAMPTZ,
  resuelta_por_id TEXT,
  resuelta_por_nombre TEXT,
  comentario_resolucion TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_concesion_solicitud_modificacion_pendiente
  ON concesion_solicitudes_modificacion (cooperadora_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_concesion_solicitud_modificacion_cooperadora
  ON concesion_solicitudes_modificacion (cooperadora_id, solicitada_en DESC);

COMMENT ON TABLE concesion_solicitudes_modificacion IS
  'Pedidos de rectificación de datos y fechas de concesión realizados por la Cooperadora y sujetos a autorización de Auditoría.';
