# Luna → Sol: Blender brief — АК-12 / weapon_ak12

## Target и текущие игровые части

Канонический визуальный target для этого overhaul — серийный АК-12 6П70 в конфигурации, показанной на ARMY-2020 (2020 production revision). Это решение для референс-пакета; runtime каталог называет оружие просто АК-12 и не задаёт календарную ревизию. Не подменяй его prototype 2012/2016 или AK-12 2023 без отдельного решения; фото 2023 при поиске допускаются только как явно подписанные сравнительные cues.

Сверь активный default в src/content/arsenal-expansion.ts: stock ak12_stock / stock_ak12, handguard ak12_guard / guard_ak12, pistolgrip ak_grip, magazine ak545_window_30, muzzle ak12_brake / muzzle_ported. Default не содержит stock_ak12_cheek и guard_ak12_long: не переносить высокий cheek riser или удлинённое цевьё из другого build в базовую сборку. Scope/modifier groups создавать только если уже представлены в model-assets registry. Сохранить существующие body/action source groups и part boundaries, не создавать новые mounts или second geometry paths.

## Пять силуэтных anchors

1. Современный Kalashnikov receiver с плоским rail-ready dust cover: длинная верхняя линия связывает крышку/ствольную коробку и оптику, но не превращает оружие в монолитный AR upper; ступень receiver перед прикладом и характерный AK-низ сохраняются.
2. Базовый регулируемый складной L-профиль stock: прямая плечёвая линия с открытым боковым просветом/каркасом и шарнир у задней части receiver. В default нет отдельной высокой щёки; это отдельный assetKey stock_ak12_cheek.
3. Короткое угловатое guard_ak12 с ровной верхней rail-плоскостью, многогранными боковыми плоскостями и аккуратно прорезанными вентиляционными окнами. Не моделировать длинный aftermarket guard_ak12_long в default.
4. Газовый узел и передний sight-block собраны в характерный современный AK front end; передняя мушка имеет отдельный контур, не поглощается rail handguard, barrel axis и gas tube читаются раздельно сверху/в профиль.
5. Изогнутый 30-round rifle magazine с выраженными передней/задней кривыми и крупными боковыми рёбрами; default key ak545_window_30 — игровой вариант с окнами, окна читаются как отверстия/прозрачный индикатор только если renderer поддерживает материал; не подменять RPK drum/45-round magazine.

Пакет теперь содержит Army-2020-302 (CC0, профиль на стенде) и пять авторских фотографий одного выставочного АК-12 6П70 на ARMY-2020: полный профиль с маркировкой, противоположный бок, задний 3/4 и два крупных вида receiver/control/верхней линии. Сверяй пропорцию buttstock–receiver–guard–magazine и ступени обеих сторон по этим кадрам. Оптика 1П87/1П90 на нескольких фото — съёмный контекст, не default-деталь и не повод встраивать прицелы в body. Силуэт строить из широких плоских полигональных фасок и крупных плоскостей: low-poly допустим угловатый, но не кубический receiver, сглаженные радиусы только на рукояти/трубе/цилиндрических деталях, швы деталей должны объяснять конструкцию.

## Геометрия, материал, UV и LOD

Начальная оценка на активную сборку: LOD0 8–12k tris, LOD1 3–4.5k tris, проверить фактическую стоимость в игровом кадре; это budget proposal, а не измерение GLB. На LOD1 держать разницу stock/guard/magazine и контур sights, схлопнуть micro-fasteners, selector labels, мелкие насечки; не пропускать silhouette-changing barrel/sight/stock pivot. Не строить скрытую внутреннюю затворную группу, которой runtime не рендерит/не анимирует.

Body, barrel, gas tube, sights, stock, handguard, grip and magazine — отдельные материальные зоны с ограниченным числом переиспользуемых PBR materials: фосфатированная/воронёная сталь с low-mid roughness и сдержанным металлическим откликом; чёрный или угольно-серый полимер stock/handguard/grip с более высоким roughness, отдельный матовый каучук buttpad. Никакой универсальной глянцевой чёрной краски, случайных сколов или контрастных fake logos. Плоские панели и bevel edges должны давать крупные читаемые световые полосы.

Переиспользуй общий weapon atlas: ориентир 1K–2K на всю сборку, повторно используй материал чёрного polymer и steel из близких AK-платформ, а UV-маскировку цвета вариаций задавай material instances, не клонируй одинаковые карты для каждого модуля. На цилиндрах газовой трубки/ствола и магазине seam прятать снизу/в тени, не растягивать UV по длине; острые коробочные грани сохранять straight, UV islands плотные и с паддингом, читаемая texel density на first-person surfaces. Если окно магазина не работает в существующем шейдере, используй светлые счётные вставки с тем же material family, а не выдумывай новую прозрачность.

## Модули, анимация и integration

Сохранить catalog assetKeys, existing weapon layout и groups. Базовый muzzle point [0, 0.025, -0.79], support [-0.065, -0.12, -0.28], handguard [0, 0.01, -0.31], stock [0, -0.01, 0.37] из текущей конфигурации; экспортный pivot не смещать относительно них. Удержать модели stock_ak12_cheek и guard_ak12_long отдельными заменяемыми meshes и не дублировать base mesh при выборе этих parts. Сохранить существующий рок/АК action, bolt/handle, magazine change, ADS/IK, recoil, muzzle/ejection transforms и все render passes; не добавлять skeletal rig или новые суставы для неподвижной мебели. Игровой magazine reload проверять на clipping магазина/кисти, stock hinge не должен двигаться в ходе reload.

## Проверка Sol → Luna

Sol должен вернуть: Blender source file + экспортированный GLB/модульные outputs по поддерживаемому registry contract; фактические triangle counts, material slots, UV/texture dimensions, bounds, transforms и снимки front/rear/top/both sides/3⁄4. Проверить default build и альтернативы cheek/long guard через реальное меню assembly, fallback/loading replacement, отсутствие двойной геометрии, ADS line, reload/IK, дальний LOD, normals/seams и FPS/draw calls в игре. Не принимать только Blender render как runtime verification.

Luna review: силуэт target 2020 должен совпадать по видимому профилю и базовым default parts; не считать 2023 reference заменой референса этой ревизии. Пятиракурсный gate по числу пригодных оригинальных фотографий закрыт; остаётся слабое покрытие точного вида сверху и торцов. Пикабу-фотографии авторские, автор указывает использование только с разрешения; использовать только как приватную reference-only библиотеку. Один загруженный файл Army-2020-301.JPG был визуально исключён: это SVD/7.62×54R, а не АК-12; он удалён и не участвует в счёте.

## Источник/права

Локальный ledger: /Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_ak12/sources.json. Army-2020-302.JPG: автор Nickel nitride, 27.08.2020, CC0 1.0. Дополнительно: пять кадров Fideli0 с ARMY-2020 (авторские фотографии; разрешение на повторное использование не дано), точный экземпляр/партия неизвестны. Этот файл оставлен в внешнем research library; в public/runtime не копировать. После попыток скачать соседние Commons-файлы вернулся HTTP 429; соблюдать указанный Retry-After, пока переключаться на официальные product/gallery и музейные источники.
