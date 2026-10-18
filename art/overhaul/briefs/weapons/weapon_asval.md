# weapon_asval — Luna → Sol Blender brief

## Целевой asset и точная текущая сборка

Полная модель `weapon_asval` участвует в overhaul. Установленный в `src/content/arsenal-expansion.ts` каталоговый default: `stock=val_stock`, `handguard=val_guard`, `pistolgrip=val_grip`, `magazine=val_20`, без оптического прицела и без отдельного дульного модуля. Цилиндрический интегрированный suppressor — часть body asset, не `muzzle` attachment. Сохранить `body` и `action` группы исходника; child group keys из `src/content/model-assets.ts` включают `stock__val_stock`, `handguard__val_guard`, `pistolgrip__val_grip`, `magazine__val_20`, `handguard__val_rail`, `pistolgrip__val_ergo`, `magazine__val_10`, `magazine__val_30`, `mount__val_mount`, плюс предусмотренные handguard grips/lights/lasers. Не удалять группы/IDs, оставлять registry fallback до загрузки GLB. Default не включает mount, но предусмотренный боковой `val_mount` — только если инвентарь/слоты его включают.

Источник: девять разных оригинальных фотографий одной AS Val, подробно подписанных как правый и левый профиль со stock extended/folded и close-ups. Автор фото Vitaly V. Kuzmin (кредит/водяной знак); права на повторное использование не найдены. Сохранять только приватно, не переносить фото в runtime/public; изображения показывают наружную форму, но не дают end-on/underside и не оправдывают копирование номеров/маркировок.

## Пять силуэтных опор

1. **Интегральный длинный suppressor:** доминирующая цилиндрическая передняя линия — продолжение общей оси barrel, заметно крупнее тонкого ствола и с прямым переходом к переднему узлу; отдельные передняя крышка и задняя ступень читаются в профиль. Это цельная наружная часть base body, не длинный game suppressor-модуль.
2. **Компактная receiver/action коробка:** короткая квадратная масса между stock/grip и длинным fore-end. Вынести крышку, боковые плоскости и штампованные уступы в крупные facets, но не выдумывать окна или узнаваемые serial. `action` группа должна сохранять текущий кодовый contract анимации, а не отдельную физическую механику.
3. **Трубчатый складной приклад:** `val_stock` — узкий двух/трёхстержневой каркас с отдельной пяткой, открытыми пустотами и шарнирной посадкой в receiver. Оба положения есть в точных фото; если project runtime не переключает stock pose, экспортировать default extended static и не добавлять собственный rig. В folded state металл проходит вдоль receiver, не образуя сплошной массив.
4. **Узкое цевьё и хват:** `val_guard` короткое, компактное, угловатое, темный матовый пластик с крупными плоскостями и ограниченными вертикальными гранями/канавками. Стыки с suppressor/body видны и ровные. Не рисовать деревянную ложу VSS на AS Val.
5. **Короткий прямой magazine:** default `val_20` заметно короче и шире, чем VSS `val_10`; выделить слегка изогнутый коробчатый профиль и крупные боковые рёбра/панели. Не растягивать по длине, не менять сечение и seat под визуальные ожидания другого магазина. Отдельные `val_30` и `val_10` остаются совместимыми child-assets по текущим IDs.

## Сетка, UV и материалы

Общий стиль — angular low-poly с плоскими контролируемыми участками и фасками только на важных бликах/ребрах; не использовать гладкий photoreal sculpt. Вытянуть узнаваемые контуры stock-frame, suppressor-cylinder, receiver и magazine, а micro fasteners/minute stamps оставить нормалью/roughness либо убрать. Сохранять пропорции одного полного объекта: receiver короткий, suppressor и fore-end длинные, рамочный stock визуально тонкий.

UV unwrap: крупные цилиндрические полосы подавителя развёртывать с seam снизу/с тыльной стороны; отдельно защитить видимый длинный боковой участок от stretching. Для receiver — острова по крупным плоскостям без зеркалирования уникальных marking regions (в финале маркировки не размещать); для трубчатого stock вести острова вдоль стержней. Использовать текущую текстурную/материальную систему и разделить лишь функционально значимые поверхности: тёмный matte blackened steel для suppressor/receiver/stock; более шероховатый графитовый polymer для handguard/grip; магазин — матовый полимер с крупным рельефом. Без branded serials, logos, флагов, цифр, текстовых decals, сверхглянцевого чёрного. Карта roughness должна сохранять читаемые отдельные формы при текущем lighting; AO не должна пачкать стык подавителя/цевья и открытые части рамки приклада.

## Asset keys, LOD, анимация и приёмка

Поддерживать существующие export groups точно, включая `body`/`action` и child key names. Модульная поверхность не должна дублироваться внутри base mesh так, чтобы получались z-fight/двойные материалы. Сохранить текущие weapon transforms, IK-hand targets, ADS sight line, reload-mag socket, camera/render passes и fallback path. Не создавать skeletal engine и не добавлять action tracks. Existing `weapon-animation.ts` has an AS Val presentation style; Sol should preserve its reference points and verify the current action movement still lands after new mesh export.

До моделирования измерить текущий asset budget; LOD0 держит contour полного suppressor, receiver, hollow stock, magazine length/curve, iron sight line; LOD1 убирает мелкие винты/насечки и микроштамп, но не схлопывает рамку stock, не меняет длинный передний цилиндр и не объединяет текстурно различающиеся пластик/сталь. Подготовить статический extended-stock default. Любой будущий folded-stock state — только отдельное значение/mesh состояние, согласованное с catalog/presentation; текущий бриф не дает разрешения на runtime animation.

Для Sol-экспорта передать: triangles LOD0/LOD1 на каждую группу, material slots, texture resolution/bytes, GLB compressed bytes, group-name report и screenshot full left/right + 3/4 + ADS. Review: убедиться, что это AS Val с integral suppressor (не VSS wooden stock), asset key/load path не ломаются, magazine/stock modules swap в существующих sockets; проверить анимационный action/ADS/reload, IK, sprint, weapon switching и всех render passes; оставить geometry fallback работающим при загрузке. Сравнить target с изображениями `AS-Val-01/09/12/16/19/21/22/25/26`; не добавлять серийный номер/реальные markings. Любой clipping/отрыв tube-stock joint/потеря полого силуэта или падение draw calls/LOD бюджета без объяснения — fail.

## Пять конкретных формовочных решений

- Suppressor выполняется 3-4 сегментными переходами с крупной гранёной фаской на торцах, длинная внешняя труба — почти прямой цилиндрический low-poly силуэт; продольную насечку моделировать только как редкие крупные facets/roughness, не мелкую текстуру.
- Receiver имеет box-like, но не кубическую боковую форму: верхняя cover seam, ступенчатая задняя грань, наклонный передний переход, компактные control tabs разного размера; сохранить силуэт без копирования маркировок.
- Stock rods тонкие относительно grip и receiver; top/bottom members явно разделены negative space; butt pad небольшой и прямоугольный, два боковых членения не должны перекрывать друг друга.
- Grip отвесно наклонён и образует отдельный толстый polygonal block под receiver; `val_ergo` заменяет только эту группу, не меняет trigger guard.
- Magazine retains straight top insertion zone plus modestly curved lower body, broad panel/rib rhythm and visible floor plate; `val_10` — compact short, `val_30` — distinctly longer child variant.
