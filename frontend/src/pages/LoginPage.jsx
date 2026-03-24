import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import Navbar from "../components/Navbar";

export default function LoginPage() {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem("access")) navigate("/index");
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("login/", { username, password });
      sessionStorage.setItem("access", res.data.access);
      sessionStorage.setItem("refresh", res.data.refresh);
      navigate("/index");
    } catch {
      setError("Credenciales inválidas o usuario no encontrado.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light transition";

  return (
    <div className="min-h-screen flex flex-col bg-surface dark:bg-dark-bg">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="bg-card dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-8 w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-3 shadow">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Iniciar Sesión</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sistema de Documentación Municipal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Usuario</label>
              <input className={inputCls} placeholder="Ingresa tu usuario" value={username} onChange={e => setUser(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contraseña</label>
              <input type="password" className={inputCls} placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-blue-500 text-white py-2.5 rounded-lg font-semibold text-sm transition shadow-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Ingresando...
                </>
              ) : "Entrar"}
            </button>
            {error && <p className="text-xs text-red-500 text-center pt-1">{error}</p>}
          </form>

          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            ¿No estás registrado?{" "}
            <Link to="/register" className="font-semibold text-primary dark:text-primary-light hover:underline">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
