@echo off
title Iniciando Proyecto
echo ============================================
echo     INICIANDO PROYECTO PRACTICAS
echo ============================================

echo.
echo -> Iniciando backend (Django)...
REM Activar entorno virtual
call venv\Scripts\activate

REM Iniciar servidor Django en una ventana separada
start "Backend - Django" cmd /k "cd backend && python manage.py runserver"

echo.
echo -> Iniciando frontend (React)...
REM Iniciar React en una ventana separada
start "Frontend - React" cmd /k "cd frontend && npm run dev"

echo.
echo -> Abriendo el proyecto en el navegador...
start http://localhost:5173

echo.
echo ============================================
echo  El proyecto está listo para usarse.
echo  Puedes cerrar esta ventana.
echo ============================================

timeout /t 3 >nul
exit
