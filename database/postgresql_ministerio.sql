-- gonzalocoop - esquema PostgreSQL portable
-- Destino: PostgreSQL administrado por el Ministerio.
-- Este archivo NO modifica Supabase y no debe ejecutarse sobre producción actual.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE app_role AS ENUM ('auditor', 'cooperadora');
CREATE TYPE tipo_movimiento AS ENUM ('ingreso', 'egreso');

-- Usuarios institucionales.
-- La autenticación real puede venir de LDAP/AD/SSO, un IdP institucional
-- o un mecanismo propio. Esta tabla conserva el identificador interno.
CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  externo_id text UNIQUE,
  email text NOT NULL UNIQUE,
  nombre text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cooperadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  cue text,
  cuit text,
  localidad text,
  ejercicio integer NOT NULL,
  saldo_inicial_ejercicio numeric(14,2) NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE perfiles (
  id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  email text,
  cooperadora_id uuid REFERENCES cooperadoras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, role)
);

CREATE TABLE rubros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperadora_id uuid REFERENCES cooperadoras(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo tipo_movimiento NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperadora_id uuid NOT NULL REFERENCES cooperadoras(id) ON DELETE CASCADE,
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  saldo_inicial_declarado numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),
  cerrado_en timestamptz,
  cerrado_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cooperadora_id, anio, mes)
);

-- Libro inalterable: no se contempla UPDATE/DELETE como operación normal.
CREATE TABLE movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperadora_id uuid NOT NULL REFERENCES cooperadoras(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo tipo_movimiento NOT NULL,
  rubro_id uuid REFERENCES rubros(id),
  concepto text NOT NULL,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  medio_pago text,
  comprobante text,
  proveedor_cuit text,
  proveedor_razon_social text,
  tipo_factura text,
  observaciones text,
  ajusta_movimiento_id uuid REFERENCES movimientos(id),
  motivo_ajuste text,
  creado_por uuid NOT NULL REFERENCES usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ajuste_con_motivo CHECK (
    ajusta_movimiento_id IS NULL OR
    (motivo_ajuste IS NOT NULL AND length(btrim(motivo_ajuste)) > 0)
  ),
  CONSTRAINT factura_valida CHECK (
    tipo_factura IS NULL OR tipo_factura IN ('B','C','ticket')
  )
);

CREATE TABLE parametros_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_limite_cierre integer NOT NULL DEFAULT 10 CHECK (dia_limite_cierre BETWEEN 1 AND 31),
  tope_egreso numeric(14,2) NOT NULL DEFAULT 500000 CHECK (tope_egreso >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auditoría institucional adicional. Los movimientos ya tienen su propia
-- trazabilidad; esta tabla registra acciones de seguridad y administración.
CREATE TABLE auditoria_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  cooperadora_id uuid REFERENCES cooperadoras(id),
  accion text NOT NULL,
  entidad text,
  entidad_id uuid,
  detalle jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text
);

CREATE INDEX idx_perfiles_cooperadora ON perfiles(cooperadora_id);
CREATE INDEX idx_roles_usuario ON usuario_roles(usuario_id);
CREATE INDEX idx_periodos_cooperadora ON periodos(cooperadora_id, anio, mes);
CREATE INDEX idx_movimientos_periodo ON movimientos(periodo_id);
CREATE INDEX idx_movimientos_cooperadora_fecha ON movimientos(cooperadora_id, fecha);
CREATE INDEX idx_movimientos_comprobante ON movimientos(comprobante);
CREATE INDEX idx_auditoria_usuario_fecha ON auditoria_eventos(usuario_id, creado_en);
CREATE INDEX idx_auditoria_cooperadora_fecha ON auditoria_eventos(cooperadora_id, creado_en);

-- Evita que un movimiento apunte a un período de otra cooperadora y evita
-- fechas fuera del mes declarado. La validación de saldo se hará en una
-- transacción del backend y/o trigger PostgreSQL.
CREATE OR REPLACE FUNCTION validar_movimiento_ministerio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE p periodos%ROWTYPE;
BEGIN
  SELECT * INTO p FROM periodos WHERE id = NEW.periodo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Periodo inexistente'; END IF;
  IF p.estado = 'cerrado' THEN RAISE EXCEPTION 'El período está cerrado'; END IF;
  IF p.cooperadora_id <> NEW.cooperadora_id THEN RAISE EXCEPTION 'El período no pertenece a la cooperadora'; END IF;
  IF EXTRACT(YEAR FROM NEW.fecha)::integer <> p.anio
     OR EXTRACT(MONTH FROM NEW.fecha)::integer <> p.mes THEN
    RAISE EXCEPTION 'La fecha del movimiento no corresponde al período';
  END IF;
  IF NEW.tipo = 'egreso' THEN
    IF NULLIF(btrim(NEW.comprobante), '') IS NULL THEN RAISE EXCEPTION 'El egreso requiere comprobante'; END IF;
    IF NULLIF(regexp_replace(COALESCE(NEW.proveedor_cuit,''), '[^0-9]', '', 'g'), '') IS NULL
       OR length(regexp_replace(NEW.proveedor_cuit, '[^0-9]', '', 'g')) <> 11 THEN
      RAISE EXCEPTION 'El egreso requiere CUIT de proveedor válido';
    END IF;
    IF NULLIF(btrim(NEW.proveedor_razon_social), '') IS NULL THEN RAISE EXCEPTION 'El egreso requiere proveedor'; END IF;
    IF NEW.tipo_factura NOT IN ('B','C','ticket') THEN RAISE EXCEPTION 'Tipo de factura inválido'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_movimiento_ministerio
BEFORE INSERT ON movimientos
FOR EACH ROW EXECUTE FUNCTION validar_movimiento_ministerio();

-- Los cierres registran automáticamente quién y cuándo cerró.
CREATE OR REPLACE FUNCTION registrar_cierre_ministerio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El período ya está cerrado y no puede modificarse';
  END IF;
  IF NEW.estado = 'cerrado' THEN
    IF NEW.cerrado_en IS NULL THEN NEW.cerrado_en := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registrar_cierre_ministerio
BEFORE UPDATE ON periodos
FOR EACH ROW EXECUTE FUNCTION registrar_cierre_ministerio();

INSERT INTO parametros_control (dia_limite_cierre, tope_egreso)
VALUES (10, 500000);

INSERT INTO rubros (cooperadora_id, nombre, tipo) VALUES
(NULL, 'Cuota de cooperadora', 'ingreso'),
(NULL, 'Donaciones', 'ingreso'),
(NULL, 'Aportes del Estado', 'ingreso'),
(NULL, 'Kiosco / cantina', 'ingreso'),
(NULL, 'Eventos y rifas', 'ingreso'),
(NULL, 'Otros ingresos', 'ingreso'),
(NULL, 'Refacciones y mantenimiento', 'egreso'),
(NULL, 'Útiles y material didáctico', 'egreso'),
(NULL, 'Servicios', 'egreso'),
(NULL, 'Limpieza', 'egreso'),
(NULL, 'Equipamiento', 'egreso'),
(NULL, 'Gastos bancarios', 'egreso'),
(NULL, 'Otros egresos', 'egreso');

COMMIT;
