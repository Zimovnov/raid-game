@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Не найден Node.js. Установите Node.js 22.12 или новее.
  pause
  exit /b 1
)
node tools\runtime-check.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
node tools\serve.mjs --open
if errorlevel 1 pause
