# Luna → Sol: Blender brief — ПП-19-01 «Витязь»

## Целевая игровая сборка

Target weapon_pp1901 uses vityaz_stock = stock_triangle, vityaz_guard = guard_mini_poly, ak_grip and vityaz_30 from src/content/weapon-expansion.ts. Do not model Vityaz-SN: target has no wide Picatinny handguard, PT-1 stock or foregrip. Mount and muzzle are optional slots, absent from default build. Preserve layout vityaz coordinates: muzzle [0,0.023,-0.55], support [-0.06,-0.10,-0.21], handguard [0,0.005,-0.23], magazine [0,-0.24,-0.085], stock [0,-0.02,0.34]. Keep existing PP-19-01 rock-cycle animation and first-person IK.

## Пять shape anchors

1. Компактный профиль SMG: короткие ствол/цевьё, штампованная коробка, curved 9x19 magazine, пистолетная рукоять и треугольный wire stock. В сложенном положении приклад складывается сбоку параллельно коробке, не превращается в телескопическую трубу.
2. Передняя часть: компактный узел мушки у короткого ствола и узкое штатное ребристое цевьё. Не добавлять верхние/боковые рейлы SN.
3. Коробка: характерная AK-derived stamped receiver с отдельной верхней крышкой, боковой овальной выштамповкой, правым charging handle и длинным selector lever. Дать разделение крышка/корпус фаской, не монолитным блоком.
4. Приклад: две тонкие стальные тяги, отдельная опорная пластина, шарнир/защёлка у задней коробки; металл не должен выглядеть толстым литым пластиком.
5. Магазин и grip: отдельный короткий изогнутый polymer magazine и компактный AK-pattern grip; не использовать rifle magazine, coupling clamp или Bizon helical magazine.

## Geometry, UV и материалы

Стартовый бюджет LOD0 6–9k tris для активной сборки (base+stock+handguard+grip+magazine), LOD1 2–3k tris. Это допущение для профилирования, не замер лимита. LOD1 сохраняет треугольный wire stock, изгиб магазина, крышку, селектор, grip и короткое цевьё; убирает малые штифты/скрытые соединения. Стабильные asset keys по платформе и текущим build parts; сохранить группы body/action.

Коробка и ствол — тёмный сатиновый металл без глянцевой чёрной эмали; furniture и магазин — матовый полимер с немного разной шероховатостью; складной stock — более холодная сталь с мягким износом по внешним рёбрам. Один атлас 1K–2K на сборку; одинаковая texel density на обеих сторонах receiver; цилиндрические UV для ствола, без заметных швов на видимых плоскостях. Металл/полимер разделить roughness/metallic. Мелкие маркировки не копировать неразборчивым шумом.

## Animation, mounts и приёмка

Оставить текущие layout/IK/render passes; проверить magazine reload, idle, aim и recoil. Штатный сложенный stock, когда он показан как отдельное состояние/второй target, и установленный optional optic не должны пересекать камеру/руку; смена GLB↔Part fallback не должна дублировать узлы. Проверить material/depth/shadow passes, LOD switch и FPS на штатной сцене. Принять если хорошо читаются wire stock, ribbed short handguard, receiver cover и curved SMG mag; отсутствуют SN rails и чужие attachments в default build; нет UV seams, пробитых нормалей, регрессии FPS.

## Provenance

См. `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_pp1901/sources.json`: 9 локальных оригинальных файлов с прямыми URL/SHA и вариантными пометками. Пять разных кадров Vitaly Kuzmin 351-01/02/05/07/10 образуют целевой базовый комплект: полный профиль, противоположные/верхние 3/4 и дополнительные детали; Modern Firearms 19-2/19-3 — только модульный/семейный контекст, 19-3 (Vityaz-SN) не моделировать в базе. CC BY-SA attribution/share-alike requirements записаны для Kuzmin; это не разрешает копировать пиксели в runtime. Остальные кадры имеют отдельные права в индексе; вся библиотека reference-only/private. Не включать фото в public/runtime.
