import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, FileSpreadsheet, Lock, Plus, Scale } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  asegurarPeriodo,
  calcularEjercicio,
  cargarEjercicio,
  cargarParametros,
  cargarRubros,
  type Cooperadora,
  type Movimiento,
  type Rubro,
} from "@/lib/libro";
import { fechaCorta, fechaHora, money, nombreMes, num, MESES } from "@/lib/formato";
import { exportarMesExcel, exportarMesPDF } from "@/lib/exportar";
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
      const { error } = await supabase
        .from("periodos")
        .update({ estado: "cerrado" })
        .eq("id", periodo.id);
      if (error) throw error;
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
  const [observaciones, setObservaciones] = useState("");
  const [motivo, setMotivo] = useState("");

  const guardar = useMutation({
    mutationFn: async () => {
      const periodo = await asegurarPeriodo(cooperadora.id, anio, mes);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("movimientos").insert({
        cooperadora_id: cooperadora.id,
        periodo_id: periodo.id,
        fecha,
        tipo,
        rubro_id: rubroId || null,
        concepto,
        monto: Number(monto),
        medio_pago: medioPago || null,
        comprobante: comprobante || null,
        observaciones: observaciones || null,
        ajusta_movimiento_id: ajusta?.id ?? null,
        motivo_ajuste: ajusta ? motivo : null,
        creado_por: userData.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ajusta ? "Ajuste contable registrado." : "Movimiento registrado.");
      qc.invalidateQueries({ queryKey: ["ejercicio", cooperadora.id, anio] });
      setConcepto("");
      setMonto("");
      setComprobante("");
      setObservaciones("");
      setMotivo("");
      onCerrar();
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
  const bloqueado = sinSaldo || excedeSaldo;

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

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
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
              <Label htmlFor="comprobante">Comprobante</Label>
              <Input
                id="comprobante"
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
                placeholder="N° factura / recibo"
              />
            </div>
          </div>

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
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
