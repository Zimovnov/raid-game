# SCAR-L · портированный дульный блок (`scar_brake`)

## Геометрическая цель

Авторский SCAR-L 5.56 brake: короткий, чуть более широкий прямоугольный корпус вокруг цилиндрической базы; две симметричные крупные боковые портовые группы, верхняя продольная грань и отчётливая передняя корона. Отличать от длинного suppressor и от штатного flash hider; не копировать внешнюю маркировку или exact manufacturer SKU.

## Посадка и виды

Сохранить `scar-muzzle` game interface. 5 изолированных реальных 5.56 brake views:

- `scar_brake__brake_archetype_01.jpg` — передне-боковой 3/4 профиль.
- `_02.jpg` — задний угол, внешний shoulder.
- `_03.jpg` — верхняя сплошная грань корпуса.
- `_04.jpg` — открытые боковые порты.
- `_05.jpg` — независимый боковой угол для сравнения фасок.

FN/ArmsWeb SCAR-L imagery remains platform context only: no exact target brake shown. The five source products supply the component exterior archetype, not a SCAR-specific model fitment claim.

## Материалы, UV и LOD

Фосфатированная тёмная сталь; UV отдельными островами для корпуса/короны и порта, внутренняя темнота — roughness/base color. LOD0 сохраняет две портовые группы, длину и корону; LOD1 упрощает фаски, не меняя силуэт.

## Решение и ограничения

PASSED для авторского внешнего 5.56 muzzle brake. Точная модель/производственные размеры не заявлены; оставлять интерфейс на существующем game socket. Все фото reference-only; никаких лого или исходных фотоматериалов в runtime.
