# m9_grip — M9A3 · тонкие накладки

- **Цель:** Тонкие штатные M9A3 Vertec-панели, целевой ориентир подтверждён производителем Beretta SKU JGM9A3S. Тонкая, ровная спинка без объемного wrap-around; реальные габариты сопряжения в игре остаются на авторском `m9-grip`.
- **Источники:** 5 различных файлов; все они физически доступны в папке модуля. Права: `reference_only`; владельцы авторских прав не выдавали разрешения на redistributable/runtime использование. Нерелевантные прежние Magpul-файлы записаны как `nonCountingContext`.

## Предметный бриф

1. Изолированный JGM9A3S задаёт панельный контур: плоский щиток с прямой Vertec-спинкой, округлённым нижним углом и неглубокой текстурой; не расширять рукоять в классическую дугообразную 92FS-спинку.
2. Беретта M9A3 RH/LH profile дают парность боков, положение двух утопленных крепёжных точек и линию шва к рамке. Зеркальность геометрии сохраняй, но фактуру UV зеркально не дублируй.
3. Кадры LHaf/RHaf используются только для толщины/спинки и реального перехода panel-to-frame; они показывают установленную деталь, а не скрытую тыльную поверхность.
4. Материал целевой детали — матовый жесткий полимер в tan/black допустимом авторском варианте; лёгкая микрошероховатость, редкие неглубокие stipple/checker patches, без Trident/логотипов.
5. Стык панели к frame моделировать отдельным тонким швом; винтовые посадки неглубокими, без функциональной резьбы; скрытые поверхности не детализировать.

**Материалы/UV.** Авторский каталоговый `grip_m9_sand` остается слегка более песочным по тону, но геометрически тонким Vertec panel. Не смешивать с толстой резиновой версией `m9_rubber`. Бесшовно развернуть боковые панели и отдельную тыльную полосу/поверхность; держать нормальный texel density на передней части рукояти, без логотипов и маркировок.

**LOD.** LOD0: внешние панели, seam, винтовые углубления, рельеф. LOD1: удалить микростиппл геометрией, оставить silhouette и основные пятна шероховатости. LOD2: свести крепёжные детали к плоскому тону, сохранить отличие thin vs wrap-around contour. Runtime ключ: `m9-grip`; interface подгоняется в существующей сборке, не заявляется заводская совместимость.

**Ограничение:** Изолированная официальная фотография детали показывает один наружный ракурс; задняя контактная поверхность отдельно не снята. Определить простую плоскую посадочную сторону по рамке игры, не вводить дополнительные объемные детали. JGM9A3S is the exact named thin Beretta SKU; pistol images are official installed contexts of the M9A3 factory panel, not extra isolated-part views. Preserve a thin Vertec sidewall and separate panel seam; do not add a backstrap wrap.

## Роли кадров

- `JGM9A3S isolated side panel` — Beretta JGM9A3S thin Vertec-style plastic grip, isolated product view; exact M9A3 thin SKU.
- `M9A3 RH profile installed panel` — Beretta M9A3 right-side profile; factory grip panels installed, context for attachment boundary and overall grip contour.
- `M9A3 LH profile installed panel` — Beretta M9A3 left-side profile; opposite grip panel and screw layout visible.
- `M9A3 LH three-quarter installed panel/backstrap` — Beretta M9A3 left three-quarter; grip sidewall and backstrap-to-frame transition visible.
- `M9A3 RH three-quarter installed panel/backstrap` — Beretta M9A3 right three-quarter; opposing panel and grip volume context.
