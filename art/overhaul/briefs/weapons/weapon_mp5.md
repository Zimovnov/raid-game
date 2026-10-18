# weapon_mp5 (HK MP5) — Luna brief for Blender

**Назначение:** обновление базового игрового ассета по источникам и точному варианту каталога. Сначала сверь конкретный вариант с каталогом и фото; названия семейства сами по себе не подтверждают длину, приклад, прицел, материал или мелкую ревизию.

## Силуэт: 5 обязательных точек проверки

1. MP5A2 ориентир: компактный коробчатый receiver с двумя длинными горизонтальными боковыми рёбрами и верхней cocking tube, а не округлый одноцилиндровый корпус.
2. Узкий стандартный handguard заканчивается перед front sight/bearing; не подменять его MLI handguard/rail.
3. Изогнутый стальной 30-round magazine выходит из расширенного magwell под углом; проверить трапецию профиля и сцепление с mag catch.
4. Спереди — цилиндрический/капюшонный sight tower, сзади — диоптрический барабан; их оси соосны стволу и low-profile receiver.
5. В выбранном точном лоте — цельный фиксированный polymer stock с заметной выемкой над grip и butt-end sling recesses; не использовать телескопический A3 или MP5SD силуэт без отдельной модификации каталога.

## Пропорции, геометрия и материалы

Зафиксировать target как H&K MP5A2: Morphy lot №603069 (1984, fixed stock, стандартный горизонтальный polymer forend, 4-position pictograph selector). Текущий `DEFAULT_BUILDS.weapon_mp5` в `src/content/weapons.ts` задаёт ровно `mp5_stock` + `mp5_guard` + `mp5_30`; поэтому это и есть игровой default. Геометрия базы — fixed stock / стандартное цевьё / изогнутый 30-round magazine. Не переносить автоматически MLI rail/forend или MP5SD интегрированный suppressor; модификации держать отдельными по существующим слотам. При подтверждении A2: receiver/cocking tube/barrel — чернёная сталь с низким сатиновым бликом; stock, grip и handguard — зернистый чёрный полимер с более высоким roughness; магазин — отдельная тёмная сталь, оттенком чуть холоднее receiver. Selector pictographs и маркировки делать плоскими decal/texture, без выступающей нечитаемой микро-гравировки; не изобретать serial/logos. Держать реальные объёмы и читаемую ось ствола; фаски широкие только там, где меняют силуэт/блик, плоскости остаются плоскими и угловатыми. Не делать ровные прямоугольники вместо формообразующих деталей, но микровинты/рифление переносить в нормаль/roughness, если они не читаются в first-person. Разделить металл, полимер, резину и дерево по roughness/цвету; никакой универсальной глянцевой чёрной краски, шумных пятен износа или неподтверждённых логотипов.

## Asset groups, UV и LOD

- Разбить геометрию на текущие registry assetKey группы: основное тело/ствольная коробка, ствол и дульный узел, цевьё/приклад, магазин, прицелы и модификации — только если текущий каталог даёт раздельную замену. Не создавать новые группы/сокеты без владельца runtime.
- UV разворачивать так, чтобы растяжение не читалось на длинных цилиндрах, коробке и тканевых/деревянных поверхностях; seam прятать на нижней/внутренней стороне. Повторно использовать существующие материалы/атласы; не дублировать однотипные текстуры на соседние модификации.
- LOD0 сохраняет пять пунктов силуэта и крупные control shapes, но не моделирует невидимое внутреннее устройство. LOD1 схлопывает мелкие крепёжные элементы, зубья/насечки и маленькие фаски, сохраняя силуэт и различимые модули; соблюдать фактические per-asset бюджеты действующего каталога и записывать полигоны при экспорте.

## Анимация и интеграция

Использовать только уже поддерживаемые игровые pivots/состояния: сменный магазин, затвор/рукоять перезарядки и trigger только если текущий weapon contract показывает их; приклад или прицел анимировать лишь как доступную модификацию. Сохранить ADS, recoil, reload, muzzle/ejection transforms и проверки render pass; не добавлять новый skeletal/runtime контракт ради одной модели. Проверить клиппинг рук/модулей в фактических игровых позах.

## Референсы, проверка и gap

Локальный manifest: /Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_mp5/sources.json. В нём сохранена галерея Morphy Auctions lot 603069: десять полноразмерных оригинальных фото одной factory-original 1984 H&K MP5A2, fixed stock, horizontal forend, 4-position selector: два противоположных full-length профиля и distinct detail views receiver/selector/magwell/trigger/sights/stock. Все имеют SHA256; фотограф не назван, права остаются у источника, только reference-only. В дополнение оставлены пять HK product/action images, включая MLI и MP5SD; они явно помечены как альтернативы/контекст и не смешиваются с A2 base. В текущем source set 10 пригодных unique photos и 8 distinct geometry/detail view classes (дубликаты/MP5SD не засчитаны).

Перед стартом Sol должен обозначить неподтверждённые ракурсы/варианты и пропорции; по неизвестным частям не выдумывать детали, а оставить review gap. Проверка после Blender: ортографические front/side/rear/top и 3/4 виды на одном масштабе; сравнение пропорций, UV/материалов, сменных групп и анимационных точек; runtime-просмотр ADS, перезарядки и LOD.

## Luna → Sol → Review

**Luna brief:** Используй точную MP5A2 Morphy gallery как базовый reference variant; целевой default зафиксирован каталогом: `mp5_stock`, `mp5_guard`, `mp5_30`. Asset groups: receiver/body, cocking tube/action, barrel/front sight, rear diopter, fixed stock, standard forend, magwell/trigger housing, removable magazine. Сменные stock/forend/optics оставлять отдельными только если они существуют в runtime slot hierarchy.

**Sol execution:** в Blender сохраняй low-poly flat planes/controlled bevels, но оставь читаемые receiver ribs, cocking handle slot, diopter/front hood, trigger guard, stock/grip silhouette и mag curve; small selector pictograms/buttstock marks — decal/normal, не геометрия. Развёртывай длинные receiver/forend islands без растяжения; seams снизу и внутри. Делай shared black-phosphate steel / polymer materials, один atlas per family, не unique 4k. GLB сохранить в текущие assetKey groups; separate body/action meshes/pivots для runtime-defined bolt/cocking/reload state.

**Review:** один масштабный front/left/right/rear/top/3⁄4 sheet сверить с A2 фото; визуально проверить два receiver бока, stock/handguard и магазин. В игре прогнать ADS, reload, recoil, mag removal, first-person clipping, dropped/remote pass и world LOD1. Убедиться что соответствующие glTF groups не дублируют Part fallback после загрузки. Не засчитывать MP5SD/MLI детали как A2 base.
