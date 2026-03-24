import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";
import { SparklesIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light transition";
const readOnlyCls = "w-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 rounded-lg px-3 py-2.5 text-sm cursor-not-allowed";
const readOnlyFields = ["area_libre_cara","tiempo_vigencia_num","tiempo_vigencia_texto","UVT","UVT_mul","ppto_minimo","impuesto"];

export default function CategoriaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState(null);
  const [variables, setVariables] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [fechaError, setFechaError] = useState("");
  const [areaError, setAreaError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const total = parseFloat(formData.area_lote_cara_num || 0);
    const cons = parseFloat(formData.area_construccion_cara || 0);
    if (cons > total) { setAreaError("El área de construcción no puede ser mayor que el área total."); setFormData(p => ({ ...p, area_construccion_cara: total })); return; }
    setAreaError("");
    const libre = total - cons;
    if (!isNaN(libre) && libre >= 0) setFormData(p => ({ ...p, area_libre_cara: libre }));
  }, [formData.area_lote_cara_num, formData.area_construccion_cara]);

  useEffect(() => {
    const exp = formData.fecha_expedicion || "", ven = formData.fecha_vencimiento || "";
    if (!exp || !ven) { setFechaError(""); setFormData(p => ({ ...p, tiempo_vigencia_num: "", tiempo_vigencia_texto: "" })); return; }
    if (exp.length !== 10 || ven.length !== 10) return;
    if (ven < exp) { setFechaError("La fecha de vencimiento no puede ser anterior a la fecha de expedición."); setFormData(p => ({ ...p, tiempo_vigencia_num: "", tiempo_vigencia_texto: "" })); return; }
    setFechaError("");
    const [ey, em] = exp.split("-").map(Number), [vy, vm] = ven.split("-").map(Number);
    const totalMeses = (vy - ey) * 12 + (vm - em);
    const u = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince"];
    const toText = n => { if (n < 16) return u[n]; if (n < 20) return "dieci" + u[n - 10]; if (n === 20) return "veinte"; if (n < 30) return "veinti" + u[n - 20]; const dec = ["","","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"]; const d = Math.floor(n / 10), r = n % 10; return dec[d] + (r ? " y " + u[r] : ""); };
    setFormData(p => ({ ...p, tiempo_vigencia_num: totalMeses, tiempo_vigencia_texto: `${toText(totalMeses)} meses` }));
  }, [formData.fecha_expedicion, formData.fecha_vencimiento]);

  useEffect(() => {
    const estrato = (formData.estrato_o_destino_liqui || "").toString().toLowerCase().trim();
    const area = parseFloat(formData.area_construccion_cara || 0), tarifa = parseFloat(formData.tarifa_liqui || 0);
    let UVT = 0;
    if (estrato === "1") UVT = 3; else if (estrato === "2") UVT = 6; else if (estrato === "3") UVT = 9;
    else if (["4","5","6"].includes(estrato)) UVT = 15; else if (estrato === "institucional") UVT = 15;
    else if (estrato === "comercial") UVT = 25; else if (estrato === "industrial") UVT = 20;
    else if (estrato === "servicios") UVT = 30; else if (estrato === "turisticas") UVT = 20;
    const UVT_mul = Math.round(UVT * 49799 / 1000) * 1000;
    const fmt = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    setFormData(p => ({ ...p, UVT, UVT_mul: fmt.format(UVT_mul), ppto_minimo: fmt.format(area * UVT_mul), impuesto: fmt.format(area * UVT_mul * tarifa) }));
  }, [formData.estrato_o_destino_liqui, formData.area_construccion_cara, formData.tarifa_liqui]);

  useEffect(() => {
    api.get(`categorias/${id}/`).then(r => setCategoria(r.data));
    api.get(`variables/?categoria=${id}`).then(r => setVariables(r.data));
  }, [id]);

  const formatearFecha = (iso) => {
    if (!iso) return "";
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const [y, m, d] = iso.split("-");
    return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const d = { ...formData };
    if (d.fecha_radicacion) d.fecha_radicacion = formatearFecha(d.fecha_radicacion);
    try {
      const res = await api.post("generar-categoria/", { categoria: id, datos: d }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="(.+)"/);
      link.setAttribute("download", match ? match[1] : "documentos.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast("Documentos generados y descargados correctamente.");
      setTimeout(() => { setToast(""); navigate("/index"); }, 2500);
    } catch (err) { console.error(err); alert("Error al generar los documentos."); }
    finally { setLoading(false); }
  };

  const filtrar = vars => vars.filter(v => { const n = v.nombre_variable.toLowerCase(); return !n.startsWith("por") && !n.includes("texto"); });

  const agrupar = vars => {
    const g = { "Datos del solicitante":[], "Datos del trámite":[], "Datos de la resolución":[], "Datos del predio":[], "Características del predio":[], "Datos del jefe de obra":[], "Datos para liquidación":[], "Otros":[] };
    filtrar(vars).forEach(v => {
      const n = v.nombre_variable.toLowerCase();
      if (n.endsWith("_liqui") || ["uvt","uvt_mul","ppto_minimo","impuesto","tarifa"].includes(n)) g["Datos para liquidación"].push(v);
      else if (n.includes("solicitante")) g["Datos del solicitante"].push(v);
      else if (n.includes("fecha") || n.includes("radicado") || n.includes("tiempo_vigencia")) g["Datos del trámite"].push(v);
      else if (n.includes("resolucion")) g["Datos de la resolución"].push(v);
      else if (n.includes("predio") || n.includes("catastro") || n.includes("matricula_inmobiliaria")) g["Datos del predio"].push(v);
      else if (n.includes("area") || n.includes("tipo_zona") || n.includes("tipo_construccion")) g["Características del predio"].push(v);
      else if (n.includes("jefe_obra") || n.includes("ocupacion") || n.includes("matricula_prof")) g["Datos del jefe de obra"].push(v);
      else g["Otros"].push(v);
    });
    const orden = ["tarifa","uvt","uvt_mul","ppto_minimo","impuesto"];
    g["Datos para liquidación"].sort((a, b) => orden.indexOf(a.nombre_variable.toLowerCase()) - orden.indexOf(b.nombre_variable.toLowerCase()));
    return g;
  };

  const limpiar = n => n.replace(/_cara_num|_cara|_num|_liqui/gi, "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()).replace("Anio", "Año").trim();

  return (
    <div className="min-h-screen flex flex-col bg-surface dark:bg-dark-bg">
      <Navbar />
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {toast}
        </div>
      )}
      <div className="flex justify-center items-start mt-8 px-4 pb-10">
        <div className="w-full max-w-3xl bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl p-8">
          {!categoria ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Cargando categoría...</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-7 pb-5 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-lg bg-primary dark:bg-primary-light flex items-center justify-center shrink-0">
                  <SparklesIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Generar documentos: <span className="text-primary dark:text-primary-light">{categoria.nombre}</span>
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Complete los campos requeridos</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {Object.entries(agrupar(variables)).map(([titulo, vars]) => vars.length > 0 && (
                  <div key={titulo}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                      <span className="text-xs font-semibold text-primary dark:text-primary-light uppercase tracking-widest px-2 whitespace-nowrap">{titulo}</span>
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {vars.map(v => (
                        <div key={v.id}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {limpiar(v.nombre_variable)}{v.obligatoria && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {v.nombre_variable === "tarifa_liqui" ? (
                            <select className={inputCls} value={formData.tarifa_liqui || ""} onChange={e => setFormData(p => ({ ...p, tarifa_liqui: e.target.value }))} required>
                              <option value="">Selecciona una tarifa</option>
                              <option value="0.015">1.5%</option><option value="0.02">2%</option>
                            </select>
                          ) : v.nombre_variable === "estrato_o_destino_liqui" ? (
                            <select className={inputCls} value={formData.estrato_o_destino_liqui || ""} onChange={e => setFormData(p => ({ ...p, estrato_o_destino_liqui: e.target.value }))} required>
                              <option value="">Selecciona estrato o destino</option>
                              <optgroup label="Estratos residenciales">{["1","2","3","4","5","6"].map(n => <option key={n} value={n}>Estrato {n}</option>)}</optgroup>
                              <optgroup label="Destinos especiales">
                                <option value="institucional">Institucional</option><option value="comercial">Comercial</option>
                                <option value="industrial">Industrial</option><option value="servicios">Servicios</option><option value="turisticas">Turísticas</option>
                              </optgroup>
                            </select>
                          ) : (
                            <input
                              type={v.tipo_dato === "date" ? "date" : v.tipo_dato === "number" ? "number" : "text"}
                              className={readOnlyFields.includes(v.nombre_variable) ? readOnlyCls : inputCls}
                              value={formData[v.nombre_variable] || ""}
                              onChange={e => setFormData(p => ({ ...p, [v.nombre_variable]: e.target.value }))}
                              required={v.obligatoria}
                              readOnly={readOnlyFields.includes(v.nombre_variable)}
                            />
                          )}
                          {v.nombre_variable === "fecha_vencimiento" && fechaError && <p className="text-xs text-red-500 mt-1">{fechaError}</p>}
                          {v.nombre_variable === "area_construccion_cara" && areaError && <p className="text-xs text-red-500 mt-1">{areaError}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <button type="submit"
                    disabled={loading || fechaError !== "" || areaError !== "" || !formData.fecha_expedicion || !formData.fecha_vencimiento}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm text-white transition shadow-sm ${loading || fechaError || areaError ? "bg-gray-400 cursor-not-allowed" : "bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-blue-500"}`}>
                    {loading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Generando...</> : <><SparklesIcon className="w-4 h-4" /> Generar Documentos</>}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
