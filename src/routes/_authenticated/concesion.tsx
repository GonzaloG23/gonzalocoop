import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Save, Store, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import {
  abrirDocumentoConcesion,
  cargarConcesionKiosco,
  cargarDocumentoConcesion,
  guardarConcesionKiosco,
  guardarDocumentoConcesion,
  type ConcesionKiosco,
  type TipoDocumentoConcesion,
} from "@/lib/data/concesion";
import {
  cargarHistorialConcesionKiosco,
  registrarModificacionConcesionKiosco,
} from "@/lib/data/concesion-historial";
import { money, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/concesion")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Concesión de kioscos y cantinas | Libro de Cooperadoras" },
      {
        name: "description",
        content: "Registro del concesionario, canon y documentación de la concesión de kioscos y cantinas.",
      },
      { property: "og:title", content: "Concesión de kioscos y cantinas" },
      { property: "og:description", content: "Registro del concesionario, canon y documentación respaldatoria." },
    ],
  }),
  component: ConcesionPage,
});

type DocumentoInfo = {
  tipo: TipoDocumentoConcesion;
  titulo: string;
  descripcion: string;
};

const DOCUMENTOS: DocumentoInfo[] = [
  {
    tipo: "contrato",
    titulo: "Contrato de concesión",
    descripcion: "Contrato firmado de concesión del kiosco o cantina.",
  },
  {
    tipo: "contrato_sellado",
    titulo: "Sellado de contrato",
    descripcion: "Constancia o ejemplar del contrato con el sellado correspondiente.",
  },
  {
    tipo: "buena_conducta",
    titulo: "Certificado de buena conducta",
    descripcion: "Certificado correspondiente al concesionario registrado.",
  },
];

function ConcesionPage() {
  const { data: ctx, isLoading } = useContexto();
  const qc = useQueryClient();
  const cooperadora = ctx?.cooperadora;
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState<ConcesionKiosco>({
    apellido: "",
    nombre: "",
    canon: "",
    fechaFirmaContrato: "",
  });
  const [archivos, setArchivos] = useState<Record<TipoDocumentoConcesion, File | null>>({
    contrato: null,
    contrato_sellado: null,
    buena_conducta: null,
  });

  const concesion = useQuery({
    queryKey: ["concesion-kiosco", cooperadora?.id],
    queryFn: () => cargarConcesionKiosco(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const historial = useQuery({
    queryKey: ["historial-concesion-kiosco", cooperadora?.id],
    queryFn: () => cargarHistorialConcesionKiosco(cooperadora!.id),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const contrato = useQuery({
    queryKey: ["documento-concesion", cooperadora?.id, "contrato"],
    queryFn: () => cargarDocumentoConcesion(cooperadora!.id, "contrato"),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const contratoSellado = useQuery({
    queryKey: ["documento-concesion", cooperadora?.id, "contrato_sellado"],
    queryFn: () => cargarDocumentoConcesion(cooperadora!.id, "contrato_sellado"),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  const buenaConducta = useQuery({
    queryKey: ["documento-concesion", cooperadora?.id, "buena_conducta"],
    queryFn: () => cargarDocumentoConcesion(cooperadora!.id, "buena_conducta"),
    enabled: !!cooperadora && !ctx?.esAuditor,
  });

  useEffect(() => {
    if (concesion.data) {
      setDatos({
        apellido: concesion.data.apellido ?? "",
        nombre: concesion.data.nombre ?? "",
        canon: String(concesion.data.canon ?? ""),
        fechaFirmaContrato: concesion.data.fechaFirmaContrato ?? "",
      });
    }
    if (!historial.data?.length) setEditando(true);
  }, [concesion.data, historial.data]);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      if (!ctx) throw new Error("No se pudo identificar al usuario que realiza la modificación.");
      const guardados = await guardarConcesionKiosco(cooperadora.id, datos);
      await registrarModificacionConcesionKiosco(cooperadora.id, guardados, {
        id: ctx.userId,
        nombre: ctx.nombre || "Usuario",
        email: ctx.email,
      });
      return guardados;
    },
    onSuccess: (guardados) => {
      setDatos({ ...guardados, canon: String(guardados.canon) });
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["concesion-kiosco", cooperadora?.id] });
      qc.invalidateQueries({ queryKey: ["historial-concesion-kiosco", cooperadora?.id] });

      toast.success("Datos de la concesión guardados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const subirDocumento = useMutation({
    mutationFn: async ({ tipo }: { tipo: TipoDocumentoConcesion }) => {
      if (!cooperadora) throw new Error("No hay una cooperadora registrada.");
      const archivo = archivos[tipo];
      if (!archivo) throw new Error("Seleccioná un archivo PDF.");
      return guardarDocumentoConcesion(cooperadora.id, tipo, archivo);
    },
    onSuccess: (_documento, variables) => {
      setArchivos((actual) => ({ ...actual, [variables.tipo]: null }));
      qc.invalidateQueries({ queryKey: ["documento-concesion", cooperadora?.id, variables.tipo] });
      const titulo = DOCUMENTOS.find((documento) => documento.tipo === variables.tipo)?.titulo ?? "Documento";
      toast.success(`${titulo} cargado.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell titulo="Concesión de kioscos y cantinas">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (ctx?.esAuditor) {
    return (
      <AppShell titulo="Concesión de kioscos y cantinas" descripcion="Acceso reservado al área de Cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Esta sección está destinada a la cooperadora para completar los datos del concesionario y la documentación respaldatoria.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!cooperadora) {
    return (
      <AppShell titulo="Concesión de kioscos y cantinas" descripcion="Primero registrá la cooperadora.">
        <Card className="max-w-2xl">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Todavía no registraste tu cooperadora. Volvé al panel para completar los datos institucionales.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const ultimaModificacion = historial.data?.[0];
  const cambiosCanon = construirHistorialCanon(historial.data ?? []);

  return (
    <AppShell
      titulo="Concesión de kioscos y cantinas"
      descripcion={`${cooperadora.nombre}${cooperadora.localidad ? ` · ${cooperadora.localidad}` : ""}`}
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <details open={editando} className="self-start rounded-sm border border-border bg-card">
          <summary className={`cursor-pointer list-none hover:bg-secondary/50 ${editando ? "px-4 py-4" : "px-3 py-2"}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Store className={`${editando ? "h-5 w-5" : "h-4 w-4"} shrink-0 text-primary`} />
                <span className={`${editando ? "font-serif text-lg" : "text-sm font-medium"} truncate`}>
                  Datos del concesionario
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{editando ? "Edición" : "Ver información"}</span>
            </span>
            {editando && (
              <span className="mt-1 block text-sm text-muted-foreground">
                Completá o actualizá los datos del concesionario y el canon.
              </span>
            )}
          </summary>

          <div className="border-t border-border p-6">
            {editando ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="concesion-apellido">Apellido *</Label>
                  <Input
                    id="concesion-apellido"
                    value={datos.apellido}
                    onChange={(e) => setDatos((actual) => ({ ...actual, apellido: e.target.value }))}
                    placeholder="Apellido"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concesion-nombre">Nombre *</Label>
                  <Input
                    id="concesion-nombre"
                    value={datos.nombre}
                    onChange={(e) => setDatos((actual) => ({ ...actual, nombre: e.target.value }))}
                    placeholder="Nombre"
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="concesion-fecha-firma">Fecha de firma del contrato *</Label>
                  <Input
                    id="concesion-fecha-firma"
                    type="date"
                    value={datos.fechaFirmaContrato}
                    onChange={(e) =>
                      setDatos((actual) => ({ ...actual, fechaFirmaContrato: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="concesion-canon">Canon *</Label>
                  <Input
                    id="concesion-canon"
                    inputMode="decimal"
                    value={datos.canon}
                    onChange={(e) => setDatos((actual) => ({ ...actual, canon: e.target.value }))}
                    placeholder="Importe del canon"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2 sm:col-span-2">
                  <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {guardar.isPending ? "Guardando…" : "Guardar concesión"}
                  </Button>
                  {historial.data?.length ? (
                    <Button type="button" variant="outline" onClick={() => setEditando(false)} disabled={guardar.isPending}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DatoConcesion titulo="Apellido" valor={datos.apellido} />
                  <DatoConcesion titulo="Nombre" valor={datos.nombre} />
                  <DatoConcesion
                    titulo="Fecha de firma del contrato"
                    valor={formatearFechaContrato(datos.fechaFirmaContrato)}
                    className="sm:col-span-2"
                  />
                  <DatoConcesion titulo="Canon" valor={money(num(datos.canon))} className="sm:col-span-2" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    {ultimaModificacion
                      ? `Última modificación: ${ultimaModificacion.usuario_nombre}${ultimaModificacion.usuario_email ? ` · ${ultimaModificacion.usuario_email}` : ""} · ${new Date(ultimaModificacion.modificado_en).toLocaleString("es-AR")}`
                      : "Información registrada"}
                  </p>
                  <Button variant="outline" onClick={() => setEditando(true)}>Modificar información</Button>
                </div>
              </div>
            )}
          </div>
        </details>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <FileText className="h-5 w-5 text-primary" /> Documentación de la concesión
            </CardTitle>
            <CardDescription>
              Subí el contrato, el sellado del contrato y el certificado de buena conducta en formato PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DOCUMENTOS.map((documento) => {
              const metadata =
                documento.tipo === "contrato"
                  ? contrato.data
                  : documento.tipo === "contrato_sellado"
                    ? contratoSellado.data
                    : buenaConducta.data;
              const archivo = archivos[documento.tipo];
              const cargando = subirDocumento.isPending && subirDocumento.variables?.tipo === documento.tipo;
              return (
                <div
                  key={documento.tipo}
                  className="overflow-hidden rounded-md border-2 border-primary/20 bg-card shadow-sm ring-1 ring-border/50"
                >
                  <div className="flex items-center gap-3 border-b-2 border-primary/10 bg-secondary/70 px-4 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-tight text-foreground">{documento.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{documento.descripcion}</p>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                  <Label htmlFor={`concesion-${documento.tipo}`} className="mt-3 block">Archivo PDF</Label>
                  <Input
                    id={`concesion-${documento.tipo}`}
                    className="mt-2"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setArchivos((actual) => ({ ...actual, [documento.tipo]: e.target.files?.[0] ?? null }))}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">Tamaño máximo: 3 MB.</p>

                  {archivo && (
                    <p className="mt-2 text-sm">
                      Archivo seleccionado: <span className="font-medium">{archivo.name}</span>
                    </p>
                  )}

                  {metadata && (
                    <div className="mt-3 rounded-sm border border-border bg-secondary/40 p-3 text-sm">
                      <p className="font-medium">Documento cargado</p>
                      <p className="mt-1 break-all text-muted-foreground">{metadata.nombreArchivo}</p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDocumentoConcesion(cooperadora.id, documento.tipo).catch((error: Error) => toast.error(error.message))}
                      >
                        <FileText className="mr-2 h-4 w-4" /> Ver PDF
                      </Button>
                    </div>
                  )}

                  <Button
                    className="mt-4 w-full border border-primary/20 shadow-sm"
                    onClick={() => subirDocumento.mutate({ tipo: documento.tipo })}
                    disabled={!archivo || cargando}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {cargando ? "Subiendo…" : `Subir ${documento.titulo.toLowerCase()}`}
                  </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {historial.data && historial.data.length > 0 && (
        <details className="mt-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones</span>
              <span className="text-xs font-normal text-muted-foreground">{historial.data.length} registro{historial.data.length === 1 ? "" : "s"}</span>
            </span>
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            {cambiosCanon.length > 0 && (
              <div className="rounded-sm border border-border">
                <div className="border-b border-border bg-secondary/40 px-3 py-3">
                  <p className="text-sm font-medium">Historial de cambios del canon</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se muestran el valor inicial y cada modificación posterior del canon.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Fecha</th>
                        <th className="px-3 py-2 font-medium">Movimiento</th>
                        <th className="px-3 py-2 font-medium">Valor anterior</th>
                        <th className="px-3 py-2 font-medium">Nuevo valor</th>
                        <th className="px-3 py-2 font-medium">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cambiosCanon.map((cambio) => (
                        <tr key={cambio.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                            {new Date(cambio.modificadoEn).toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2 align-top font-medium">{cambio.etiqueta}</td>
                          <td className="px-3 py-2 align-top">
                            {cambio.valorAnterior === null ? "—" : money(cambio.valorAnterior)}
                          </td>
                          <td className="px-3 py-2 align-top font-medium">{money(cambio.nuevoValor)}</td>
                          <td className="px-3 py-2 align-top text-xs">
                            <span>{cambio.usuarioNombre}</span>
                            {cambio.usuarioEmail ? (
                              <span className="block text-muted-foreground">{cambio.usuarioEmail}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {historial.data.map((registro) => (
                <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                  <summary className="cursor-pointer list-none text-sm">
                    <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">{registro.datos.apellido}, {registro.datos.nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}</span>
                      <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-4">
                    <DatoConcesion titulo="Apellido" valor={registro.datos.apellido} />
                    <DatoConcesion titulo="Nombre" valor={registro.datos.nombre} />
                    <DatoConcesion
                      titulo="Fecha de firma del contrato"
                      valor={formatearFechaContrato(registro.datos.fechaFirmaContrato)}
                    />
                    <DatoConcesion titulo="Canon" valor={money(num(registro.datos.canon))} />
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>
      )}
    </AppShell>
  );
}

function construirHistorialCanon(
  historial: Array<{
    id: string;
    datos: ConcesionKiosco;
    usuario_nombre: string;
    usuario_email: string | null;
    modificado_en: string;
  }>,
) {
  const ordenCronologico = [...historial].reverse();
  const cambios: Array<{
    id: string;
    etiqueta: string;
    valorAnterior: number | null;
    nuevoValor: number;
    usuarioNombre: string;
    usuarioEmail: string | null;
    modificadoEn: string;
  }> = [];

  ordenCronologico.forEach((registro, index) => {
    const nuevoValor = num(registro.datos.canon);
    const registroAnterior = ordenCronologico[index - 1];
    const valorAnterior = registroAnterior ? num(registroAnterior.datos.canon) : null;

    if (valorAnterior !== null && valorAnterior === nuevoValor) return;

    cambios.push({
      id: registro.id,
      etiqueta: valorAnterior === null ? "Valor inicial" : "Cambio de canon",
      valorAnterior,
      nuevoValor,
      usuarioNombre: registro.usuario_nombre,
      usuarioEmail: registro.usuario_email,
      modificadoEn: registro.modificado_en,
    });
  });

  return cambios.reverse();
}

function formatearFechaContrato(valor: string | undefined) {
  if (!valor) return "No informado";
  const [anio, mes, dia] = valor.split("-");
  if (!anio || !mes || !dia) return valor;
  return [dia, mes, anio].join("/");
}

function DatoConcesion({ titulo, valor, className = "" }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-border bg-card px-3 py-3 ${className}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor || "No informado"}</p>
    </div>
  );
}
