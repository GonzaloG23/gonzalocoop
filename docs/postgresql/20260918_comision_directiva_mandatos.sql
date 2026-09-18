-- Estructura para vigencia, reelecciones e historial de la Comisión Directiva.
-- La API del Ministerio debe validar estas reglas también en servidor:
-- 1) cada mandato dura 2 años;
-- 2) una persona puede integrar hasta 2 períodos;
-- 3) después de dos períodos, su DNI no puede volver a registrarse en una nueva conformación.

CREATE TABLE IF NOT EXISTS comision_directiva (
  cooperadora_id TEXT PRIMARY KEY,
  fecha_inicio_mandato DATE,
  fecha_fin_mandato DATE,
  numero_periodo INTEGER NOT NULL DEFAULT 1 CHECK (numero_periodo >= 1),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por_id TEXT,
  actualizado_por_nombre TEXT,
  actualizado_por_email TEXT
);

CREATE TABLE IF NOT EXISTS comision_directiva_miembros (
  cooperadora_id TEXT NOT NULL REFERENCES comision_directiva(cooperadora_id) ON DELETE CASCADE,
  cargo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  dni VARCHAR(8),
  PRIMARY KEY (cooperadora_id, cargo)
);

CREATE TABLE IF NOT EXISTS comision_directiva_historial (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cooperadora_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('modificacion', 'mandato')),
  fecha_inicio_mandato DATE,
  fecha_fin_mandato DATE,
  numero_periodo INTEGER NOT NULL DEFAULT 1 CHECK (numero_periodo >= 1),
  usuario_id TEXT NOT NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  modificado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comision_directiva_historial_miembros (
  historial_id BIGINT NOT NULL REFERENCES comision_directiva_historial(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  dni VARCHAR(8),
  PRIMARY KEY (historial_id, cargo)
);

CREATE INDEX IF NOT EXISTS idx_comision_directiva_historial_cooperadora
  ON comision_directiva_historial (cooperadora_id, modificado_en DESC);

CREATE INDEX IF NOT EXISTS idx_comision_directiva_historial_miembros_dni
  ON comision_directiva_historial_miembros (dni);

COMMENT ON TABLE comision_directiva IS
  'Estado actual de la Comisión Directiva y vigencia del mandato.';

COMMENT ON TABLE comision_directiva_historial IS
  'Historial de modificaciones y períodos de mandato para trazabilidad y control de reelecciones.';
