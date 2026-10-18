# weapon_svd (СВД) — Luna brief for Blender

**Целевой game build:** `weapon_svd` с каталожными `svd_stock`, `svd_guard`, `svd_10`; прицела в default build нет, `scope6` остаётся отдельным optional module. Базовый корпус — exact SVD/Izhevsk style; RIAC 1983 specimen anchors stock/receiver proportions, Proxibid Izhevsk SVD crop supplements optic/receiver detail only. Не переносить PSO в базу, если optic socket отсутствует в текущем build.

## Силуэт: 5 обязательных точек проверки

1. длинный тонкий профиль марксманской винтовки.
2. деревянная или подтверждённая целевая версия накладка/приклад.
3. выраженная верхняя ствольная коробка с оптическим интерфейсом.
4. длинный магазин.
5. длинное цевьё и передний узел мушки.

## Пропорции, геометрия и материалы

дерево/полимер строго по модели, металл матовый; не превращать в bolt-action или современный chassis. Держать реальные объёмы и читаемую ось ствола; фаски широкие только там, где меняют силуэт/блик, плоскости остаются плоскими и угловатыми. Не делать ровные прямоугольники вместо формообразующих деталей, но микровинты/рифление переносить в нормаль/roughness, если они не читаются в first-person. Разделить металл, полимер, резину и дерево по roughness/цвету; никакой универсальной глянцевой чёрной краски, шумных пятен износа или неподтверждённых логотипов.

## Asset groups, UV и LOD

- Разбить геометрию на текущие registry assetKey группы: основное тело/ствольная коробка, ствол и дульный узел, цевьё/приклад, магазин, прицелы и модификации — только если текущий каталог даёт раздельную замену. Не создавать новые группы/сокеты без владельца runtime.
- UV разворачивать так, чтобы растяжение не читалось на длинных цилиндрах, коробке и тканевых/деревянных поверхностях; seam прятать на нижней/внутренней стороне. Повторно использовать существующие материалы/атласы; не дублировать однотипные текстуры на соседние модификации.
- LOD0 сохраняет пять пунктов силуэта и крупные control shapes, но не моделирует невидимое внутреннее устройство. LOD1 схлопывает мелкие крепёжные элементы, зубья/насечки и маленькие фаски, сохраняя силуэт и различимые модули; соблюдать фактические per-asset бюджеты действующего каталога и записывать полигоны при экспорте.

## Анимация и интеграция

Использовать только уже поддерживаемые игровые pivots/состояния: сменный магазин, затвор/рукоять перезарядки и trigger только если текущий weapon contract показывает их; приклад или прицел анимировать лишь как доступную модификацию. Сохранить ADS, recoil, reload, muzzle/ejection transforms и проверки render pass; не добавлять новый skeletal/runtime контракт ради одной модели. Проверить клиппинг рук/модулей в фактических игровых позах.

## Референсы, проверка и gap

Локальный источник: /Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_svd/sources.json. Пакет содержит четыре полезных изображения одной 1983-marked Izhevsk Arsenal SVD из RIAC: полный левый и правый профили, правый receiver/magwell и левый receiver/scope-rail detail. Пятое — отдельный Proxibid Izhevsk SVD close-up с чуть верхнего задне-правого 3/4 угла; оно подтверждает узел PSO/receiver/magwell как SVD-family, но не доказывает ревизию лота RIAC и не добавляет полный silhouette. Commons full profile без scope/mag остаётся только silhouette context; Tiger-derived frame исключён. Все URLs/варианты/hashes — в `sources.json`. Не переносить PSO в default: `scope6` — отдельная optional module. Автор фото RIAC/Proxibid не указан, права не переданы — только private research/reference; не включать в runtime/public. Непоказанные низ/дульный торец остаются аккуратным art approximation по проектному socket/layout контракту.
## Luna → Sol → Review

**Luna brief:** обновить exact SVD по 1983-marked Izhevsk lot, как ориентир на древесину, receiver/rail и комплектную PSO-оптику. Сохранять отдельно корпус, приклад/щёку, цевьё, магазин, оптику, дульный тормоз и переднюю/заднюю мушечную группу; не превращать дерево в гладкий пластик, не добавлять детали по Tiger/NDM-86.

**Sol:** собрать Blender GLB в существующие registry assetKey-группы; не включать bayonet, sling, pouch и аксессуары лота в базовый runtime object, пока не увидены в игре/каталоге. LOD0 держит thumbhole stock/cheekpiece, вент-цевьё, характерный PSO силуэт и magazine outline; LOD1 чистит мелкие маркировки/шлицы/рифления. Материалы: угольно-чёрная матовая/сатиновая сталь, тёплый ламинированный коричневый пласт с умеренным лаком, стекло PSO без зеркального шума. UV: отдельные shell islands для металла/дерева/оптики, seams снизу/внутри; повторно использовать общий rifle wood/blackened steel материал, не заводить уникальные 4k текстуры.

**Проверка:** orthographic left/right/front/rear/top plus 3/4 match the lot views; подтвердить side rail и scope mount без перекоса, оптику и магазин не клипуют; compare ADS alignment, reload/magazine animation, recoil/bolt and muzzle anchors; проверить body/action split, registry load, LOD switch и render passes. Bottom/underside/end-on views remain a documented art-approximation gap; do not claim those exact surfaces were verified.