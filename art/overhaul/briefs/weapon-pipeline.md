# Weapon GLB metre-frame pipeline — Luna → Sol → Review

## Цель и текущий контракт

Новые сложные weapon GLB должны собираться в естественной пропорции, а не масштабироваться в габарит placeholder-детали. Сохраняются текущие catalog item IDs, `body`/`action`, attachment assetKey groups, weapon layout, ADS/ballistics sockets, IK/grip targets, анимационные poses и render passes. Это расширение importer/manifest, не новый skeletal engine и не второй source of truth. Текущие Part-модели остаются fallback при отсутствии/ошибке загрузки. Защищённые/старые GLB остаются на действующей нормализованной ветке без массовой конвертации.

Фактический путь сегодня: `weaponModel()` в `src/rendering/models.ts` генерирует Part-плейсхолдеры из `additionalWeaponBase()`/`arsenalModuleModel()`, назначает им assetKey; body/action назначаются отдельными группами. `ModelAssets.load()` в `src/rendering/model-assets.ts` находит extras `assetKey`/`lod`, bake-ит исходную world-матрицу и требует каждую объявленную группу в LOD0 и LOD1. Затем `ModelAssets.add()` инстансит GLB, применяя `model(part.p, part.s, part.r)` к mesh-группе при первом Part в группе. Это означает, что масштаб нового сложного receiver/body сейчас зависит от размеров процедурной коробки, а не от авторской модели; так масштабировать новую форму нельзя. Текущий `Part.asset` (`src/domain/types.ts`) содержит только weapon/group/first. Рендерер объединяет метрики/показывает ассеты через обычный импортный batch, и его pass lifecycle в `babylon-bridge.ts` должен сохраниться.

## Рекомендуемое расширение, сохраняя обратную совместимость

Добавить явно версионированный frame, отсутствующее поле трактовать строго как старый `normalized` контракт:

```ts
ModelAsset = {
  url: string;
  groups: string[];
  frame?: "normalized" | "meters";
  // meters only; stable authored weapon-root convention, optional per-group offsets
  root?: { origin: "weapon-layout-root"; axes: "x-lateral_y-up_z-muzzle-negative" };
  groupTransforms?: Record<string, { p: Vec3; s: Vec3; r: Vec3 }>;
}
```

`Part.asset` расширить опциональными `frame`, `p`, `s`, `r` полями для явного instance transform. Если asset/part не задаёт их, оставить точное прежнее поведение. Если manifest говорит `meters`, никогда не получать размер/ориентацию body или модуля из `Part.s`/placeholder box; использовать явный manifest/group transform и metre-frame asset. Body — целый собранный предмет в weapon root frame. Приклады/цевья/магазины/оптика — отдельные группы, authored в метрах и с pivot ровно на объявленном socket; world socket offset добавляется из единого runtime `weaponLayout`. `s=[1,1,1]` — норма; scale разрешён для явной художественной поправки/совместимости и виден в QA, не auto-fit по bounds.

Оси должны быть зафиксированы и проверяться: X — в стороны, Y — вверх, Z отрицательный — к muzzle, Z положительный — к buttstock. Root ставить на стабильный game weapon-layout frame, а не на произвольный центр bbox; в GLB локальные transforms нужно заранее применить, pivot/ось/единицу проверить на тестовой сцене. Если Blender сцена использует другие units/origin, конвертировать только при экспорте явно и ровно один раз. Не компенсировать неверную ось двойным поворотом attachment или камеры.

`body` получает identity-root transform в weapon frame и содержит неизменяемые корпус/неразъёмные части. `action` остаётся отдельной группой только для реально движущегося bolt/charging assembly: во время pose изменяется её позиция по текущему `weaponMotion().bolt` в том же корневом frame; неподвижные рычаги и деталировка не должны прыгать вместе с ней. Модульные группы сохраняют существующий naming, например `stock__<def>`, `handguard__<def>`, `magazine__<def>`, `mount__<def>`, `mount_optic__<def>`, nested `handguard_grip__<def>` / `handguard_light__<def>`. Изменение assetKey только вместе с catalog tree и manifest.

Nested optic: renderer уже создаёт path для дочернего модуля и поднимает offset относительно parent, но seat offset сейчас частично задан процедурным правилом `optic` в `models.ts`. Для metre GLB решить посадку одним согласованным сокетным трансформом parent mount → optic group; избежать двойного `+Y` и не менять optic zero/aim height скрытым сдвигом mesh. Истинный ADS height остаётся `weaponLayout`/aim contract; если нужны новые значения, их отдельно авторизовать и тестировать как gameplay/layout tuning.

## Анимация, IK и render passes

- Не вводить Armature/skinning/skeleton для rigid assembly. Сохранить независимое инстансирование статического body, detachable modules, weapon action и мировой/held presentation.
- `weaponLayout` остаётся единственным источником `muzzle`, `support`, `aimHeight`, module anchors; `weaponMotion`/held-weapon остаются источниками reload/recoil/bolt/pump transforms и hand targets. Не копировать эти числа внутрь GLB custom props как параллельный runtime конфиг.
- Не переносить magazine rounds/loaded state в модель. Состояние и патроны остаются у текущей item/inventory модели; GLB только визуализирует installed module.
- Импортные группы должны работать во всех существующих colour/shadow/depth/render passes: один стабильный assetKey/group должен указывать на ту же геометрию/LOD, `beginPass()`/`finishPass()` и сбор `drawCalls/instances/triangles` не обходятся special-case веткой.
- При load failure остаётся текущий безопасный Part fallback и видимая ошибка ассета; не принимать fallback preview за успешную проверку GLB.

## Конкретная приёмка и test fixtures

1. **Manifest/load:** fixture с одним старым `normalized` защищённым asset без frame-поля и одним новым `meters` asset. Старый даёт тот же matrix/scale до и после; новый грузит ровно по 1 единице на 1 метр, имеет валидные body/action и LOD0/LOD1 у каждой обязательной группы. Проверить missing group, плохой frame и отсутствующий LOD как честную load error + fallback, без NaN/частичного скрытия оружия.
2. **Нет деформации placeholder:** заменить геометрию процедурной коробки body на форму с сильно иными bbox при одинаковом Part-transform. `meters` GLB остаётся неизменного размера и формы; normalized fixture сохраняет старое нормирование. Проверить width, total length, axis и bounds метриками/контрольным рендером.
3. **Weapon root / ADS / muzzle:** хотя бы fixture для `weapon_hk416a5` и короткой платформы `weapon_pp91` или `weapon_scorpion`; визуальный muzzle center совпадает с `weaponLayout(...).muzzle` в пределах принятого art tolerance, sight-line пересекает aim anchor без скрытого поворота, support hand target ложится на цевьё. Баллистические и ADS значения не должны меняться только из-за mesh/frame.
4. **Catalog tree и nested modules:** собрать default + сменный magazine, stock/handguard и mount+optic. Проверить attachment anchors из единого layout, отсутствие двойного optic offset, визуально плотную посадку и одинаковую конфигурацию в presentation tree, inventory tree, inspect view и dropped/world weapon. Тестировать `first` grouping: один instance transform на группу, нет дубль-геометрии от каждого Part.
5. **Animation/IK:** idle → ADS → fire/recoil → reload/swap → inspect; bolt/action смещается только при ожидаемой pose, body и рука не отделяются, сменный магазин держится за фактический mag pivot, support hand остаётся на модуле; проверить dropped weapon в это же время без утечки pose.
6. **Render & performance:** пройти действующие passes для held, character/world, shadow/depth/ID picking где включены; нулевые missing assetKey/load errors после warm load; снять `ModelAssets.finishPass()` метрики при фиксированной камере, записать draw calls/triangles/instances и GLB bytes. Убедиться, что LOD switch на мировом пороге `12` не меняет габарит, ориентацию или socket continuity; LOD1 asset groups обязательны по существующей загрузочной проверке.
7. **FPS/runtime:** одна фиксированная build/scene, одинаковые viewport/DPR/camera и weapon tree, warm-up после загрузки, 60-секундная запись кадров отдельно для weapon preview, held ADS/reload и world weapon. Отдельно CPU frame intervals/percentiles и browser memory если доступна; не выводить «FPS улучшен» из одного статичного кадра. Аудит/fixture не должен менять ammo/weapon simulation, render pass selection или managed browser policy.

## Кто за что отвечает

**Luna → Sol:** сначала проверяет frame и границы contract, затем Sol реализует loader/manifest без изменения layout, IK или state model. **Review:** сверяет тесты выше на старом и новом asset, снимает фиксированные рендеры и метрики, проверяет fallback/error path и существующую игру; прохождение одного import-preview само по себе не подтверждает ADS, IK или игровые passes.
