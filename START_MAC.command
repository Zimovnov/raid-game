#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  printf '\nНе найден Node.js. Установите Node.js 22.12 или новее и повторите запуск.\n'
  read -r -p 'Нажмите Enter для закрытия…' _
  exit 1
fi
node tools/runtime-check.mjs || { read -r -p 'Нажмите Enter…' _; exit 1; }
node tools/serve.mjs --open
