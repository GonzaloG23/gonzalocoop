-- Solicitudes de modificación del mandato de la Comisión Directiva.
-- La solicitud la genera la Cooperadora y permanece pendiente hasta que
-- un auditor la apruebe o rechace.

CREATE TABLE IF NOT EXISTS comision_directiva_solicitudes_mandato (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cooperadora_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  solicitada_en TIMESTAMPTZ NOT NULL DEFAULT now(),

  numero_periodo_actual INTEGER NOT NULL,
  numero_periodo_solicitado INTEGER NOT NULL CHECK (numero_periodo_solicitado BETWEEN 1 AND 2),
  fecha_inicio_actual DATE,
  fecha_inicio_solicitada DATE NOT NULL,
  fecha_fin_actual DATE,
  fecha_fin_solicitada DATE NOT NULL,

  motivo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),

  resuelta_en TIMESTAMPTZ,
  resuelta_por_id TEXT,
  resuelta_por_nombre TEXT,
  comentario_resolucion TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comision_solicitud_mandato_pendiente
  ON comision_directiva_solicitudes_mandato (cooperadora_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_comision_solicitud_mandato_cooperadora
  ON comision_directiva_solicitudes_mandato (cooperadora_id, solicitada_en DESC);

COMMENT ON TABLE comision_directiva_solicitudes_mandato IS
  'Solicitudes de la Cooperadora para modificar período o fecha de mandato, pendientes de autorización de Auditoría.';
