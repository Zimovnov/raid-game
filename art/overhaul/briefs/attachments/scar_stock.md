# SCAR · регулируемый приклад (`scar_stock`)

## Геометрическая цель

Регулируемый складной приклад SCAR-L: несущий полимерный корпус, выраженный боковой шарнир, площадка щеки и затыльник. Профиль взять из SCAR-L производителя/receiver+stock close-ups; не смешивать с длинной TPR precision-опорой.

## Место на оружии и признаки формы

Посадку ограничить существующим каталоговым интерфейсом `scar-stock`: не двигать protected body, не менять родительскую точку крепления и не утверждать реальную взаимозаменяемость. Для моделирования сравнить конкретные файлы и использовать только те виды, где target-компонент различим:

- `scar_stock__fn_scarl_mk2_stock_folded.png` — manufacturer full profile with stock folded; new distinct product image useful for stock-fold joint/silhouette.
- `scar_stock__armsweb_scarl_mk2_oblique.jpg` — licensed replica full three-quarter/front composition; whole silhouette, stock and magazine placement.
- `scar_stock__armsweb_scarl_muzzle_detail.jpg` — distinct muzzle/front sight and handguard junction close-up; external shape only.
- `scar_stock__armsweb_scarl_front_rail_detail.jpg` — distinct front top/side rail and handguard profile detail.
- `scar_stock__armsweb_scarl_receiver_detail.jpg` — distinct receiver controls/marking and stock hinge interface close-up; no branding should be modeled.
- `scar_stock__armsweb_scarl_stock_detail.jpg` — distinct buttstock adjustment/hinge and buttpad close-up.
- `fn_scarh_pr_01.png` — Официальное изображение FN SCAR-H PR adjustable; stock виден в конфигурации оружия..
- `fn_scarh_pr_05.png` — Официальное изображение FN SCAR-H PR adjustable; stock виден в конфигурации оружия..

## Материалы, UV и уровни детализации

Чёрный/койотный усиленный полимер, металлический шарнир и резиновая пятка. UV отдельно на cheek pad/затыльник; LOD1 сохраняет петлю и ступени регулировки.

LOD0 — чистый игровой внешний силуэт и крупные рабочие формы; LOD1 упрощает насечку/малые уступы, сохраняя длину, поперечное сечение, видимые окна и место крепления. Не создавать скрытые производственные детали/внутренности и не переносить logos, товарные надписи или пиксели источников в игру. Патроны, если предмет магазин, остаются у авторитетного игрового состояния и не запекаются в текстуру.

## Граница доказательств

Пять и более разных manufacturer/owner source compositions SCAR-L показывают stock hinge и установленный контур; галерея FN SCAR-H ниже используется только как отличительный вариант. Все внешние фотографии в source library — приватные reference-only, если конкретная запись явно не задаёт более широкую лицензию; поиск/локальное хранение не предоставляет права на публикацию или включение изображения в runtime.
