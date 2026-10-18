# weapon_mosin9130 (Мосина обр. 1891/30) — Luna brief for Blender

**Назначение:** обновление базового игрового ассета по источникам и точному варианту каталога. Сначала сверь конкретный вариант с каталогом и фото; названия семейства сами по себе не подтверждают длину, приклад, прицел, материал или мелкую ревизию.

## Силуэт: 5 обязательных точек проверки

1. Узкий длинный full-length bolt-rifle силуэт M91/30: ствол+цевьё+ложа образуют ровную ось; приклад не должен пухнуть как современный Monte Carlo aftermarket.
2. Разделить ложу, верхнюю накладку и тонкие стволовые/магазинные металлические ленты; сохранить характерные стыки дерева и железа.
3. Выступающий ствол с открытой передней мушкой и кольцевым/защитным основанием; не добавлять suppressor.
4. Целик/прицел в базовой конфигурации только штатный открытый rear sight; NRA sniper PE scope — отдельный visual reference, не часть catalog base, где единственный слот — stock.
5. У receiver — длинный выступающий bolt handle, отдельная ствольная коробка и внешний магазинный корпус; пропорции передней ложи/коробки сверить по opposite-side музею и RIAC лоту.

## Пропорции, геометрия и материалы

Сверять catalog definition `weapon_mosin9130` в `src/content/weapon-expansion.ts`: имя M1891/30, базовый mod slot только `stock`, `stock_mosin_wood` — длинная деревянная ложа. У музея NRA другой конкретный образец — M91/30 sniper display, receiver dated 1938, laminated stock, PE optic; он годится для дерева/коробки/формы по сторонам, но scope нельзя запекать в base. RIAC lot 255 rifle A — 1932 Izhevsk M1891/30 — дополняет general receiver/wood proportions. Для общего base использовать древесину medium-dark brown with visible laminations/grain variation (subtle roughness), metal dark blued/parkerized low-satin steel; не рисовать универсальную glossy black краску, зерно/пятна only to match actual worn museum/auction surface. Держать реальные объёмы и читаемую ось ствола; фаски широкие только там, где меняют силуэт/блик, плоскости остаются плоскими и угловатыми. Не делать ровные прямоугольники вместо формообразующих деталей, но микровинты/рифление переносить в нормаль/roughness, если они не читаются в first-person. Разделить металл, полимер, резину и дерево по roughness/цвету; никакой универсальной глянцевой чёрной краски, шумных пятен износа или неподтверждённых логотипов.

## Asset groups, UV и LOD

- Разбить геометрию на текущие registry assetKey группы: основное тело/ствольная коробка, ствол и дульный узел, цевьё/приклад, магазин, прицелы и модификации — только если текущий каталог даёт раздельную замену. Не создавать новые группы/сокеты без владельца runtime.
- UV разворачивать так, чтобы растяжение не читалось на длинных цилиндрах, коробке и тканевых/деревянных поверхностях; seam прятать на нижней/внутренней стороне. Повторно использовать существующие материалы/атласы; не дублировать однотипные текстуры на соседние модификации.
- LOD0 сохраняет пять пунктов силуэта и крупные control shapes, но не моделирует невидимое внутреннее устройство. LOD1 схлопывает мелкие крепёжные элементы, зубья/насечки и маленькие фаски, сохраняя силуэт и различимые модули; соблюдать фактические per-asset бюджеты действующего каталога и записывать полигоны при экспорте.

## Анимация и интеграция

Использовать только уже поддерживаемые игровые pivots/состояния: сменный магазин, затвор/рукоять перезарядки и trigger только если текущий weapon contract показывает их; приклад или прицел анимировать лишь как доступную модификацию. Сохранить ADS, recoil, reload, muzzle/ejection transforms и проверки render pass; не добавлять новый skeletal/runtime контракт ради одной модели. Проверить клиппинг рук/модулей в фактических игровых позах.

## Референсы, проверка и gap

В manifest `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_mosin9130/sources.json` теперь 12 уникальных файлов. Rock Island Auction lot 255 rifle A: 1932 Izhevsk M1891/30; набор даёт side/opposite/rear-quarter и ложу/затвор. NRA National Firearms Museum gallery: six original photos конкретного M91/30 sniper display, 1938 receiver, laminated wood, PE scope — side/opposite full profiles + scope/mount, stock/receiver junction and eyepiece details. Они дополняют визуальную геометрию stock/receiver, но не являются доказательством, что в catalog base есть оптика или эта дата/производитель. Сейчас имеются как минимум пять пригодных недублированных общих ракурсов/деталей; остаётся точная open-sight top/front confirmation. На NRA/RIAC изображения права сохраняются за источниками, фотографы не указаны; локально только research/reference, запрещено public/runtime. Не считать один NRA sniper display и один 1932 RIAC экземпляр взаимозаменяемыми вариантами.

Перед стартом Sol должен обозначить неподтверждённые ракурсы/варианты и пропорции; по неизвестным частям не выдумывать детали, а оставить review gap. Проверка после Blender: ортографические front/side/rear/top и 3/4 виды на одном масштабе; сравнение пропорций, UV/материалов, сменных групп и анимационных точек; runtime-просмотр ADS, перезарядки и LOD.

## Luna → Sol → Review

**Luna → Sol:** Моделируй игровой standard 1891/30 base из `src/content/weapon-expansion.ts` без optic; применяй `stock_mosin_wood` как длинную деревянную ложу, оставляя scope/sniper variants вне базовой геометрии. Сохрани registry body/action/stock groups и видимый отдельный bolt handle; в Blender спроектируй металл/дерево как раздельные материалы, subtle grain/edge wear, UV seam внизу ложи/под накладкой; длинные ствол/ложа требуют контролируемого UV texel density.

**Проверка:** единый масштаб: museum/RIAC side + opposite side + rear-quarter/detail; на final GLB проверить front/top/open-sight и muzzle dimensions, не выводя неувиденную геометрию из sniper scope photos. Обязательные игровая ADS alignment, bolt/reload, magazine detach, muzzle/ejection anchors, LOD1. Проверить что `stock_mosin_wood` меняет только catalog-defined stock group, no PE scope in base; reference files не переносятся в public/runtime.
