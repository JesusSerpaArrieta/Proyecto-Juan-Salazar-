import { useEffect, useState } from "react";
import api from "../api/api";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import {
  PencilIcon, TrashIcon, MagnifyingGlassIcon, DocumentTextIcon,
  ChevronLeftIcon, ChevronRightIcon, FolderIcon, PlusCircleIcon,
  ArrowUpTrayIcon, FolderOpenIcon,
} from "@heroicons/react/24/outline";

const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light transition";
const readOnlyCls = "w-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 rounded-lg px-3 py-2.5 text-sm cursor-not-allowed";
const readOnlyFields = ["area_libre_cara","tiempo_vigencia_num","tiempo_vigencia_texto","UVT","UVT_mul","ppto_minimo","impuesto"];

function limpiarNombre(n) {
  return n.replace(/_cara_num|_cara|_num|_liqui/gi,"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase()).replace("Anio","Año").trim();
}

function agrupar(valores) {
  const g = {"Datos del solicitante":[],"Datos del trámite":[],"Datos de la resolución":[],"Datos del predio":[],"Características del predio":[],"Datos del jefe de obra":[],"Datos para liquidación":[],"Otros":[]};
  Object.entries(valores).forEach(([key, value]) => {
    const n = key.toLowerCase();
    if (n.startsWith("por") || n.includes("texto")) return;
    if (n.endsWith("_liqui") || ["uvt","uvt_mul","ppto_minimo","impuesto","tarifa"].includes(n)) g["Datos para liquidación"].push([key,value]);
    else if (n.includes("solicitante")) g["Datos del solicitante"].push([key,value]);
    else if (n.includes("fecha")||n.includes("radicado")||n.includes("tiempo_vigencia")) g["Datos del trámite"].push([key,value]);
    else if (n.includes("resolucion")) g["Datos de la resolución"].push([key,value]);
    else if (n.includes("predio")||n.includes("catastro")||n.includes("matricula_inmobiliaria")) g["Datos del predio"].push([key,value]);
    else if (n.includes("area")||n.includes("tipo_zona")||n.includes("tipo_construccion")) g["Características del predio"].push([key,value]);
    else if (n.includes("jefe_obra")||n.includes("ocupacion")||n.includes("matricula_prof")) g["Datos del jefe de obra"].push([key,value]);
    else g["Otros"].push([key,value]);
  });
  const orden = ["tarifa_liqui","uvt","uvt_mul","ppto_minimo","impuesto"];
  g["Datos para liquidación"].sort((a,b)=>orden.indexOf(a[0].toLowerCase())-orden.indexOf(b[0].toLowerCase()));
  return g;
}

export default function DashboardPage() {
  const [categorias, setCategorias] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editData, setEditData] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [fechaError, setFechaError] = useState("");
  const [areaError, setAreaError] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [plantillas, setPlantillas] = useState([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("categorias/").then(r=>setCategorias(r.data)).catch(()=>setCategorias([]));
    api.get("archivos-generados/").then(r=>setArchivos(r.data)).catch(()=>setArchivos([]));
  }, []);

  const filtered = archivos.filter(a => {
    const n = a.nombre_archivo?.toLowerCase()||"", p = a.plantilla_nombre?.toLowerCase()||"";
    return n.includes(search.toLowerCase()) || p.includes(search.toLowerCase());
  });
  const perPage = 8, totalPages = Math.ceil(filtered.length/perPage), start = (page-1)*perPage;
  const current = filtered.slice(start, start+perPage);

  const handleSelectCategoria = async (cat) => {
    setSelectedCategoria(cat); setSelectedPlantilla(null); setArchivos([]);
    try { const r = await api.get(`categorias/${cat.id}/plantillas/`); setPlantillas(r.data); } catch { setPlantillas([]); }
  };
  const handleSelectPlantilla = async (p) => {
    setSelectedPlantilla(p);
    try { const r = await api.get(`plantillas/${p.id}/archivos/`); setArchivos(r.data); } catch { setArchivos([]); }
  };
  const handleDescargar = async (archivo) => {
    try {
      const res = await api.get(`archivo/${archivo.id}/descargar/`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${archivo.nombre_archivo}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert("No se pudo descargar el archivo."); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este archivo?")) return;
    try { await api.delete(`archivo/${id}/eliminar/`); setArchivos(p=>p.filter(a=>a.id!==id)); } catch { alert("Error al eliminar."); }
  };

  const fechaBackendAISO = s => {
    if (!s) return "";
    const meses = {enero:"01",febrero:"02",marzo:"03",abril:"04",mayo:"05",junio:"06",julio:"07",agosto:"08",septiembre:"09",octubre:"10",noviembre:"11",diciembre:"12"};
    const m = s.match(/(\d{1,2}) de (\w+) de (\d{4})/i);
    if (!m) return "";
    return `${m[3]}-${meses[m[2].toLowerCase()]}-${m[1].padStart(2,"0")}`;
  };
  const fechaISOABackend = s => {
    if (!s) return "";
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const [y,m,d] = s.split("-");
    return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
  };

  const handleEdit = async (archivo) => {
    try {
      const r = await api.get(`documento/${archivo.documento}/editar/`);
      const datos = r.data.datos||{};
      if (datos.fecha_radicacion) datos.fecha_radicacion = fechaBackendAISO(datos.fecha_radicacion);
      setEditData({...r.data, id:archivo.documento}); setEditValues(datos);
    } catch { alert("Error al cargar datos."); }
  };
  const handleSaveEdit = async () => {
    if (fechaError||areaError) { alert("Corrige los errores antes de guardar."); return; }
    const d = {...editValues};
    if (d.fecha_radicacion) d.fecha_radicacion = fechaISOABackend(d.fecha_radicacion);
    try {
      await api.put(`documento/${editData.id}/editar/`, { datos: d });
      alert("Datos actualizados correctamente.");
      setEditData(null); setEditValues({});
    } catch { alert("Error al guardar."); }
  };

  useEffect(() => {
    const total=parseFloat(editValues.area_lote_cara_num||0), cons=parseFloat(editValues.area_construccion_cara||0);
    if (cons>total) { setAreaError("El área de construcción no puede ser mayor que el área total."); setEditValues(p=>({...p,area_construccion_cara:total})); return; }
    setAreaError(""); const libre=total-cons;
    if (!isNaN(libre)&&libre>=0) setEditValues(p=>({...p,area_libre_cara:libre}));
  },[editValues.area_lote_cara_num,editValues.area_construccion_cara]);

  useEffect(() => {
    const exp=editValues.fecha_expedicion||"", ven=editValues.fecha_vencimiento||"";
    if (!exp||!ven) { setFechaError(""); setEditValues(p=>({...p,tiempo_vigencia_num:"",tiempo_vigencia_texto:""})); return; }
    if (ven<exp) { setFechaError("La fecha de vencimiento no puede ser anterior a la de expedición."); setEditValues(p=>({...p,tiempo_vigencia_num:"",tiempo_vigencia_texto:""})); return; }
    setFechaError("");
    const [ey,em]=exp.split("-").map(Number),[vy,vm]=ven.split("-").map(Number);
    const totalMeses=(vy-ey)*12+(vm-em);
    const u=["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince"];
    const toText=n=>{ if(n<16)return u[n]; if(n<20)return"dieci"+u[n-10]; if(n===20)return"veinte"; if(n<30)return"veinti"+u[n-20]; const dec=["","","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"]; const d=Math.floor(n/10),r=n%10; return dec[d]+(r?" y "+u[r]:""); };
    setEditValues(p=>({...p,tiempo_vigencia_num:totalMeses,tiempo_vigencia_texto:`${toText(totalMeses)} meses`}));
  },[editValues.fecha_expedicion,editValues.fecha_vencimiento]);

  useEffect(() => {
    const estrato=(editValues.estrato_o_destino_liqui||"").toString().toLowerCase().trim();
    const area=parseFloat(editValues.area_lote_cara_num||0), tarifa=parseFloat(editValues.tarifa_liqui||0);
    let UVT=0;
    if(estrato==="1")UVT=3; else if(estrato==="2")UVT=6; else if(estrato==="3")UVT=9;
    else if(["4","5","6"].includes(estrato))UVT=15; else if(estrato==="institucional")UVT=15;
    else if(estrato==="comercial")UVT=25; else if(estrato==="industrial")UVT=20;
    else if(estrato==="servicios")UVT=30; else if(estrato==="turisticas")UVT=20;
    const UVT_mul=Math.round(UVT*49799/1000)*1000;
    const fmt=new Intl.NumberFormat("es-CO",{minimumFractionDigits:0,maximumFractionDigits:0});
    setEditValues(p=>({...p,UVT,UVT_mul:fmt.format(UVT_mul),ppto_minimo:fmt.format(area*UVT_mul),impuesto:fmt.format(area*UVT_mul*tarifa)}));
  },[editValues.estrato_o_destino_liqui,editValues.area_lote_cara_num,editValues.tarifa_liqui]);

  return (
    <div className="min-h-screen flex flex-col bg-surface dark:bg-dark-bg text-gray-900 dark:text-gray-100">
      <Navbar />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── PANEL IZQUIERDO ── */}
          <section className="lg:w-2/3 bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            {/* Header card */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FolderOpenIcon className="w-5 h-5 text-primary dark:text-primary-light" />
                Archivos Generados
              </h2>
              {selectedPlantilla && (
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input type="text" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg pl-9 pr-3 py-2 w-48 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light" />
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Nivel 1: Categorías */}
              {!selectedCategoria && (
                <>
                  {categorias.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                      <FolderIcon className="w-12 h-12 mb-3 opacity-40" />
                      <p className="text-sm">No hay categorías registradas</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {categorias.map(cat => (
                        <button key={cat.id} onClick={()=>handleSelectCategoria(cat)}
                          className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg hover:border-primary dark:hover:border-primary-light hover:shadow-md transition-all duration-200 text-left w-full">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 group-hover:bg-primary dark:group-hover:bg-primary-light transition-colors">
                            <FolderIcon className="w-5 h-5 text-primary dark:text-primary-light group-hover:text-white transition-colors" />
                          </div>
                          <span className="font-medium text-sm text-gray-800 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-primary-light transition-colors">{cat.nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Nivel 2: Plantillas */}
              {selectedCategoria && !selectedPlantilla && (
                <div>
                  <button onClick={()=>setSelectedCategoria(null)}
                    className="flex items-center gap-1.5 text-sm text-primary dark:text-primary-light hover:underline mb-5 font-medium">
                    <ChevronLeftIcon className="w-4 h-4" /> Volver a categorías
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-medium uppercase tracking-wide">{selectedCategoria.nombre} / Plantillas</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {plantillas.map(p => (
                      <button key={p.id} onClick={()=>handleSelectPlantilla(p)}
                        className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg hover:border-primary dark:hover:border-primary-light hover:shadow-md transition-all duration-200 text-left w-full">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 group-hover:bg-primary dark:group-hover:bg-primary-light transition-colors">
                          <DocumentTextIcon className="w-5 h-5 text-primary dark:text-primary-light group-hover:text-white transition-colors" />
                        </div>
                        <span className="font-medium text-sm text-gray-800 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-primary-light transition-colors">{p.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nivel 3: Archivos */}
              {selectedPlantilla && (
                <div>
                  <button onClick={()=>setSelectedPlantilla(null)}
                    className="flex items-center gap-1.5 text-sm text-primary dark:text-primary-light hover:underline mb-5 font-medium">
                    <ChevronLeftIcon className="w-4 h-4" /> Volver a plantillas
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-medium uppercase tracking-wide">{selectedPlantilla.nombre} / Archivos</p>

                  {archivos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                      <DocumentTextIcon className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-sm">No hay archivos generados</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {current.map(archivo => (
                        <li key={archivo.id} className="group flex justify-between items-center py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                          <div className="min-w-0 flex-1 mr-3">
                            <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{archivo.nombre_archivo}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{new Date(archivo.fecha_creacion).toLocaleString()} · <span className="italic">{archivo.plantilla_nombre}</span></p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={()=>handleDescargar(archivo)} title="Descargar" className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                              <DocumentTextIcon className="w-4 h-4 text-primary dark:text-primary-light" />
                            </button>
                            <button onClick={()=>handleEdit(archivo)} title="Editar y descargar" className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors">
                              <PencilIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            </button>
                            <button onClick={()=>handleDelete(archivo.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                              <TrashIcon className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center mt-5 gap-3">
                      <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                        <ChevronLeftIcon className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Página {page} de {totalPages}</span>
                      <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── PANEL DERECHO ── */}
          <aside className="lg:w-1/3 flex flex-col gap-4">
            {/* Categorías */}
            <div className="bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                  <FolderIcon className="w-4 h-4 text-primary dark:text-primary-light" /> Categorías
                </h2>
              </div>
              <div className="p-4">
                {categorias.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No hay categorías</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {categorias.map(cat => (
                      <button key={cat.id} onClick={()=>navigate(`/categoria/${cat.id}`)}
                        className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-transparent hover:border-primary/20 dark:hover:border-primary-light/20 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary-light transition-all duration-200 text-left w-full">
                        <FolderIcon className="w-4 h-4 text-gray-400 group-hover:text-primary dark:group-hover:text-primary-light transition-colors shrink-0" />
                        {cat.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Administración */}
            <div className="bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Administración</h3>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <button onClick={()=>navigate("/nueva-categoria")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors shadow-sm">
                  <PlusCircleIcon className="w-4 h-4" /> Nueva categoría
                </button>
                <button onClick={()=>navigate("/nueva-plantilla")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-sm font-semibold transition-colors">
                  <ArrowUpTrayIcon className="w-4 h-4" /> Subir plantilla
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ── MODAL EDICIÓN ── */}
      {editData && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 overflow-auto">
          <div className="bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-card dark:bg-dark-card z-10">
              <div className="w-8 h-8 rounded-lg bg-primary dark:bg-primary-light flex items-center justify-center shrink-0">
                <PencilIcon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Editar documento</h3>
            </div>

            <div className="p-6 space-y-6">
              {Object.keys(editValues).length === 0 ? (
                <p className="text-sm text-gray-500">No hay datos para editar.</p>
              ) : (
                Object.entries(agrupar(editValues)).map(([titulo, vars]) => vars.length > 0 ? (
                  <div key={titulo}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                      <span className="text-xs font-semibold text-primary dark:text-primary-light uppercase tracking-widest px-2 whitespace-nowrap">{titulo}</span>
                      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {vars.map(([key, value]) => {
                        const n = key.toLowerCase();
                        let field = (
                          <input
                            type={n.includes("fecha")?"date":n.includes("area")||n.includes("num")||n.includes("vigencia")?"number":"text"}
                            value={value||""} readOnly={readOnlyFields.includes(key)}
                            onChange={e=>setEditValues({...editValues,[key]:e.target.value})}
                            className={readOnlyFields.includes(key)?readOnlyCls:inputCls} />
                        );
                        if (n==="tarifa_liqui") field=(
                          <select value={editValues.tarifa_liqui||""} onChange={e=>setEditValues({...editValues,tarifa_liqui:e.target.value})} className={inputCls}>
                            <option value="">Selecciona tarifa</option>
                            <option value="0.015">1.5%</option><option value="0.02">2%</option>
                          </select>
                        );
                        if (n==="estrato_o_destino_liqui") field=(
                          <select value={editValues.estrato_o_destino_liqui||""} onChange={e=>setEditValues({...editValues,estrato_o_destino_liqui:e.target.value})} className={inputCls}>
                            <option value="">Selecciona estrato o destino</option>
                            <optgroup label="Estratos residenciales">{["1","2","3","4","5","6"].map(n=><option key={n} value={n}>Estrato {n}</option>)}</optgroup>
                            <optgroup label="Destinos especiales">
                              <option value="institucional">Institucional</option><option value="comercial">Comercial</option>
                              <option value="industrial">Industrial</option><option value="servicios">Servicios</option><option value="turisticas">Turísticas</option>
                            </optgroup>
                          </select>
                        );
                        return (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{limpiarNombre(key)}</label>
                            {field}
                            {key==="fecha_vencimiento"&&fechaError&&<p className="text-xs text-red-500 mt-1">{fechaError}</p>}
                            {key==="area_construccion_cara"&&areaError&&<p className="text-xs text-red-500 mt-1">{areaError}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null)
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-card dark:bg-dark-card">
              <button onClick={()=>{setEditData(null);setEditValues({});}}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={!!(fechaError||areaError)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${fechaError||areaError?"bg-gray-400 cursor-not-allowed":"bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-blue-500"}`}>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
