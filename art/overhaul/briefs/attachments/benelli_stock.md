# M4 · регулируемый приклад с рукояткой (`benelli_stock`)

## Геометрическая цель

Регулируемый Benelli M4 buttstock: длинная скелетная боковина с крупными окнами, подвижной верхней щекой, толстой резиновой пяткой и интегральной пистолетной рукоятью. Только adjustable silhouette; fixed-stock Benelli refs не считать формой target.

## Место на оружии и признаки формы

Посадку ограничить существующим каталоговым интерфейсом `benelli-stock`: не двигать protected body, не менять родительскую точку крепления и не утверждать реальную взаимозаменяемость. Для моделирования сравнить конкретные файлы и использовать только те виды, где target-компонент различим:

- `shelltactical-benelli-m4-70085-1.jpg` — Отдельный полный правый профиль телескопического приклада; изображение продавца точно называет Benelli M4 Collapsible Stock/OEM 70085, но не является подтверждением от производителя..
- `shelltactical-benelli-m4-70085-2.jpg` — Установленный приклад, задний левый ракурс на H2O-варианте; полезен для стыка с receiver extension и формы щёчной опоры..
- `shelltactical-benelli-m4-70085-3.jpg` — Установленный приклад, противоположный задний правый ракурс; не переносить детали H2O покрытия/receiver в стандартную конфигурацию..
- `benelliparts-oem70085-1.heic` — Отдельный комплект: приклад и пистолетная рукоятка разнесены; BenelliParts заявляет OEM 70085, сторонний продавец, вариант не подтверждён самим Benelli..
- `benelliparts-oem70085-2.heic` — Другой отдельный ракурс того же retailer-identified 70085 комплекта: видна скелетная опора и отделённая пистолетная рукоятка; оставлять как retail identification, не OEM verification..
- `benelli_stock__riac_01.jpg` — three-quarter to full assembled side overview; fixed stock, full-length barrel and tubular magazine visible.
- `benelli_stock__riac_02.jpg` — near-side product profile, muzzle/front-sight and handguard relationship.
- `benelli_stock__riac_03.jpg` — opposite side profile, receiver controls and ejection-side layout.

## Материалы, UV и уровни детализации

Black reinforced polymer, separate matte rubber pad, dark metal rear locking surfaces. UV split grip/beam/cheek/pad; LOD1 keep skeleton windows and cheek shape.

LOD0 — чистый игровой внешний силуэт и крупные рабочие формы; LOD1 упрощает насечку/малые уступы, сохраняя длину, поперечное сечение, видимые окна и место крепления. Не создавать скрытые производственные детали/внутренности и не переносить logos, товарные надписи или пиксели источников в игру. Патроны, если предмет магазин, остаются у авторитетного игрового состояния и не запекаются в текстуру.

## Граница доказательств

Shell Tactical product page claims OEM Benelli 70085; retailer not manufacturer verification. 3 distinct photographed gallery compositions + 2 BenelliParts refs are local, but no isolated underside/opposite orthographic; reference-only. Все внешние фотографии в source library — приватные reference-only, если конкретная запись явно не задаёт более широкую лицензию; поиск/локальное хранение не предоставляет права на публикацию или включение изображения в runtime.
