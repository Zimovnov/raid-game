# BREN 2 · контурная рукоятка (`bren_grip`)

## Геометрическая цель

BREN 2 эргономичная рукоятка: выраженная задняя дуга, передняя вертикальная насечка, широкая пятка и крупная сменная задняя накладка. Сохранять отдельный плавный стык с trigger housing; не подменять AR grip.

## Место на оружии и признаки формы

Посадку ограничить существующим каталоговым интерфейсом `bren-grip`: не двигать protected body, не менять родительскую точку крепления и не утверждать реальную взаимозаменяемость. Для моделирования сравнить конкретные файлы и использовать только те виды, где target-компонент различим:

- `bren_grip__official_01.jpg` — full silhouette, side 1.
- `bren_grip__official_02.jpg` — full silhouette, opposite side; confirm not mirrored copy.
- `bren_grip__official_03.jpg` — upper receiver/optic interface close view.
- `bren_grip__official_04.jpg` — receiver/trigger area close view.
- `bren_grip__official_05.jpg` — handguard/front section close view.
- `bren_grip__official_06.jpg` — receiver markings/side details close view.

## Материалы, UV и уровни детализации

Чёрный/тёмно-оливковый texture polymer, roughness чуть выше на насечках; UV разделить на backstrap and side panels. LOD1 оставляет пятку и дугу.

LOD0 — чистый игровой внешний силуэт и крупные рабочие формы; LOD1 упрощает насечку/малые уступы, сохраняя длину, поперечное сечение, видимые окна и место крепления. Не создавать скрытые производственные детали/внутренности и не переносить logos, товарные надписи или пиксели источников в игру. Патроны, если предмет магазин, остаются у авторитетного игрового состояния и не запекаются в текстуру.

## Граница доказательств

Manufacturer system photos show grip across full profiles/close receiver detail; no detached bottom orthographic view. Hidden surfaces can be a neutral game-fit approximation. Все внешние фотографии в source library — приватные reference-only, если конкретная запись явно не задаёт более широкую лицензию; поиск/локальное хранение не предоставляет права на публикацию или включение изображения в runtime.
