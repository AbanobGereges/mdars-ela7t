@echo off
title خدمة مدارس الأحد
cd /d "%~dp0"

echo ===================================================
echo   ⛪ تشغيل مشروع خدمة مدارس الأحد
echo ===================================================
echo.

if not exist node_modules (
    echo [1/2] جاري تثبيت الحزم والمكتبات لاول مرة...
    call npm install
    echo.
)

echo [2/2] جاري تشغيل الخادم المحلي...
echo.
echo بعد قليل سيظهر رابط الموقع (غالبا http://localhost:5173)
echo افتح الرابط في المتصفح.
echo.
call npm run dev

pause
