# BREN 2 · длинное цевьё мастерской (`bren_guard_long`)

## Геометрическая цель

Игровое удлинённое BREN 2 цевьё: повторить именно native BREN 2 фасетированный профиль и ритм боковых окон к переднему срезу, а не увеличить AR handguard. Основной интерфейс и верхнюю плоскость не менять.

## Место на оружии и признаки формы

Посадку ограничить существующим каталоговым интерфейсом `bren-handguard`: не двигать protected body, не менять родительскую точку крепления и не утверждать реальную взаимозаменяемость. Для моделирования сравнить конкретные файлы и использовать только те виды, где target-компонент различим:

- `bren_guard_long__official_01.jpg` — full silhouette, side 1.
- `bren_guard_long__official_02.jpg` — full silhouette, opposite side; confirm not mirrored copy.
- `bren_guard_long__official_03.jpg` — upper receiver/optic interface close view.
- `bren_guard_long__official_04.jpg` — receiver/trigger area close view.
- `bren_guard_long__official_05.jpg` — handguard/front section close view.
- `bren_guard_long__official_06.jpg` — receiver markings/side details close view.

## Материалы, UV и уровни детализации

Анодированный алюминий в единой палитре short variant; UV тайлить по длине. LOD1 сохраняет длину и ритм окон, упрощает micro-bevels.

LOD0 — чистый игровой внешний силуэт и крупные рабочие формы; LOD1 упрощает насечку/малые уступы, сохраняя длину, поперечное сечение, видимые окна и место крепления. Не создавать скрытые производственные детали/внутренности и не переносить logos, товарные надписи или пиксели источников в игру. Патроны, если предмет магазин, остаются у авторитетного игрового состояния и не запекаются в текстуру.

## Граница доказательств

Точный SKU long guard не найден; игровая авторская extension adaptation на native BREN chassis. Не выдавать за заводской модуль. Все внешние фотографии в source library — приватные reference-only, если конкретная запись явно не задаёт более широкую лицензию; поиск/локальное хранение не предоставляет права на публикацию или включение изображения в runtime.
