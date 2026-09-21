-- Pedidos de reconsideración del canon de una concesión.
-- La Cooperadora solicita un nuevo importe y Auditoría lo autoriza o rechaza.
-- El canon vigente no se modifica mientras la solicitud permanezca pendiente.

CREATE TABLE IF NOT EXISTS concesion_solicitudes_reconsideracion_canon (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cooperadora_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  solicitada_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  tipo_canon TEXT NOT NULL
    CHECK (tipo_canon IN ('contrato', 'prorroga')),
  canon_actual NUMERIC(14,2) NOT NULL CHECK (canon_actual >= 0),
  canon_solicitado NUMERIC(14,2) NOT NULL CHECK (canon_solicitado >= 0),
  motivo TEXT NOT NULL,

  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),

  resuelta_en TIMESTAMPTZ,
  resuelta_por_id TEXT,
  resuelta_por_nombre TEXT,
  comentario_resolucion TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_concesion_solicitud_reconsideracion_canon_pendiente
  ON concesion_solicitudes_reconsideracion_canon (cooperadora_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_concesion_solicitud_reconsideracion_canon_cooperadora
  ON concesion_solicitudes_reconsideracion_canon (cooperadora_id, solicitada_en DESC);

COMMENT ON TABLE concesion_solicitudes_reconsideracion_canon IS
  'Pedidos de reconsideración del canon realizados por la Cooperadora y sujetos a autorización de Auditoría.';
