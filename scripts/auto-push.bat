@echo off
setlocal
title Auto Push - BK MTsN 2 Trenggalek
cd /d "%~dp0"

echo ============================================================
echo  AUTO PUSH - BK MTsN 2 Trenggalek
echo ------------------------------------------------------------
echo  Jendela ini memantau perubahan file.
echo  Setiap kali Anda menyimpan file:
echo    1. sintaks JavaScript diperiksa
echo    2. perubahan di-commit
echo    3. perubahan di-push ke GitHub
echo  GitHub Pages, Vercel, dan Supabase ikut memperbarui.
echo.
echo  Biarkan jendela ini terbuka selama mengedit.
echo  Tekan Ctrl + C atau tutup jendela untuk berhenti.
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-push.ps1" %*
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo Auto push berhenti dengan kode %EXITCODE%.
  echo %* | find /i "-Once" >nul
  if errorlevel 1 pause
)
endlocal & exit /b %EXITCODE%
