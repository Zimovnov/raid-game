# Luna → Sol: Blender brief — HK G36K / weapon_g36k

## Зафиксированный игровой default

Target — компактная HK G36K, конфигурация с полимерным встроенным carrying-handle/sight bridge, складным skeleton stock, штатным вентилируемым G36K guard, G36 pistol-grip group, собственным прозрачным 30-зарядным magazine и базовым muzzle part. Не подменять G36K полноразмерной G36 или короткой G36C. Аукционный Switzer’s lot даёт точную подпись «HK G36K 5.56×45» и несколько живых ракурсов, но это гражданская/аукционная сборка с 320 mm barrel, встроенной factory optic и конкретными маркировками. Используй её для читаемых поверхностей/стыков; не копируй номер, рекламную маркировку или незафиксированные размеры в игру. H&K gallery кадры — отдельный modern/performance-upgrade context, не target default.

Сверить текущие IDs в src/content/arsenal-expansion.ts: g36_stock/stock_g36, g36_guard/guard_g36, g36_grip/grip_vertical, g36_30/mag_g36, g36_muzzle/muzzle_brake. Stock_g36_adjust со щекой, guard_g36_rail, короткий магазин и suppressor оставить заменяемыми модулями, не включать в default. Сохранить группировку G36 receiver/body и текущие части/registry groups. Не добавлять магазинам новый соединитель, если его нет в runtime.

## Силуэт — пять обязательных якорей

1. Крупная цельнолитая тёмно-серая полимерная receiver shell образует узнаваемую stepped форму вокруг ejecting port и magwell. Не делать металлическую AK-коробку; панели и реальные разделительные линии следуют литой оболочке.
2. Высокий carrying handle/sight bridge расположен над receiver как единый каркасный мост с продолговатой пустой проёмной областью. Базовый runtime build без выбранного optic должен сохранять этот мост как часть G36K identity; не вставлять лишний телескоп из lot, если default не выбирает optic.
3. Штатный складной приклад — открытая скелетная рама с крупным четырёхугольным проёмом, геометрическим верхним плечом, видимым hinge у receiver и широкой плоской buttplate. Default не получает регулируемую щеку stock_g36_adjust.
4. Вентилируемое короткое G36K handguard имеет крупные длинные боковые вентиляционные щели/окна и округлые грани. Не подменять их rail_g36_guard: Picatinny side/bottom rails относятся к отдельной замене.
5. Магазин — прозрачный прямой корпус с продольным изгибом, крупными боковыми прямоугольными рёбрами/карманами и заметным верхним coupling block. Default 30-round G36 magazine; не ставить STANAG adapter/mag или более длинный linked magazine. Передний узел короткий относительно G36: сохранять короткий G36K barrel/guard силуэт.

## Геометрия, материалы и UV

Формы вести крупными плоскими полигонами и небольшими фасками на бликах; полимерный корпус должен выглядеть как объёмная конструкция, а не набор примитивных коробок. Передние радиусы, stock отверстие и мостик определяют узнаваемость и обязаны остаться при любом LOD. Скрытые внутренние механизмы не строить: за receiver shell достаточно читаемой тени в доступных проёмах.

Материалов мало и они предметные: тёмно-серый матовый glass-filled polymer body/stock/guard/grip; отдельный slightly softer/rougher rubber buttpad; steel barrel, pins and flash/muzzle component с умеренным металлическим откликом; translucent olive/green-gray magazine с controlled transparency. Избегать чистого чёрного пластика везде одинаково, зеркального металла и выдуманных глубоких сколов. У прозрачного магазина держать толщину и внутреннюю видимость ограниченными: простая полупрозрачная tint/roughness и крупные cartridge silhouettes только если текущий renderer стабильно поддерживает transparent materials; иначе использовать полупрозрачный более тёмный материал без ложной трассировки. Проверить sorting/overdraw в render passes.

LOD0 ориентир для активной G36K конфигурации 8–12k tris; LOD1 3–4.5k tris. Это план, фактический счёт записать после экспорта. На LOD1 не сливать отверстия stock и carrying bridge, силуэт sight rails, крупные окна handguard и магазинную связку; убрать микрорёбра, мелкие pins/screws, мелкие labeling. Общая текстура 1K–2K на сборку: reuse dark-polymer/steel material families across rifle family, сохранять единую texel density, не создавать отдельные копии карты для всех stock/guard variants. UV seams держать снизу receiver/guard/stock; прозрачный magazine разворачивать отдельным островом с аккуратными боковыми фасками и без stretched ribs. Не печатать H&K/model markings в текстуру.

## Модульность, анимация и интеграция

Следовать existing registry part groups, сохранить transforms из weapon-layouts.ts: muzzle [0,0.022,-0.71], support [-0.066,-0.12,-0.27], stock [0,0.02,0.37], handguard [0,-0.005,-0.28], grip [0,-0.15,0.09], magazine [0,-0.205,-0.075], optic [0,0.20,-0.01]. Не смещать mount points ради красивого standalone render. Stock hinge должен выглядеть как шов/ось, но game animation остаётся статичной, если runtime не умеет folding; не внедрять folding/adjust animation только в asset. Сохранить G36 action/recoil/reload, ADS/IK, magazine-change, muzzle/ejection transforms и все render passes. Протестировать пересечение руки с вертикальной G36 grip, магазином/магнеллом и ложей; маг должен выйти из приемника без бокового clipping.

## Luna review критерии

Из Switzer’s Auction set отмечены пять полезных уникальных кадров: полный правый профиль, отдельная правая receiver controls деталь, полный противоположный профиль, отдельная receiver/stock-joint деталь с обратной стороны и иной close-up control/marking face. Из кадров 2 и 7 исключены redundant zoom/crop classes. Эти пять закрывают общую форму и обе стороны, но не являются полноценными front/top/rear orthographic views; для second-pass нужны торец ствола, верхний мостик и задний торец stock. Фотографии зафиксированы с source URL, exact lot note, byte count/SHA и правами в /Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_g36k/sources.json.

Приёмка включает front/back/top/both sides/3⁄4 с единым масштабом; проверку default и каждого g36_stock_adjust / guard_g36_rail / g36_20 alternative в сборщике; правильную прозрачность магазина; UV/normal review; ADS/reload/IK/render pass в настоящем runtime; LOD switch и измеренные triangles/material slots/draw calls/FPS. Отдельный Blender turntable не заменяет runtime проверку. Auction and H&K files are reference-only, no redistribution/runtime; Switzer’s photographer is not credited. Seller’s 320 mm barrel/optic/muzzle details are auction-lot features, not universal G36K promises.
