import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Lock,
  MessageCircle,
  Plus,
  Printer,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { authData } from "@/lib/data/auth";
import { cerrarPeriodo } from "@/lib/data/operaciones";
import { registrarMovimiento } from "@/lib/data/movimientos";
import {
  asegurarPeriodo,
  calcularEjercicio,
  cargarEjercicio,
  cargarParametros,
  cargarRubros,
  etiquetaFactura,
  TIPOS_FACTURA,
  type Cooperadora,
  type Movimiento,
  type Rubro,
} from "@/lib/libro";
import { fechaCorta, fechaHora, money, nombreMes, num, MESES } from "@/lib/formato";
import { exportarMesExcel, exportarMesPDF } from "@/lib/exportar";
import {
  abrirComprobanteIngresoParaImprimir,
  descargarComprobanteIngreso,
  prepararComprobanteParaWhatsApp,
  type DatosComprobanteIngreso,
} from "@/lib/comprobante-ingreso";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function LibroMensual({
  cooperadora,
  soloLectura = false,
  mesInicial,
}: {
  cooperadora: Cooperadora;
  soloLectura?: boolean;
  mesInicial?: number | undefined;
}) {
  const qc = useQueryClient();
  const hoy = new Date();
  const [anio, setAnio] = useState(cooperadora.ejercicio);
  const [mes, setMes] = useState(
    mesInicial && mesInicial >= 1 && mesInicial <= 12
      ? mesInicial
      : cooperadora.ejercicio === hoy.getFullYear()
        ? hoy.getMonth() + 1
        : 1,
  );
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [ajustando, setAjustando] = useState<Movimiento | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const ejercicio = useQuery({
    queryKey: ["ejercicio", cooperadora.id, anio],
    queryFn: () => cargarEjercicio(cooperadora.id, anio),
  });
  const rubros = useQuery({
    queryKey: ["rubros", cooperadora.id],
    queryFn: () => cargarRubros(cooperadora.id),
  });

  const parametros = useQuery({
    queryKey: ["parametros"],
    queryFn: cargarParametros,
    staleTime: 30_000,
  });

  const resumen = useMemo(() => {
    if (!ejercicio.data) return null;
    return calcularEjercicio(
      anio === cooperadora.ejercicio ? num(cooperadora.saldo_inicial_ejercicio) : 0,
      ejercicio.data.periodos,
      ejercicio.data.movimientos,
      parametros.data,
    );
  }, [ejercicio.data, anio, cooperadora, parametros.data]);

  const mesActual = resumen?.find((r) => r.mes === mes) ?? null;
  const movimientos = (ejercicio.data?.movimientos ?? []).filter(
    (m) => Number(m.fecha.slice(5, 7)) === mes,
  );
  const cerrado = mesActual?.periodo?.estado === "cerrado";
  const ajustados = new Set(
    movimientos.map((m) => m.ajusta_movimiento_id).filter((v): v is string => !!v),
  );

  const cerrarMes = useMutation({
    mutationFn: async () => {
      const periodo = await asegurarPeriodo(cooperadora.id, anio, mes);
      await cerrarPeriodo(periodo.id);
    },
    onSuccess: () => {
      toast.success(`${nombreMes(mes)} quedó cerrado. Ya no admite nuevos movimientos.`);
      qc.invalidateQueries({ queryKey: ["ejercicio", cooperadora.id, anio] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const anios = Array.from(
    new Set([cooperadora.ejercicio, cooperadora.ejercicio + 1, hoy.getFullYear()]),
  ).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mes</Label>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ejercicio</Label>
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!mesActual}
            onClick={() =>
              mesActual &&
              exportarMesExcel(cooperadora, mesActual, movimientos, rubros.data ?? [])
            }
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!mesActual}
            onClick={() =>
              mesActual && exportarMesPDF(cooperadora, mesActual, movimientos, rubros.data ?? [])
            }
          >
            <Download className="mr-1 h-4 w-4" /> PDF
          </Button>
          {!soloLectura && !cerrado && (
            <>
              <Button size="sm" onClick={() => setNuevoAbierto(true)}>
                <Plus className="mr-1 h-4 w-4" /> Nuevo movimiento
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmarCierre(true)}>
                <Lock className="mr-1 h-4 w-4" /> Cerrar mes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Saldo inicial" valor={mesActual?.saldoInicial ?? 0} />
        <Indicador titulo="Ingresos del mes" valor={mesActual?.ingresos ?? 0} tono="ingreso" />
        <Indicador titulo="Egresos del mes" valor={mesActual?.egresos ?? 0} tono="egreso" />
        <Indicador titulo="Saldo final" valor={mesActual?.saldoFinal ?? 0} destacado />
      </div>

      {cerrado && (
        <p className="flex items-center gap-2 rounded-sm border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          <Lock className="h-4 w-4" /> Mes cerrado el{" "}
          {mesActual?.periodo?.cerrado_en ? fechaHora(mesActual.periodo.cerrado_en) : ""}. Para
          corregir algo, registrá un ajuste en un mes abierto.
        </p>
      )}

      {!!mesActual?.alertas.length && (
        <ul className="space-y-1 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {mesActual.alertas.map((a) => (
            <li key={a} className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> {a}
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base">
            Movimientos de {nombreMes(mes)} de {anio}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                  <TableHead className="text-right">Egreso</TableHead>
                  {!soloLectura && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Todavía no hay movimientos registrados en este mes.
                    </TableCell>
                  </TableRow>
                )}
                {movimientos.map((m) => (
                  <TableRow key={m.id} className={ajustados.has(m.id) ? "bg-accent/40" : undefined}>
                    <TableCell className="tabular whitespace-nowrap">{fechaCorta(m.fecha)}</TableCell>
                    <TableCell className="text-sm">
                      {rubros.data?.find((r) => r.id === m.rubro_id)?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.concepto}
                        {m.ajusta_movimiento_id && <Badge variant="secondary">Ajuste</Badge>}
                        {ajustados.has(m.id) && <Badge variant="outline">Ajustado</Badge>}
                      </div>
                      {m.motivo_ajuste && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Motivo: {m.motivo_ajuste}
                        </p>
                      )}
                      {m.observaciones && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{m.observaciones}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.comprobante ?? "—"}
                      {m.proveedor_razon_social && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {m.proveedor_razon_social}
                          {m.proveedor_cuit ? ` · CUIT ${m.proveedor_cuit}` : ""}
                          {etiquetaFactura(m.tipo_factura) ? ` · ${etiquetaFactura(m.tipo_factura)}` : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {m.tipo === "ingreso" ? money(m.monto) : ""}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {m.tipo === "egreso" ? money(m.monto) : ""}
                    </TableCell>
                    {!soloLectura && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAjustando(m)}
                          title="Corregir con un ajuste contable"
                        >
                          <Scale className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!soloLectura && (
        <>
          <FormularioMovimiento
            abierto={nuevoAbierto}
            onCerrar={() => setNuevoAbierto(false)}
            cooperadora={cooperadora}
            anio={anio}
            mes={mes}
            rubros={rubros.data ?? []}
            movimientosEjercicio={ejercicio.data?.movimientos ?? []}
          />
          <FormularioMovimiento
            abierto={!!ajustando}
            onCerrar={() => setAjustando(null)}
            cooperadora={cooperadora}
            anio={anio}
            mes={mes}
            rubros={rubros.data ?? []}
            movimientosEjercicio={ejercicio.data?.movimientos ?? []}
            ajusta={ajustando}
          />
          <AlertDialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar {nombreMes(mes)} de {anio}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Una vez cerrado, el mes no admite nuevos movimientos y no puede reabrirse. Las
                  correcciones posteriores se hacen con un ajuste contable en un mes abierto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => cerrarMes.mutate()}>
                  Cerrar el mes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  tono,
  destacado,
}: {
  titulo: string;
  valor: number;
  tono?: "ingreso" | "egreso";
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-4 ${
        destacado ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p
        className={`tabular mt-1 font-serif text-xl font-semibold ${
          valor < 0
            ? "text-destructive"
            : tono === "ingreso"
              ? "text-primary"
              : tono === "egreso"
                ? "text-foreground"
                : "text-foreground"
        }`}
      >
        {money(valor)}
      </p>
    </div>
  );
}

function FormularioMovimiento({
  abierto,
  onCerrar,
  cooperadora,
  anio,
  mes,
  rubros,
  movimientosEjercicio,
  ajusta,
}: {
  abierto: boolean;
  onCerrar: () => void;
  cooperadora: Cooperadora;
  anio: number;
  mes: number;
  rubros: Rubro[];
  movimientosEjercicio: Movimiento[];
  ajusta?: Movimiento | null;
}) {
  const qc = useQueryClient();
  const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const [fecha, setFecha] = useState(primerDia);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [rubroId, setRubroId] = useState<string>("");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [comprobante, setComprobante] = useState("");
  const [proveedorCuit, setProveedorCuit] = useState("");
  const [proveedorRazon, setProveedorRazon] = useState("");
  const [tipoFactura, setTipoFactura] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [motivo, setMotivo] = useState("");
  const [alumnoNombre, setAlumnoNombre] = useState("");
  const [alumnoDni, setAlumnoDni] = useState("");
  const [alumnoCurso, setAlumnoCurso] = useState("");
  const [comprobanteGenerado, setComprobanteGenerado] = useState<DatosComprobanteIngreso | null>(null);
  const [whatsappComprobante, setWhatsappComprobante] = useState("");

  useEffect(() => {
    if (!abierto) setComprobanteGenerado(null);
  }, [abierto]);

  const cuitDigitos = proveedorCuit.replace(/\D/g, "");
  const alumnoDniDigitos = alumnoDni.replace(/\D/g, "");
  const rubroSeleccionado = rubros.find((r) => r.id === rubroId);
  const rubroNormalizado = (rubroSeleccionado?.nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const generaComprobanteIngreso =
    !ajusta &&
    tipo === "ingreso" &&
    (rubroNormalizado === "matricula" ||
      rubroNormalizado.replace(/\s+/g, "") === "ayudaescolar/cooperadora" ||
      rubroNormalizado.startsWith("certificados voluntarios:") ||
      rubroNormalizado === "venta de pliegos");
  const requiereDatosAlumno =
    generaComprobanteIngreso && rubroNormalizado !== "venta de pliegos";
  const faltanDatosAlumno =
    requiereDatosAlumno &&
    (!alumnoNombre.trim() || alumnoDniDigitos.length < 7 || alumnoDniDigitos.length > 8);
  const faltaConcepto = !generaComprobanteIngreso && !concepto.trim();

  const guardar = useMutation({
    mutationFn: async () => {
      if (faltanDatosAlumno) {
        throw new Error("Completá nombre y DNI del alumno para generar el comprobante.");
      }

      const periodo = await asegurarPeriodo(cooperadora.id, anio, mes);
      const { data: userData, error: userError } = await authData.getUser();
      if (userError || !userData.user) {
        throw userError ?? new Error("No hay un usuario autenticado.");
      }
      const movimientoRegistrado = await registrarMovimiento({
        cooperadora_id: cooperadora.id,
        periodo_id: periodo.id,
        fecha,
        tipo,
        rubro_id: rubroId || null,
        concepto: generaComprobanteIngreso ? "" : concepto.trim(),
        monto: Number(monto),
        medio_pago: medioPago || null,
        comprobante: generaComprobanteIngreso ? null : comprobante.trim() || null,
        proveedor_cuit: tipo === "egreso" ? cuitDigitos : null,
        proveedor_razon_social: tipo === "egreso" ? proveedorRazon.trim() : null,
        tipo_factura: tipo === "egreso" ? tipoFactura : null,
        observaciones: observaciones || null,
        ajusta_movimiento_id: ajusta?.id ?? null,
        motivo_ajuste: ajusta ? motivo : null,
        creado_por: userData.user.id,
        generar_comprobante: generaComprobanteIngreso,
      });

      if (generaComprobanteIngreso && !movimientoRegistrado?.comprobante) {
        throw new Error(
          "El movimiento se registró, pero no se recibió el número correlativo del comprobante.",
        );
      }

      return movimientoRegistrado;
    },
    onSuccess: (movimientoRegistrado) => {
      toast.success(ajusta ? "Ajuste contable registrado." : "Movimiento registrado.");
      qc.invalidateQueries({ queryKey: ["ejercicio", cooperadora.id, anio] });

      const datosComprobante: DatosComprobanteIngreso = {
        cooperadora,
        fecha,
        rubro: rubroSeleccionado?.nombre ?? "Ingreso",
        monto: Number(monto),
        medioPago,
        comprobante: movimientoRegistrado?.comprobante ?? "",
        alumnoNombre: alumnoNombre.trim(),
        alumnoDni: alumnoDniDigitos,
        alumnoCurso: alumnoCurso.trim(),
      };

      setConcepto("");
      setMonto("");
      setComprobante("");
      setProveedorCuit("");
      setProveedorRazon("");
      setTipoFactura("");
      setObservaciones("");
      setMotivo("");
      setAlumnoNombre("");
      setAlumnoDni("");
      setAlumnoCurso("");

      if (generaComprobanteIngreso) {
        setComprobanteGenerado(datosComprobante);
      } else {
        onCerrar();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disponibles = rubros.filter((r) => r.tipo === tipo);

  const saldoDisponible = useMemo(() => {
    const base = anio === cooperadora.ejercicio ? num(cooperadora.saldo_inicial_ejercicio) : 0;
    return movimientosEjercicio
      .filter((m) => m.fecha <= fecha)
      .reduce((s, m) => s + (m.tipo === "ingreso" ? num(m.monto) : -num(m.monto)), base);
  }, [movimientosEjercicio, fecha, anio, cooperadora]);

  const montoNum = Number(monto) || 0;
  const sinSaldo = tipo === "egreso" && saldoDisponible <= 0;
  const excedeSaldo = tipo === "egreso" && !sinSaldo && montoNum > saldoDisponible;
  const cuitInvalido = tipo === "egreso" && cuitDigitos.length > 0 && cuitDigitos.length !== 11;
  const faltanDatosProveedor =
    tipo === "egreso" &&
    (!comprobante.trim() || cuitDigitos.length !== 11 || !proveedorRazon.trim() || !tipoFactura);
  const fechaFueraDelMes =
    !fecha ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    Number(fecha.slice(0, 4)) !== anio ||
    Number(fecha.slice(5, 7)) !== mes;
  const bloqueado =
    sinSaldo ||
    excedeSaldo ||
    faltanDatosProveedor ||
    fechaFueraDelMes ||
    faltanDatosAlumno ||
    faltaConcepto;



  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {ajusta ? "Ajuste contable" : "Nuevo movimiento"}
          </DialogTitle>
          <DialogDescription>
            {ajusta
              ? `Corrige el movimiento "${ajusta.concepto}" del ${fechaCorta(ajusta.fecha)} por ${money(ajusta.monto)}. El original se conserva y queda marcado como ajustado.`
              : `Se registra en ${nombreMes(mes)} de ${anio}. Los movimientos no se editan ni se borran.`}
          </DialogDescription>
        </DialogHeader>

        {comprobanteGenerado ? (
          <div className="space-y-5">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="font-medium">Ingreso registrado correctamente</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Se generó el comprobante en forma correlativa.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">N° de comprobante</p>
                  <p className="text-sm font-semibold tabular">{comprobanteGenerado.comprobante}</p>
                </div>
                {comprobanteGenerado.alumnoNombre && (
                  <div>
                    <p className="text-xs text-muted-foreground">Alumno/a</p>
                    <p className="text-sm font-medium">{comprobanteGenerado.alumnoNombre}</p>
                  </div>
                )}
                {comprobanteGenerado.alumnoDni && (
                  <div>
                    <p className="text-xs text-muted-foreground">DNI</p>
                    <p className="text-sm font-medium">{comprobanteGenerado.alumnoDni}</p>
                  </div>
                )}
                {comprobanteGenerado.alumnoCurso && (
                  <div>
                    <p className="text-xs text-muted-foreground">Curso / grado</p>
                    <p className="text-sm font-medium">{comprobanteGenerado.alumnoCurso}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Monto abonado</p>
                  <p className="text-lg font-semibold text-primary">{money(comprobanteGenerado.monto)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Elegí qué hacer con el comprobante</p>

              <Button
                type="button"
                className="w-full justify-start"
                onClick={() => {
                  try {
                    abrirComprobanteIngresoParaImprimir(comprobanteGenerado);
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                <Printer className="mr-2 h-4 w-4" /> Imprimir comprobante
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  try {
                    descargarComprobanteIngreso(comprobanteGenerado);
                    toast.success("Comprobante descargado. Ya podés adjuntarlo en WhatsApp.");
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" /> Descargar comprobante
              </Button>

              <div className="rounded-md border border-border p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Enviar por WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Se descarga el PDF y se abre WhatsApp Web con el mensaje preparado. Adjuntá el PDF antes de enviarlo.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    inputMode="tel"
                    value={whatsappComprobante}
                    onChange={(e) => setWhatsappComprobante(e.target.value)}
                    placeholder="+54 381 555 5555"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await prepararComprobanteParaWhatsApp(
                          comprobanteGenerado,
                          whatsappComprobante,
                        );
                      } catch (error) {
                        if ((error as DOMException).name !== "AbortError") {
                          toast.error((error as Error).message);
                        }
                      }
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp
                  </Button>
                </div>
              </div>

            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (fechaFueraDelMes) return;
            guardar.mutate();
          }}
        >
          {ajusta && (
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo del ajuste</Label>
              <Textarea
                id="motivo"
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. El monto se cargó por $10.000 en lugar de $1.000"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              {fechaFueraDelMes && (
                <p className="text-xs text-destructive">
                  La fecha debe pertenecer a {nombreMes(mes)} de {anio}. El movimiento no puede registrarse en otro mes.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v as "ingreso" | "egreso");
                  setRubroId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rubro</Label>
            <Select value={rubroId} onValueChange={setRubroId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un rubro" />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {generaComprobanteIngreso && (
            <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">
                  {requiereDatosAlumno ? "Datos del alumno para el comprobante" : "Comprobante de ingreso"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se generará un comprobante al registrar este ingreso.
                </p>
              </div>
              {requiereDatosAlumno ?               <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="alumno-nombre">Nombre y apellido del alumno *</Label>
                  <Input
                    id="alumno-nombre"
                    required
                    value={alumnoNombre}
                    onChange={(e) => setAlumnoNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alumno-dni">DNI del alumno *</Label>
                  <Input
                    id="alumno-dni"
                    required
                    inputMode="numeric"
                    maxLength={8}
                    value={alumnoDni}
                    onChange={(e) => setAlumnoDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="Número de DNI"
                  />
                  {alumnoDni.length > 0 && (alumnoDniDigitos.length < 7 || alumnoDniDigitos.length > 8) && (
                    <p className="text-xs text-destructive">El DNI debe tener 7 u 8 dígitos.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alumno-curso">Curso / grado</Label>
                  <Input
                    id="alumno-curso"
                    value={alumnoCurso}
                    onChange={(e) => setAlumnoCurso(e.target.value)}
                    placeholder="Ej. 5° grado"
                  />
                </div>
 : null}
              </div>
            </div>
          )}

          {!generaComprobanteIngreso && (
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto</Label>
              <Input
                id="concepto"
                required
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Compra de pintura para el aula 3"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              {tipo === "egreso" && (
                <p className={sinSaldo || excedeSaldo ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {sinSaldo
                    ? `No hay saldo disponible al ${fechaCorta(fecha)}: el saldo es ${money(saldoDisponible)}.`
                    : excedeSaldo
                      ? `El egreso supera el saldo disponible (${money(saldoDisponible)}): faltan ${money(montoNum - saldoDisponible)}.`
                      : `Saldo disponible al ${fechaCorta(fecha)}: ${money(saldoDisponible)}.`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="medio">Medio de pago</Label>
              <Input
                id="medio"
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                placeholder="Efectivo, transferencia…"
              />
            </div>
            <div className="space-y-2">
              {!generaComprobanteIngreso ? (
                <>
                  <Label htmlFor="comprobante">
                    N° Comprobante{tipo === "egreso" ? "" : " (opcional)"}
                  </Label>
                  <Input
                    id="comprobante"
                    required={tipo === "egreso"}
                    value={comprobante}
                    onChange={(e) => setComprobante(e.target.value)}
                    placeholder="N° factura / recibo"
                  />
                </>
              ) : (
                <>
                  <Label>N° Comprobante</Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Se asigna automáticamente al registrar el ingreso.
                  </div>
                </>
              )}
            </div>
          </div>

          {tipo === "egreso" && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium">Datos del proveedor</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="razon">Razón social / Nombre del comercio</Label>
                  <Input
                    id="razon"
                    required
                    maxLength={150}
                    value={proveedorRazon}
                    onChange={(e) => setProveedorRazon(e.target.value)}
                    placeholder="Ej. Ferretería San Martín S.R.L."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuit">CUIT</Label>
                  <Input
                    id="cuit"
                    required
                    inputMode="numeric"
                    maxLength={13}
                    value={proveedorCuit}
                    onChange={(e) => setProveedorCuit(e.target.value)}
                    placeholder="20123456789"
                  />
                  {cuitInvalido && (
                    <p className="text-xs text-destructive">El CUIT debe tener 11 dígitos.</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo de comprobante</Label>
                <Select value={tipoFactura} onValueChange={setTipoFactura}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí el tipo de comprobante" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_FACTURA.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardar.isPending || bloqueado}>
              {guardar.isPending ? "Guardando…" : ajusta ? "Registrar ajuste" : "Registrar movimiento"}
            </Button>
          </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
