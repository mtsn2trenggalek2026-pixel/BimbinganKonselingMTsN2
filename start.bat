@echo off
setlocal
cd /d "%~dp0"

set "PHP=C:\xampp\php\php.exe"
if not exist "%PHP%" (
  where php >nul 2>&1
  if errorlevel 1 (
    set "PHP="
  ) else (
    set "PHP=php"
  )
)

if not defined PHP (
  where python >nul 2>&1
  if errorlevel 1 (
    echo [X] Server lokal tidak ditemukan.
    echo     Pasang XAMPP ^(PHP^) atau Python, lalu jalankan file ini lagi.
    echo     Alternatif: copy folder ini ke C:\xampp\htdocs\bk-mtsn2
    echo     dan nyalakan Apache dari XAMPP Control Panel.
    pause
    exit /b 1
  )
  echo Membuka Website BK MTsN 2 Trenggalek...
  start "BK MTsN 2 Trenggalek - Server" /min python -m http.server 8080
) else (
  echo Membuka Website BK MTsN 2 Trenggalek...
  start "BK MTsN 2 Trenggalek - Server" /min "%PHP%" -S localhost:8080 -t "%~dp0"
)

timeout /t 2 >nul
start "" "http://localhost:8080/"

echo.
echo Server berjalan di: http://localhost:8080/
echo Data disimpan di Supabase, jadi koneksi internet diperlukan.
echo Tutup jendela "BK MTsN 2 Trenggalek - Server" untuk menghentikan server.
echo.
timeout /t 3 >nul
exit /b 0
