# Field Kit 0.5.1 — исходники ассетов

Исходные AKMN/Glock не изменяются. Новые GLB используют группы `assetKey` и два `lod`; рендерер сопоставляет группы с действующим деревом предметов. Копии оружия получают независимые матрицы позы. Фотографии в этот каталог и выпуск не включаются.

Для воспроизведения нужен Node >=22.12 и Blender 5.2 с встроенным NumPy. Из корня проекта:

```sh
npm ci
npm run build
node art/FieldKit051/scripts/recipes.mjs
blender --background --python art/FieldKit051/scripts/build_assets.py
blender --background --python art/FieldKit051/scripts/refine_fabric.py
blender --background --python art/FieldKit051/scripts/prepare_glock.py
node art/FieldKit051/scripts/write_registry.mjs
npm run verify
```

На macOS исполняемый файл Blender обычно находится в `/Applications/Blender.app/Contents/MacOS/Blender`. `RAID_PROJECT_ROOT` позволяет явно указать корень. При выполнении через MCP задайте `__file__` равным полному пути скрипта и выполните его текст через `exec(compile(...))`.

Для обычной сборки Blender не нужен: готовые GLB/PNG включены в `public`. После изменения текстур обновляйте реестр URL: хеш содержимого исключает использование старого кеша. Не изменяйте исходные текстуры Glock; тест проверяет их точное совпадение с runtime GLB. Проверка rest-матриц выявляет расхождения между Blender-рецептами и креплениями движка.

АКМ, AKMN-совместимое представление и АК-74М используют один общий Blender-корпус `weapon_ak_common.glb`: UV, PBR-поверхности и два LOD. У каждого оружия остаётся свой магазин: 7,62×39 для АКМ и 5,45×39 для АК-74М. Оригинальные файлы AKMN сохранены как исходники и не участвуют в runtime-подмене. Для точечной пересборки общего корпуса после `npm run build`:

```sh
node art/FieldKit051/scripts/recipes.mjs
RAID_FIELDKIT_ONLY=weapon_ak_common blender --background --python art/FieldKit051/scripts/build_assets.py
node art/FieldKit051/scripts/write_registry.mjs
npm run verify
```

При точечной пересборке остальные GLB и текстуры не перезаписываются. Обновите записи новых GLB в `public/asset-manifest.json` через `node tools/update-assets.mjs`.

`tools/field-kit-review.html` при запущенном Vite показывает оружейную, первое лицо, ADS и пять независимых анимационных поз. Это графическая проверка, а не доказательство сетевой игры.
