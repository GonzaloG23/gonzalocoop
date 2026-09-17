import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileText, Store, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, useContexto } from "@/components/AppShell";
import { LibroMensual } from "@/components/LibroMensual";
import {
  actualizarDatosIdentificatoriosCooperadora,
  cargarCooperadoraAuditoria,
} from "@/lib/data/auditoria";
import {
  abrirDocumentoConcesion,
  cargarConcesionKiosco,
  cargarDocumentoConcesion,
} from "@/lib/data/concesion";
import { cargarDatosInstitucionales, cargarHistorialDatosInstitucionales } from "@/lib/data/datos-institucionales";
import { cargarComisionDirectiva, type CargoComision } from "@/lib/data/comision";
import { cargarHistorialComisionDirectiva } from "@/lib/data/comision-historial";
import { cargarHistorialConcesionKiosco } from "@/lib/data/concesion-historial";
import { money, num } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/auditoria/$id")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    mes: search["mes"] ? Number(search["mes"]) : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Libro de la cooperadora | Auditoría" },
      {
        name: "description",
        content:
          "Vista de auditoría del libro mensual de una cooperadora escolar: movimientos, saldos y observaciones.",
      },
      { property: "og:title", content: "Libro de la cooperadora | Auditoría" },
      {
        property: "og:description",
        content: "Revisión mes a mes de los movimientos y saldos de una cooperadora escolar.",
      },
    ],
  }),
  component: AuditoriaLibroPage,
});

const ETIQUETAS_CARGO: Record<CargoComision, string> = {
  presidente: "Presidente",
  secretario: "Secretario",
  tesorero: "Tesorero",
  vocal_1: "Vocal 1",
  vocal_2: "Vocal 2",
  revisor_cuentas: "Revisor de Cuentas",
  asesor_director: "Asesor/Director",
};

function AuditoriaLibroPage() {
  const { id } = Route.useParams();
  const { mes } = Route.useSearch();
  const { data: ctx } = useContexto();
  const qc = useQueryClient();
  const [editandoIdentificacion, setEditandoIdentificacion] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cue, setCue] = useState("");

  const coop = useQuery({
    queryKey: ["cooperadora", id],
    queryFn: () => cargarCooperadoraAuditoria(id),
    enabled: !!ctx?.esAuditor,
  });

  const datosInstitucionales = useQuery({
    queryKey: ["datos-institucionales", id],
    queryFn: () => cargarDatosInstitucionales(coop.data!),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialInstitucional = useQuery({
    queryKey: ["historial-datos-institucionales", id],
    queryFn: () => cargarHistorialDatosInstitucionales(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const comision = useQuery({
    queryKey: ["comision-directiva", id],
    queryFn: () => cargarComisionDirectiva(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialComision = useQuery({
    queryKey: ["historial-comision-directiva", id],
    queryFn: () => cargarHistorialComisionDirectiva(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const concesion = useQuery({
    queryKey: ["concesion-kiosco", id],
    queryFn: () => cargarConcesionKiosco(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const historialConcesion = useQuery({
    queryKey: ["historial-concesion-kiosco", id],
    queryFn: () => cargarHistorialConcesionKiosco(id),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const contrato = useQuery({
    queryKey: ["documento-concesion", id, "contrato"],
    queryFn: () => cargarDocumentoConcesion(id, "contrato"),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const buenaConducta = useQuery({
    queryKey: ["documento-concesion", id, "buena_conducta"],
    queryFn: () => cargarDocumentoConcesion(id, "buena_conducta"),
    enabled: !!ctx?.esAuditor && !!coop.data,
  });

  const actualizarIdentificacion = useMutation({
    mutationFn: () => actualizarDatosIdentificatoriosCooperadora(id, { nombre, cue }),
    onSuccess: () => {
      setEditandoIdentificacion(false);
      qc.invalidateQueries({ queryKey: ["cooperadora", id] });
      toast.success("Nombre de la escuela y CUE actualizados por auditoría.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (ctx && !ctx.esAuditor) {
    return (
      <AppShell titulo="Auditoría" descripcion="Acceso reservado a la auditoría.">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="font-serif">Sin permisos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu cuenta no tiene permisos de auditoría para ver este libro.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const volver = (
    <Button asChild variant="outline" size="sm">
      <Link to="/auditoria">
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver
      </Link>
    </Button>
  );

  if (coop.isLoading) {
    return (
      <AppShell titulo="Cargando libro…" acciones={volver}>
        <p className="text-sm text-muted-foreground">Buscando la cooperadora…</p>
      </AppShell>
    );
  }

  if (!coop.data) {
    return (
      <AppShell titulo="Cooperadora no encontrada" acciones={volver}>
        <p className="text-sm text-muted-foreground">
          No encontramos esa cooperadora o no tenés acceso a sus datos.
        </p>
      </AppShell>
    );
  }

  const c = coop.data;
  const datos = datosInstitucionales.data;
  const historial = historialInstitucional.data ?? [];
  const autoridades = comision.data ?? [];
  const historialAutoridades = historialComision.data ?? [];
  const datosConcesion = concesion.data;
  const historialConcesionData = historialConcesion.data ?? [];

  const iniciarEdicionIdentificacion = () => {
    setNombre(c.nombre ?? "");
    setCue(c.cue ?? "");
    setEditandoIdentificacion(true);
  };

  return (
    <AppShell
      titulo={c.nombre}
      descripcion={[c.localidad, c.cue ? `CUE ${c.cue}` : null, `Ejercicio ${c.ejercicio}`]
        .filter(Boolean)
        .join(" · ")}
      acciones={volver}
    >
      <details className="mb-6 rounded-sm border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Datos institucionales
            </span>
            <span className="text-xs font-normal text-muted-foreground">Ver información</span>
          </span>
        </summary>
        <div className="border-t border-border p-4">
          {!datos ? (
            <p className="text-sm text-muted-foreground">Cargando datos institucionales…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {editandoIdentificacion ? (
                <>
                  <div className="space-y-2 lg:col-span-3"><Label htmlFor="auditoria-nombre">Nombre de la escuela</Label><Input id="auditoria-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="auditoria-cue">CUE</Label><Input id="auditoria-cue" inputMode="numeric" value={cue} onChange={(e) => setCue(e.target.value.replace(/\D/g, ""))} /></div>
                  <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                    <Button onClick={() => actualizarIdentificacion.mutate()} disabled={actualizarIdentificacion.isPending}>
                      {actualizarIdentificacion.isPending ? "Guardando…" : "Autorizar y guardar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditandoIdentificacion(false)} disabled={actualizarIdentificacion.isPending}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <DatoInstitucional titulo="Nombre de la escuela" valor={c.nombre} className="lg:col-span-3" />
                  <DatoInstitucional titulo="CUE" valor={c.cue ?? ""} />
                </>
              )}
              <DatoInstitucional titulo="Nivel" valor={datos.nivel} />
              <DatoInstitucional titulo="Turno" valor={datos.turno} />
              <DatoInstitucional titulo="Localidad" valor={datos.localidad} />
              <DatoInstitucional titulo="Director/a" valor={datos.director_nombre} className="sm:col-span-2" />
              <DatoInstitucional titulo="Supervisor/a" valor={datos.supervisor_nombre} className="sm:col-span-2" />
              <DatoInstitucional titulo="Email oficial de Cooperadora" valor={datos.email_oficial} className="sm:col-span-2 lg:col-span-4" />
              {!editandoIdentificacion && (
                <div className="flex items-center justify-between border-t border-border pt-3 sm:col-span-2 lg:col-span-4">
                  <p className="text-xs text-muted-foreground">Nombre y CUE: solo modificables por auditoría.</p>
                  <Button variant="outline" size="sm" onClick={iniciarEdicionIdentificacion}>Autorizar modificación</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {historial.length > 0 && (
        <details className="mb-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones de datos institucionales</span>
              <span className="text-xs font-normal text-muted-foreground">{historial.length} registro{historial.length === 1 ? "" : "s"}</span>
            </span>
          </summary>
          <div className="border-t border-border p-4 space-y-2">
            {historial.map((registro) => (
              <div key={registro.id} className="flex flex-col gap-1 rounded-sm border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{registro.usuario_nombre}</p>
                  {registro.usuario_email && <p className="text-xs text-muted-foreground">{registro.usuario_email}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Users className="h-5 w-5 text-primary" /> Comisión Directiva
          </CardTitle>
          <CardDescription>Autoridades actualmente registradas por la cooperadora.</CardDescription>
        </CardHeader>
        <CardContent>
          {comision.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando comisión directiva…</p>
          ) : autoridades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay integrantes registrados.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {autoridades.map((miembro) => (
                <div key={miembro.cargo} className="rounded-sm border border-border px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">{ETIQUETAS_CARGO[miembro.cargo]}</p>
                  <p className="mt-1 font-medium">{miembro.nombre}</p>
                  {miembro.dni && <p className="text-xs text-muted-foreground">DNI {miembro.dni}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {historialAutoridades.length > 0 && (
        <details className="mb-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones de la Comisión Directiva</span>
              <span className="text-xs font-normal text-muted-foreground">
                {historialAutoridades.length} registro{historialAutoridades.length === 1 ? "" : "s"}
              </span>
            </span>
          </summary>
          <div className="space-y-2 border-t border-border p-4">
            {historialAutoridades.map((registro) => (
              <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                <summary className="cursor-pointer list-none text-sm">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{registro.usuario_nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}</span>
                    <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                  </span>
                </summary>
                <div className="mt-3 grid gap-1 border-t border-border pt-3 text-xs sm:grid-cols-2">
                  {registro.miembros.map((miembro) => (
                    <div key={miembro.cargo} className="rounded-sm bg-secondary/40 px-2 py-1.5">
                      <span className="font-medium">{ETIQUETAS_CARGO[miembro.cargo]}:</span>{" "}
                      {miembro.nombre}{miembro.dni ? ` · DNI ${miembro.dni}` : ""}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Store className="h-5 w-5 text-primary" /> Concesión de Kioscos y Cantinas
          </CardTitle>
          <CardDescription>Datos del concesionario, canon y documentación respaldatoria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {concesion.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando datos de concesión…</p>
          ) : !datosConcesion ? (
            <p className="text-sm text-muted-foreground">No hay datos de concesión registrados.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <DatoInstitucional titulo="Apellido" valor={datosConcesion.apellido} />
              <DatoInstitucional titulo="Nombre" valor={datosConcesion.nombre} />
              <DatoInstitucional titulo="Canon" valor={money(num(datosConcesion.canon))} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <DocumentoAuditoria
              titulo="Contrato de concesión"
              documento={contrato.data}
              onOpen={() => abrirDocumentoConcesion(id, "contrato").catch((error: Error) => toast.error(error.message))}
            />
            <DocumentoAuditoria
              titulo="Certificado de buena conducta"
              documento={buenaConducta.data}
              onOpen={() => abrirDocumentoConcesion(id, "buena_conducta").catch((error: Error) => toast.error(error.message))}
            />
          </div>
        </CardContent>
      </Card>

      {historialConcesionData.length > 0 && (
        <details className="mb-6 rounded-sm border border-border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-secondary/50">
            <span className="flex items-center justify-between gap-3">
              <span>Historial de modificaciones de la concesión</span>
              <span className="text-xs font-normal text-muted-foreground">{historialConcesionData.length} registro{historialConcesionData.length === 1 ? "" : "s"}</span>
            </span>
          </summary>
          <div className="space-y-2 border-t border-border p-4">
            {historialConcesionData.map((registro) => (
              <details key={registro.id} className="rounded-sm border border-border px-3 py-2">
                <summary className="cursor-pointer list-none text-sm">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{registro.datos.apellido}, {registro.datos.nombre}{registro.usuario_email ? ` · ${registro.usuario_email}` : ""}</span>
                    <span className="text-xs text-muted-foreground">{new Date(registro.modificado_en).toLocaleString("es-AR")}</span>
                  </span>
                </summary>
                <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                  <DatoInstitucional titulo="Apellido" valor={registro.datos.apellido} />
                  <DatoInstitucional titulo="Nombre" valor={registro.datos.nombre} />
                  <DatoInstitucional titulo="Canon" valor={money(num(registro.datos.canon))} />
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      <LibroMensual cooperadora={c} soloLectura mesInicial={mes} />
    </AppShell>
  );
}

function DatoInstitucional({ titulo, valor, className = "" }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-sm border border-border bg-card px-3 py-2 ${className}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor || "No informado"}</p>
    </div>
  );
}

function DocumentoAuditoria({
  titulo,
  documento,
  onOpen,
}: {
  titulo: string;
  documento: { nombreArchivo: string; tamano: number; actualizadoEn: string } | null | undefined;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-sm border border-border bg-secondary/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      {documento ? (
        <>
          <p className="mt-1 break-all text-sm font-medium">{documento.nombreArchivo}</p>
          <p className="mt-1 text-xs text-muted-foreground">Actualizado: {new Date(documento.actualizadoEn).toLocaleString("es-AR")}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={onOpen}>
            <FileText className="mr-2 h-4 w-4" /> Ver PDF
          </Button>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No cargado.</p>
      )}
    </div>
  );
}
