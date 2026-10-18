# m9_rubber — M9A3 · объёмные резиновые накладки

- **Цель:** Авторская объемная резиновая накладка для M9A3 Vertec-формы; производительские ориентиры — Beretta JGM9A3LB/UD5A1517 и Hogue 90000, с увеличенной ладонной толщиной и замкнутым обхватом тыльной стороны. Игровой интерфейс не заявляет внешнюю совместимость.
- **Источники:** 5 различных файлов; все они физически доступны в папке модуля. Права: `reference_only`; владельцы авторских прав не выдавали разрешения на redistributable/runtime использование. Нерелевантные прежние Magpul-файлы записаны как `nonCountingContext`.

## Предметный бриф

1. В отличие от тонкого `m9_grip`, увеличить толщину корпуса в ладонной зоне и замкнуть отдельную резиновую дугу вокруг задней спинки; ориентир по боковому профилю — Hogue 90000 обе стороны.
2. Beretta JGM9A3LB/UD5A1517 показывают форму и резиновую фактуру производителя; это два SKU/цвета, не одна и та же деталь. Беречь характерные мягкие округлые переходы, без фирменных медальонов/логотипов.
3. Hogue 90179 использовать только для того, как wrap-around возвращается за панель и меняет общий изгиб backstrap; это G10, не резина и не целевой материальный образец.
4. Оставить боковые поверхности без новых выступающих пальцевых канавок, если они не следуют выбранному визуальному силуэту; рельеф крупный, матовый, равномерно шероховатый.
5. Скрытая посадочная плоскость и отверстия под крепёж подогнать к игровому `m9-grip`; не моделировать устройство/монтаж изделия.

**Материалы/UV.** Матовая тёмная резина с отдельной roughness-реакцией; UV переносит только абстрактный stipple/мелкую текстуру, не эмблему и не надписи. Бесшовно развернуть боковые панели и отдельную тыльную полосу/поверхность; держать нормальный texel density на передней части рукояти, без логотипов и маркировок.

**LOD.** LOD0: внешние панели, seam, винтовые углубления, рельеф. LOD1: удалить микростиппл геометрией, оставить silhouette и основные пятна шероховатости. LOD2: свести крепёжные детали к плоскому тону, сохранить отличие thin vs wrap-around contour. Runtime ключ: `m9-grip`; interface подгоняется в существующей сборке, не заявляется заводская совместимость.

**Ограничение:** Каталог не фиксирует конкретный фирменный SKU и Hogue / Beretta фотографии отличаются деталями. Зафиксировать единый авторский профиль: утолщённая ладонная часть + непрерывный wrap-around backstrap; G10 кадр только для объёма задней дуги. Author-created thick rubber grip uses Beretta/Hogue M9A3-compatible rubber references for wrap-around volume and texture. Hogue 90179 G10 is geometry-only backstrap archetype; no material equivalence, brand compatibility, markings or exact SKU claim.

## Роли кадров

- `Hogue 90000 installed left/three-quarter` — Hogue SKU 90000; installed M9A3/Vertec overmolded rubber wrap-around grip, oblique/one-side view.
- `Hogue 90000 opposing installed side` — Hogue SKU 90000; opposing installed view of wraparound grip and backstrap contour.
- `Beretta JGM9A3LB isolated black rubber product view` — Beretta JGM9A3LB current black rubber wrap-around product, isolated panel/product view.
- `Beretta UD5A1517 tan rubber product view (alternate SKU)` — Beretta UD5A1517 tan rubber wrap-around product image; alternate product/colour, not asserted as same SKU as JGM9A3LB.
- `Hogue 90179 wrap-around backstrap top/rear shape archetype (G10, non-rubber)` — Hogue SKU 90179 M9A3/Vertec wrap-around G10 installed top/rear aspect; geometry-only backstrap/overall-volume cue, NOT a rubber or target-material reference.
