# Luna → Sol: Blender brief — FN SCAR-L Mk2 STD, 14″

## Зафиксированный target

Игровая сборка фиксируется как FN SCAR-L Mk2 STD, чёрный вариант, 14″ ствол, приклад полностью выдвинут и раскрыт; `weapon_scarl` default: `scar_stock`, короткое штатное `scar_guard`, `ar_grip`, `ar556_30`, `scar_brake`. Default без optic, foregrip, light, suppressor и grenade launcher. Выбор 14″ STD — визуальное решение по официальному FN product image; код не задаёт barrel length. Не переносить пропорции SCAR-H/7.62 magazine, старых Mk1, CQC 10″ или aftermarket long M-LOK handguard на этот target. Рельсы/stock остаются читаемыми отдельными группами, соответствующими имеющимся каталоговым слотам.

## Пять обязательных shape anchors

1. Верхняя ствольная коробка образует длинную цельную верхнюю плоскость с непрерывной Picatinny линией; визуально это высокая угловатая «спина» оружия, не AR-15 upper/lower с обычной трубой буфера.
2. Передняя часть — отдельное угловатое штатное короткое цевьё с рядом боковых/нижних планок, короткий газовый узел и защищённая складная мушка; не добавлять M-LOK прорези от других ревизий/реплик.
3. Коробка имеет характерные SCAR-переходы и отдельный нижний polymer receiver с магазинным колодцем и скобой; сохранять ступень между верхом/нижним модулем и крупные двусторонние органы управления.
4. Задняя часть имеет выраженный складной шарнир у ресивера, регулируемый телескопический приклад с выпуклой пяткой и регулируемой щекой; в default он открыт, не укорочен и не сложен.
5. 14″ ствол с коротким штатным дульным тормозом/пламегасителем и 30-round STANAG магазин дают базовые длину и нижний баланс. Магазин не должен менять силуэт SCAR-H.

## Геометрия, материалы, UV

Работать в metres frame и сохранять authored base/body/action группы. Не масштабировать цельный SCAR-пропорционально по procedural part box: новые группы используют authored transform/socket из существующей weaponLayout. Mesh-group split: body/upper-action (сохранить source groups), stock hinge+stock module, guard module, grip, detachable magazine, muzzle, sights как часть base, если runtime mount отсутствует. Hinge/adjustable cheekpiece моделировать как внешний вид; анимировать раскладывание только если уже поддержан runtime state, иначе export в раскрытом положении и не вводить новый animation contract.

LOD0 ориентир 10–15k tris на полную активную сборку; LOD1 4–5k. Это предложение до профилирования. LOD1 не теряет различие upper/lower, stock hinge, топ-рейку, складные механические прицелы, газовый узел, magazine shape и крупные планки; мелкий крепёж и зубья рельсов можно упростить.

Стандартный выбранный target — чёрный/тёмный матовый; полимер чуть более матовый, стальная/алюминиевая верхняя коробка сатиновая, резиновая пятка более матовая и мягкая. Не использовать бесконтрольные grunge overlays, логотипы FN и white replicas marks в игровом материале. UV вдоль корпуса и приклада, seams внутрь/на нижнюю грань, одинаковая texel density на обеих сторонах. Один общий atlas 1–2K на platform families где это допустимо, separate material только для металла/полимера/резины и стекла если optic позже добавят.

## Референсы и границы применимости

Полный список direct URLs, авторов/прав, SHA и variant notes находится в `/Users/vladimir/Downloads/RAID_GAME_Art_Overhaul_References/weapons/weapon_scarl/sources.json`. Официальный FN MK2 STD black profile задаёт длину/общую конфигурацию. Arms Magazine Web — статья о FN-licensed Guns Modify × Cyber Gun SCAR-L MK2 airsoft replica; её разные three-quarter, muzzle, handguard, receiver, stock и magazine closeups пригодны только как дополнительное внешнее cue для швов и объемов. Они не задают размеры реального изделия, внутренние элементы, trademarks или работу механизма. Сложенный CQC и отдельный field photo — только context, не default view/variant. Пиксели остаются private reference-only.

## Анимация и проверка

Оставить текущие IK, ADS offsets, recoil, reload, muzzle/ejection transforms, ammunition inventory и render passes. В reload проверить вход/выход ar556_30, клиппинг скобы/рукояти и отсутствие повторного отрисовывания mesh в thin-instance slot. Ручки/затвор и магазины не должны влиять на camera bounds. Проверка включает полный side+three-quarter, FP, ADS, stock/foregrip optional build только через существующие sockets, depth/material/shadow passes и измерение baseline vs GLB по draw calls, triangles и frame-time.

## Приёмка

В дефолте читается именно 14″ SCAR-L Mk2 STD с открытым регулируемым stock; нет SCAR-H или CQC barrel proportions, выдуманных M-LOK окон, неправильного магазина и лишних аксессуаров. Отдельные группы совпадают с catalog slots; LOD1 сохраняет пять anchors. Не объявлять FPS без измерения. В QA фиксировать, что недостающие стерильные точные rear/underside views аппроксимированы с опорой на модельную референсную галерею и требуют runtime spotcheck.
