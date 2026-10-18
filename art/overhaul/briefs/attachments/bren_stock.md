# BREN 2 · складной приклад (`bren_stock`)

## Геометрическая цель

Складной приклад CZ BREN 2: вытянутая телескопическая балка с крупными фасетированными боковыми панелями и широкой резиновой пяткой. CZ stock product gallery показывает по одному боку при двух длинах; не считать позиции выдвижения новыми ортографическими видами.

## Место на оружии и признаки формы

Посадку ограничить существующим каталоговым интерфейсом `bren-stock`: не двигать protected body, не менять родительскую точку крепления и не утверждать реальную взаимозаменяемость. Для моделирования сравнить конкретные файлы и использовать только те виды, где target-компонент различим:

- `bren_stock__official_01.jpg` — full silhouette, side 1.
- `bren_stock__official_02.jpg` — full silhouette, opposite side; confirm not mirrored copy.
- `bren_stock__official_03.jpg` — upper receiver/optic interface close view.
- `bren_stock__official_04.jpg` — receiver/trigger area close view.
- `bren_stock__official_05.jpg` — handguard/front section close view.
- `bren_stock__official_06.jpg` — receiver markings/side details close view.
- `cz_bren_stock_01.jpg` — Detached same-side stock profile, collapsed.

## Материалы, UV и уровни детализации

Чёрный усиленный полимер, separate dark rubber buttpad and metal hinge. UV крупные панели отдельно; LOD1 сохранить фасеты, прорези и контур затыльника.

LOD0 — чистый игровой внешний силуэт и крупные рабочие формы; LOD1 упрощает насечку/малые уступы, сохраняя длину, поперечное сечение, видимые окна и место крепления. Не создавать скрытые производственные детали/внутренности и не переносить logos, товарные надписи или пиксели источников в игру. Патроны, если предмет магазин, остаются у авторитетного игрового состояния и не запекаются в текстуру.

## Граница доказательств

CZ retail product page точно называет CZUB model and shows 3 images: same-side profile at different adjustment positions, not 3 unique views; rifle context pictures complement but there is no opposite isolated profile. Все внешние фотографии в source library — приватные reference-only, если конкретная запись явно не задаёт более широкую лицензию; поиск/локальное хранение не предоставляет права на публикацию или включение изображения в runtime.
