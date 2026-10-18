#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  printf '\nНе найден Node.js. Требуется Node.js 22.12 или новее.\n'
  exit 1
fi
node tools/runtime-check.mjs || exit 1
node tools/serve.mjs --open
