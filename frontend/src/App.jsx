import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import CategoriaPage from "./pages/CategoriaPage";
import NuevaCategoriaPage from "./pages/NuevaCategoriaPage";
import NuevaPlantillaPage from "./pages/NuevaPlantillaPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  useEffect(() => {
    document.title = "SisDoc"; // Título global
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        {/* Páginas públicas */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Páginas protegidas */}
        <Route
          path="/index"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categoria/:id"
          element={
            <ProtectedRoute>
              <CategoriaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nueva-categoria"
          element={
            <ProtectedRoute>
              <NuevaCategoriaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nueva-plantilla"
          element={
            <ProtectedRoute>
              <NuevaPlantillaPage />
            </ProtectedRoute>
          }
        />

        {/* Cualquier ruta no válida redirige al login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
