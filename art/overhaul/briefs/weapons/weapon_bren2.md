# Luna → Sol: Blender brief — CZ BREN 2 Ms 11″ 5.56

## Зафиксированная цель

Моделировать игровую target-конфигурацию weapon_bren2 на базе CZ BREN 2 Ms 11″, 5.56×45: это ближайшая exact source-конфигурация в official CZ photos, а не утверждение, что runtime-каталог хранит длину ствола. В arsenal-expansion.ts default build задан явно: bren_stock (stock_bren, складной приклад), bren_guard (guard_bren, короткое цевьё), bren_grip (grip_ergo), ar556_30 и bren_muzzle (muzzle_brake); optic не установлен. CZ называет photographed Ms Limited Edition геометрически соответствующим select-fire BREN 2; FDE/OD finish, edition markings и логотип не переносить. Не использовать portrait weapon_bren2-1.jpg: это нерелевантный портрет, удалён из набора.

## Геометрия: 5 silhouette anchors

1. Прямой верхний профиль с непрерывной верхней планкой, массивный цельный верхний ресивер и отдельный более короткий lower receiver с trigger guard.
2. Передняя часть target — короткое 11-inch family цевьё: четыре плоскости с вентиляционными/монтажными зонами, чёткая стыковка с ресивером и открытый участок ствола к компактному дульному тормозу. Длинное цевьё не смешивать с default guard_bren.
3. Приклад складной и регулируемый: отдельный шарнир, прямой прикладной луч, щёка и затыльник; отображать именно открытое положение как idle silhouette, folded state проверить как отдельное положение только если renderer поддерживает.
4. Magazine well широкий, слегка наклонённый, прямой 30-round 5.56 магазин с небольшим изгибом; отдельная читаемая mag release. Grip располагается за шахтой, по AR-like эргономике, не сдвигать вперёд ради референса.
5. Спуск, крупная скоба, двусторонние органы управления и боковые receiver facets формируют узнаваемый lower block; не подменять геометрию плоским AR-15 lower.

## Полигональный бюджет, UV и материалы

Активная сборка LOD0: 9–15k tris; LOD1: 3–6k tris, это бюджет-предположение для первой сборки до runtime profiling. Body/action оставлять действующими группами; модульные assetKey только по зарегистрированным slots: stock_bren, guard_bren, grip_ergo, ar556_30, muzzle_brake. На LOD1 сохранять складной stock, receiver silhouette, magwell, guard profile и muzzle; удалить скрытые стыки, микровинты/насечки. Не дублировать общий body в каждой опции.

Матовый армированный полимер приклада, цевья и grip, тёмный анодированный металл receiver и ствола; FDE/OD снимки не задают runtime palette. Один reused PBR atlas 1–2K на активную конфигурацию, отдельные roughness/metallic маски для steel/polymer; UV receiver and side faces с ровной texel density, seam спрятать снизу/внутри, продольные цилиндры ствола развернуть вдоль оси. Никаких ярлыков edition, serials или копии маркировок.

## Pose/интеграция/приёмка

Сохранить bren layout: muzzle [0,0.027,-0.72], support [-0.066,-0.12,-0.255], stock [0,0.013,0.38], handguard [0,0.012,-0.26], grip [0,-0.145,0.1], magazine [0,-0.218,-0.055]. Сохранить straight action animation, firing/recoil/reload/inspect, body/action groups, IK и render passes. Проверить front/side/3-4, FP camera, world LOD transition, смену каждого active module, тени/depth/material. Приёмка: модель однозначно читается как компактный BREN 2, сток складывается по отдельному шарниру, магwell не даёт щели, и fps не хуже текущего GLB/fallback baseline. Источники: sources.json; 6 официальных CZ photos дают боковые профили и отдельные receiver/handguard details, но не пять независимых полных ортографических видов; rights reference-only.
