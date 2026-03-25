import { useState, useRef } from "react";
import api from "../api/api";
import Navbar from "../components/Navbar";
import {
  ArrowUpOnSquareIcon,
  DocumentTextIcon,
  TagIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const VARIABLES_SUGERIDAS = [
  "radicado", "nombre_solicitante", "cedula_solicitante",
  "direccion_predio", "tipo_construccion_predio", "tipo_zona_predio",
  "fecha_expedicion", "fecha_radicacion", "fecha_vencimiento",
  "resolucion", "anio", "matricula_inmobiliaria_predio",
  "ref_catastro_predio", "escritura_predio", "area_lote_cara_num",
  "area_lote_cara_texto", "area_construccion_cara", "area_libre_cara",
  "tiempo_vigencia_texto", "tiempo_vigencia_num",
  "nombre_jefe_obra", "ocupacion_jefe_obra", "matricula_prof_jefe_obra",
  "nombre_secretario", "cargo_secretario", "nombre_elaboro",
  "estrato_solicitante", "UVT", "ppto_minimo", "tarifa", "impuesto",
];

export default function ConversorPage() {
  const [archivo, setArchivo] = useState(null);
  const [segmentos, setSegmentos] = useState([]);
  const [mapeo, setMapeo] = useState({}); // { texto_original: nombre_variable }
  const [seleccionado, setSeleccionado] = useState(null); // segmento activo
  const [varInput, setVarInput] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [paso, setPaso] = useState(1); // 1=subir, 2=mapear, 3=listo
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f && f.name.endsWith(".docx")) setArchivo(f);
  };

  const analizar = async () => {
    if (!archivo) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("archivo", archivo);
    try {
      const res = await api.post("conversor/analizar/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSegmentos(res.data.segmentos);
      setMapeo({});
      setPaso(2);
    } catch (e) {
      alert("Error al analizar el documento");
    } finally {
      setLoading(false);
    }
  };

  const seleccionar = (seg) => {
    setSeleccionado(seg);
    setVarInput(mapeo[seg.texto] || "");
    setSugerencias([]);
  };

  const asignarVariable = (variable) => {
    if (!seleccionado || !variable.trim()) return;
    setMapeo((prev) => ({ ...prev, [seleccionado.texto]: variable.trim() }));
    setSeleccionado(null);
    setVarInput("");
    setSugerencias([]);
  };

  const quitarMapeo = (texto) => {
    setMapeo((prev) => {
      const next = { ...prev };
      delete next[texto];
      return next;
    });
  };

  const filtrarSugerencias = (val) => {
    setVarInput(val);
    if (val.length > 0) {
      setSugerencias(
        VARIABLES_SUGERIDAS.filter((v) =>
          v.includes(val.toLowerCase())
        ).slice(0, 6)
      );
    } else {
      setSugerencias([]);
    }
  };

  const generar = async () => {
    if (!archivo || Object.keys(mapeo).length === 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("mapeo", JSON.stringify(mapeo));
    try {
      const res = await api.post("conversor/generar/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo.name.replace(".docx", "-plantilla.docx");
      a.click();
      URL.revokeObjectURL(url);
      setPaso(3);
    } catch {
      alert("Error al generar la plantilla");
    } finally {
      setLoading(false);
    }
  };

  const reiniciar = () => {
    setArchivo(null);
    setSegmentos([]);
    setMapeo({});
    setSeleccionado(null);
    setVarInput("");
    setPaso(1);
  };

  const inputCls =
    "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition";

  return (
    <div className="min-h-screen flex flex-col bg-surface dark:bg-dark-bg">
      <Navbar />

      <div className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary dark:bg-primary-light flex items-center justify-center shrink-0">
            <DocumentTextIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Conversor de Plantillas
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sube un documento real, marca los datos variables y genera la plantilla
            </p>
          </div>
        </div>

        {/* Paso 1: Subir archivo */}
        {paso === 1 && (
          <div className="max-w-md mx-auto bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow p-8">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => inputRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition mb-5 ${
                drag
                  ? "border-primary bg-blue-50 dark:bg-blue-900/10"
                  : "border-gray-300 dark:border-gray-600 hover:border-primary"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <ArrowUpOnSquareIcon className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Arrastra tu <span className="font-semibold">.docx</span> aquí o haz clic
              </p>
              {archivo && (
                <p className="mt-2 text-sm text-primary dark:text-primary-light font-semibold">
                  {archivo.name}
                </p>
              )}
            </div>
            <button
              onClick={analizar}
              disabled={!archivo || loading}
              className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <DocumentTextIcon className="w-4 h-4" />
              )}
              {loading ? "Analizando..." : "Analizar documento"}
            </button>
          </div>
        )}

        {/* Paso 2: Mapear variables */}
        {paso === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Panel izquierdo: segmentos */}
            <div className="lg:col-span-2 bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Contenido del documento
                </span>
                <span className="text-xs text-gray-400">
                  Haz clic en un texto para asignarle una variable
                </span>
              </div>
              <div className="p-4 space-y-1.5 max-h-[60vh] overflow-y-auto">
                {segmentos.map((seg) => {
                  const mapeado = mapeo[seg.texto];
                  const activo = seleccionado?.id === seg.id;
                  return (
                    <div
                      key={seg.id}
                      onClick={() => seleccionar(seg)}
                      className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                        activo
                          ? "bg-primary/10 dark:bg-primary-light/10 border border-primary dark:border-primary-light"
                          : mapeado
                          ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                      }`}
                    >
                      <span className="flex-1 text-gray-800 dark:text-gray-200 break-words leading-relaxed">
                        {seg.texto}
                      </span>
                      {mapeado && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-mono bg-primary/10 dark:bg-primary-light/10 text-primary dark:text-primary-light px-2 py-0.5 rounded-full">
                            {"{{"}{mapeado}{"}}"}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); quitarMapeo(seg.texto); }}
                            className="text-gray-400 hover:text-red-500 transition"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel derecho: asignar variable */}
            <div className="space-y-4">
              {/* Asignar variable al seleccionado */}
              <div className="bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <TagIcon className="w-4 h-4" /> Asignar variable
                </p>
                {seleccionado ? (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Texto seleccionado:</p>
                    <p className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-1.5 mb-3 text-gray-700 dark:text-gray-300 break-words line-clamp-3">
                      {seleccionado.texto}
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="nombre_variable"
                        value={varInput}
                        onChange={(e) => filtrarSugerencias(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && asignarVariable(varInput)}
                        autoFocus
                      />
                      {sugerencias.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                          {sugerencias.map((s) => (
                            <button
                              key={s}
                              onClick={() => asignarVariable(s)}
                              className="w-full text-left px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => asignarVariable(varInput)}
                      disabled={!varInput.trim()}
                      className="mt-2 w-full py-2 rounded-lg bg-primary hover:bg-primary-dark dark:bg-primary-light text-white text-sm font-semibold disabled:opacity-40 transition"
                    >
                      Asignar
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                    Selecciona un texto del documento
                  </p>
                )}
              </div>

              {/* Resumen del mapeo */}
              <div className="bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Variables asignadas ({Object.keys(mapeo).length})
                </p>
                {Object.keys(mapeo).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Ninguna aún</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {Object.entries(mapeo).map(([texto, variable]) => (
                      <div key={texto} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-primary dark:text-primary-light truncate">
                          {"{{"}{variable}{"}}"}
                        </span>
                        <button
                          onClick={() => quitarMapeo(texto)}
                          className="text-gray-400 hover:text-red-500 shrink-0 transition"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <button
                onClick={generar}
                disabled={Object.keys(mapeo).length === 0 || loading}
                className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
              >
                {loading ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowDownTrayIcon className="w-4 h-4" />
                )}
                {loading ? "Generando..." : "Generar plantilla"}
              </button>
              <button
                onClick={reiniciar}
                className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        )}

        {/* Paso 3: Listo */}
        {paso === 3 && (
          <div className="max-w-md mx-auto bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow p-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              Plantilla generada
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              El archivo se descargó automáticamente. Ahora puedes subirlo en{" "}
              <span className="font-semibold">Nueva Plantilla</span>.
            </p>
            <button
              onClick={reiniciar}
              className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-dark dark:bg-primary-light text-white font-semibold text-sm transition"
            >
              Convertir otro documento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
