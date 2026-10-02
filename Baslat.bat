@echo off
rem Basrol: sunucuyu ve uygulamayi iki ayri pencerede baslatir.
rem Yurttaysan once bilgisayari iPhone'un Kisisel Erisim Noktasina bagla.
start "Basrol - Sunucu" cmd /k "cd /d %~dp0server && npm run dev"
timeout /t 3 /nobreak >nul
start "Basrol - Uygulama" cmd /k "cd /d %~dp0app && npx expo start"
