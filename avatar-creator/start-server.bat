@echo off
title Avatar Creator Server
echo ============================================
echo   Avatar Creator - Local Server
echo ============================================
echo.
echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop
echo.
cd /d "%~dp0\.."
python -m http.server 8000
pause
