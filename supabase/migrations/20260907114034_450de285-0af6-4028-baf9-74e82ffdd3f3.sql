CREATE TABLE public.parametros_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_limite_cierre integer NOT NULL DEFAULT 10,
  tope_egreso numeric NOT NULL DEFAULT 500000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.parametros_control TO authenticated;
GRANT ALL ON public.parametros_control TO service_role;

ALTER TABLE public.parametros_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver parametros" ON public.parametros_control
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auditor crea parametros" ON public.parametros_control
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Auditor actualiza parametros" ON public.parametros_control
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'))
  WITH CHECK (public.has_role(auth.uid(), 'auditor'));

CREATE OR REPLACE FUNCTION public.tocar_parametros_control()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tocar_parametros_control
BEFORE UPDATE ON public.parametros_control
FOR EACH ROW EXECUTE FUNCTION public.tocar_parametros_control();

INSERT INTO public.parametros_control (dia_limite_cierre, tope_egreso) VALUES (10, 500000);