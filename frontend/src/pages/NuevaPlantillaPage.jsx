import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";
import { ArrowUpOnSquareIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

export default function NuevaPlantillaPage() {
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.get("categorias/").then(r => setCategorias(r.data)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!categoriaId || !nombre || !archivo) return;
    setLoading(true);
    const fd = new FormData(); fd.append("categoria", categoriaId); fd.append("nombre", nombre); fd.append("archivo", archivo);
    try { await api.post("upload-plantilla/", fd, { headers: { "Content-Type": "multipart/form-data" } }); setTimeout(() => navigate("/index"), 1000); }
    catch { navigate("/nueva-plantilla"); } finally { setLoading(false); }
  };

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light transition";

  return (
    <div className="min-h-screen flex flex-col bg-surface dark:bg-dark-bg">
      <Navbar />
      <div className="flex justify-center items-start mt-12 px-4 pb-10">
        <div className="w-full max-w-md bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
            <div className="w-10 h-10 rounded-lg bg-primary dark:bg-primary-light flex items-center justify-center shrink-0">
              <DocumentTextIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Subir Plantilla</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Carga una plantilla documental (.docx)</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Categoría</label>
              <select className={inputCls} value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required>
                <option value="">Seleccione una categoría...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nombre de la plantilla</label>
              <input type="text" className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Archivo (.docx)</label>
              <input type="file" accept=".docx"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark dark:file:bg-primary-light dark:hover:file:bg-blue-500 transition"
                onChange={e => setArchivo(e.target.files[0])} required />
            </div>
            <button type="submit" disabled={loading}
              className={`w-full flex justify-center items-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition shadow-sm ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-blue-500"}`}>
              {loading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg> Subiendo...</>
                : <><ArrowUpOnSquareIcon className="w-4 h-4" /> Subir plantilla</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
