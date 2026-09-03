@echo off
chcp 65001 >nul
echo ========================================================
echo   جاري نسخ لوجو الكنيسة إلى مجلد المشروع وملفات التطبيق
echo ========================================================

copy /Y "C:\Users\pc\.gemini\antigravity\brain\065a5bc4-63f7-4ccc-a9fb-bda6d9d5ab16\.user_uploaded\media_1788379279255.jpg" "%~dp0church-logo.jpg"
if not exist "%~dp0public" mkdir "%~dp0public"
copy /Y "C:\Users\pc\.gemini\antigravity\brain\065a5bc4-63f7-4ccc-a9fb-bda6d9d5ab16\.user_uploaded\media_1788379279255.jpg" "%~dp0public\church-logo.jpg"
copy /Y "C:\Users\pc\.gemini\antigravity\brain\065a5bc4-63f7-4ccc-a9fb-bda6d9d5ab16\.user_uploaded\media_1788379279255.jpg" "%~dp0apple-touch-icon.png"

echo.
echo [✓] تم نسخ الشعار بنجاح!
echo ========================================================
pause
