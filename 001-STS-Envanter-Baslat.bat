@echo off
chcp 65001 >nul
title STS Envanter - Hizli Mod Baslatici

echo ========================================
echo  STS Envanter - Hizli Mod Baslatiliyor
echo ========================================
echo.

REM ---- ASAGIDAKI IKI YOLU KENDI KLASORLERINIZE GORE DUZENLEYIN ----
set LOCAL_SERVER_PATH=C:\Users\abural\Desktop\STS-Envarter\local-server
set FRONTEND_PATH=C:\Users\abural\Desktop\STS-Envarter\frontend
REM -------------------------------------------------------------

echo [1/3] Yerel sunucu baslatiliyor...
start "STS Envanter - Sunucu" cmd /k "cd /d "%LOCAL_SERVER_PATH%" && npm start"

echo Sunucunun ayaga kalkmasi icin 4 saniye bekleniyor...
timeout /t 4 /nobreak >nul

echo [2/3] Frontend baslatiliyor...
start "STS Envanter - Frontend" cmd /k "cd /d "%FRONTEND_PATH%" && npm run dev"

echo Frontend'in ayaga kalkmasi icin 5 saniye bekleniyor...
timeout /t 5 /nobreak >nul

echo [3/3] Tarayici aciliyor...
start http://localhost:5173

echo.
echo Tamamdir! Iki pencere acik kalmali (kapatirsaniz sistem durur).
echo Bu pencereyi kapatabilirsiniz.
timeout /t 3 >nul
