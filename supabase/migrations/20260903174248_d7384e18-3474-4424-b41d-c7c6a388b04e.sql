-- ROLES
CREATE TYPE public.app_role AS ENUM ('auditor', 'cooperadora');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Cada usuario ve sus roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'auditor'));

-- COOPERADORAS
CREATE TABLE public.cooperadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  cue text,
  cuit text,
  localidad text,
  ejercicio integer NOT NULL,
  saldo_inicial_ejercicio numeric(14,2) NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cooperadoras TO authenticated;
GRANT ALL ON public.cooperadoras TO service_role;
ALTER TABLE public.cooperadoras ENABLE ROW LEVEL SECURITY;

-- PERFILES
CREATE TABLE public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  email text,
  cooperadora_id uuid REFERENCES public.cooperadoras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.perfiles TO authenticated;
GRANT ALL ON public.perfiles TO service_role;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mi_cooperadora()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cooperadora_id FROM public.perfiles WHERE id = auth.uid()
$$;

CREATE POLICY "Ver perfil propio o auditor" ON public.perfiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "Crear perfil propio" ON public.perfiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Actualizar perfil propio" ON public.perfiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Ver cooperadora propia o auditor" ON public.cooperadoras
  FOR SELECT TO authenticated USING (id = public.mi_cooperadora() OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "Crear cooperadora" ON public.cooperadoras
  FOR INSERT TO authenticated WITH CHECK (creado_por = auth.uid());
CREATE POLICY "Actualizar cooperadora propia" ON public.cooperadoras
  FOR UPDATE TO authenticated USING (id = public.mi_cooperadora()) WITH CHECK (id = public.mi_cooperadora());

-- perfil automatico al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RUBROS
CREATE TYPE public.tipo_movimiento AS ENUM ('ingreso', 'egreso');

CREATE TABLE public.rubros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperadora_id uuid REFERENCES public.cooperadoras(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo public.tipo_movimiento NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rubros TO authenticated;
GRANT ALL ON public.rubros TO service_role;
ALTER TABLE public.rubros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver rubros globales y propios" ON public.rubros
  FOR SELECT TO authenticated
  USING (cooperadora_id IS NULL OR cooperadora_id = public.mi_cooperadora() OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "Crear rubros propios" ON public.rubros
  FOR INSERT TO authenticated WITH CHECK (cooperadora_id = public.mi_cooperadora());
CREATE POLICY "Actualizar rubros propios" ON public.rubros
  FOR UPDATE TO authenticated USING (cooperadora_id = public.mi_cooperadora()) WITH CHECK (cooperadora_id = public.mi_cooperadora());

INSERT INTO public.rubros (cooperadora_id, nombre, tipo) VALUES
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

-- PERIODOS
CREATE TABLE public.periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperadora_id uuid NOT NULL REFERENCES public.cooperadoras(id) ON DELETE CASCADE,
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  saldo_inicial_declarado numeric(14,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),
  cerrado_en timestamptz,
  cerrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cooperadora_id, anio, mes)
);
GRANT SELECT, INSERT, UPDATE ON public.periodos TO authenticated;
GRANT ALL ON public.periodos TO service_role;
ALTER TABLE public.periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver periodos propios o auditor" ON public.periodos
  FOR SELECT TO authenticated USING (cooperadora_id = public.mi_cooperadora() OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "Crear periodos propios" ON public.periodos
  FOR INSERT TO authenticated WITH CHECK (cooperadora_id = public.mi_cooperadora());
CREATE POLICY "Actualizar periodos propios" ON public.periodos
  FOR UPDATE TO authenticated USING (cooperadora_id = public.mi_cooperadora()) WITH CHECK (cooperadora_id = public.mi_cooperadora());

CREATE OR REPLACE FUNCTION public.proteger_periodo_cerrado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El mes ya fue cerrado y no puede modificarse';
  END IF;
  IF NEW.estado = 'cerrado' THEN
    NEW.cerrado_en := now();
    NEW.cerrado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_proteger_periodo_cerrado
  BEFORE UPDATE ON public.periodos FOR EACH ROW EXECUTE FUNCTION public.proteger_periodo_cerrado();

-- MOVIMIENTOS (libro inalterable: solo INSERT y SELECT)
CREATE TABLE public.movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperadora_id uuid NOT NULL REFERENCES public.cooperadoras(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES public.periodos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo public.tipo_movimiento NOT NULL,
  rubro_id uuid REFERENCES public.rubros(id),
  concepto text NOT NULL,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  medio_pago text,
  comprobante text,
  observaciones text,
  ajusta_movimiento_id uuid REFERENCES public.movimientos(id),
  motivo_ajuste text,
  creado_por uuid NOT NULL DEFAULT auth.uid(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ajuste_con_motivo CHECK (ajusta_movimiento_id IS NULL OR (motivo_ajuste IS NOT NULL AND length(btrim(motivo_ajuste)) > 0))
);
GRANT SELECT, INSERT ON public.movimientos TO authenticated;
GRANT ALL ON public.movimientos TO service_role;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_movimientos_periodo ON public.movimientos(periodo_id);
CREATE INDEX idx_movimientos_coop ON public.movimientos(cooperadora_id);

CREATE POLICY "Ver movimientos propios o auditor" ON public.movimientos
  FOR SELECT TO authenticated USING (cooperadora_id = public.mi_cooperadora() OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "Registrar movimientos propios" ON public.movimientos
  FOR INSERT TO authenticated WITH CHECK (cooperadora_id = public.mi_cooperadora() AND creado_por = auth.uid());

CREATE OR REPLACE FUNCTION public.validar_movimiento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD;
BEGIN
  SELECT * INTO p FROM public.periodos WHERE id = NEW.periodo_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Periodo inexistente'; END IF;
  IF p.estado = 'cerrado' THEN RAISE EXCEPTION 'El mes % / % está cerrado: no se pueden registrar movimientos', p.mes, p.anio; END IF;
  IF p.cooperadora_id <> NEW.cooperadora_id THEN RAISE EXCEPTION 'El periodo no pertenece a la cooperadora'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_movimiento
  BEFORE INSERT ON public.movimientos FOR EACH ROW EXECUTE FUNCTION public.validar_movimiento();

-- alta de cooperadora + rol
CREATE OR REPLACE FUNCTION public.crear_cooperadora(
  _nombre text, _cue text, _cuit text, _localidad text, _ejercicio integer, _saldo_inicial numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nueva_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF (SELECT cooperadora_id FROM public.perfiles WHERE id = auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'El usuario ya tiene una cooperadora asignada';
  END IF;
  INSERT INTO public.cooperadoras (nombre, cue, cuit, localidad, ejercicio, saldo_inicial_ejercicio, creado_por)
  VALUES (_nombre, _cue, _cuit, _localidad, _ejercicio, COALESCE(_saldo_inicial, 0), auth.uid())
  RETURNING id INTO nueva_id;
  UPDATE public.perfiles SET cooperadora_id = nueva_id WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'cooperadora') ON CONFLICT DO NOTHING;
  RETURN nueva_id;
END;
$$;

-- reclamar rol auditor (solo si no existe ninguno)
CREATE OR REPLACE FUNCTION public.reclamar_rol_auditor()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'auditor') THEN
    RAISE EXCEPTION 'Ya existe un auditor registrado. Solicitá el acceso a un auditor existente.';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'auditor');
  RETURN true;
END;
$$;

-- un auditor puede habilitar a otro auditor por email
CREATE OR REPLACE FUNCTION public.otorgar_rol_auditor(_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'auditor') THEN RAISE EXCEPTION 'Solo un auditor puede habilitar auditores'; END IF;
  SELECT id INTO uid FROM public.perfiles WHERE lower(email) = lower(_email);
  IF uid IS NULL THEN RAISE EXCEPTION 'No existe un usuario registrado con ese email'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'auditor') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_cooperadora(text,text,text,text,integer,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_rol_auditor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.otorgar_rol_auditor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mi_cooperadora() TO authenticated;