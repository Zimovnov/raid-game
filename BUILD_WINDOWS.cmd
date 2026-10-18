@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Нужен Node.js 22.12 или новее.
  pause
  exit /b 1
)
node tools\runtime-check.mjs
if errorlevel 1 exit /b 1
call npm ci --offline
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
node tools\serve.mjs --open
exit /b 0
:failed
echo Сборка не завершена. Ошибка показана выше.
pause
exit /b 1
