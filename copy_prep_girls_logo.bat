@echo off
chcp 65001 >nul
echo ========================================================
echo   جاري نسخ لوجو خدمة بنات إعدادي وصورة كارت الأختام
echo ========================================================

if not exist "%~dp0public" mkdir "%~dp0public"

copy /Y "C:\Users\pc\.gemini\antigravity-ide\brain\0eeb0e49-df24-4058-8ddd-e6b944b9a7d3\.user_uploaded\media_1792244610284.png" "%~dp0public\girls-prep-logo.png"
copy /Y "C:\Users\pc\.gemini\antigravity-ide\brain\0eeb0e49-df24-4058-8ddd-e6b944b9a7d3\.user_uploaded\media_1792244584720.jpg" "%~dp0public\stamp-card-sample.jpg"
copy /Y "C:\Users\pc\.gemini\antigravity-ide\brain\0eeb0e49-df24-4058-8ddd-e6b944b9a7d3\.user_uploaded\media_1792244610284.png" "%~dp0girls-prep-logo.png"

echo.
echo [✓] تم نسخ لوجو خدمة بنات إعدادي بنجاح إلى مجلد public!
echo ========================================================
pause
