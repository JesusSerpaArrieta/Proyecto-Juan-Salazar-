import { Link, useNavigate } from "react-router-dom";
import { MoonIcon, SunIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useTheme } from "../context/ThemeContext";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isLogged, setIsLogged] = useState(false);

  useEffect(() => {
    setIsLogged(!!sessionStorage.getItem("access"));
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("access");
    sessionStorage.removeItem("refresh");
    setIsLogged(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-primary dark:bg-dark-card border-b border-blue-800 dark:border-blue-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center gap-4">

        {/* Logo + nombre */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="https://pbs.twimg.com/profile_images/691661000597200897/nOj5fUnN.jpg"
            alt="Escudo Alcaldía de Sampués"
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <Link to="/index">
              <p className="font-bold text-white text-sm sm:text-base leading-tight hover:text-blue-200 transition truncate">
                SisDoc — Alcaldía Municipal
              </p>
            </Link>
            <p className="text-blue-300 text-xs hidden sm:block">Sistema de Documentación</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {[
            { to: "/index", label: "Inicio" },
            ...(isLogged ? [
              { to: "/nueva-categoria", label: "Nueva categoría" },
              { to: "/nueva-plantilla", label: "Subir plantilla" },
              { to: "/conversor", label: "Conversor" },
            ] : []),
          ].map(({ to, label }) => (
            <Link key={to} to={to}
              className="px-3 py-1.5 rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition font-medium">
              {label}
            </Link>
          ))}
        </nav>

        {/* Acciones */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleTheme} aria-label="Cambiar tema"
            className="p-2 rounded-lg hover:bg-white/10 transition text-blue-200 hover:text-white">
            {theme === "dark"
              ? <SunIcon className="w-5 h-5" />
              : <MoonIcon className="w-5 h-5" />}
          </button>
          {isLogged && (
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/50 text-red-300 hover:bg-red-500/20 hover:border-red-400 transition text-sm font-medium">
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
