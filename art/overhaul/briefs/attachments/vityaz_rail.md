# ПП-19-01 · короткая rail-shell система B-21M

**Решение Luna: PASSED.** Target — нижняя/боковая оболочка штатного B-21M для Vityaz-family, как в отдельной manufacturer gallery. В game child `guard_mini_rail` реализовать только короткую оболочку вокруг нижнего fore-end; не моделировать Vityaz-MO как полный новый upper receiver, не добавлять длинные B-20-style rails и не включать насадки из mounted фото.

## Силуэт / конструкция для вида

1. Короткая U-образная shell над barrel/fore-end; open upper channel сохраняется и виден в переднем/заднем oblique.
2. Три rail bands — верхняя и короткие боковые/нижняя поверхности — заканчиваются в пределах переднего grip. Верхняя плоскость не становится длинной непрерывной планкой на весь receiver.
3. На видимых боках повторить круглые/овальные окна B-21M с одинаковым шагом; задняя часть имеет уступ и отдельное sling opening, передний край короткий и прямой.
4. Rail teeth крупные и ровные, 8–12 на каждой игровой сегментированной поверхности; не включать B-21 side-mounted accessories.
5. Shell — чёрный анодированный металл с ясно читаемыми рёбрами; не заменять полимерной поверхностью штатного `vityaz_guard`.

## Текстура, LOD, сопряжение

UV на общий rail attachment atlas 512²: крупные боковые плоскости, торцы и внутренний channel; швы вниз/внутрь. Roughness 0.55–0.68, умеренный металл, без ярких логотипов. LOD0 1100–1700 tris, LOD1 400–700; сохранить U-channel, короткие окна и rail-band layout, сократить мелкие tooth/внутренние детали.

Меш `handguard__vityaz_rail` статический, meters, существующий `vityaz-handguard` child pivot. Не менять barrel/front sight, IK, aim animation и render passes. Проверить стык с базовым receiver и дульной зоной, хват, ADS, видимость внутри/снаружи, LOD transition и отсутствие двойного guard в fallback.

Четыре detached кадра — официальная B-21M gallery (левая/правая стороны, торцы и верхний channel); два mounted кадра Vityaz-MO показывают масштаб/receiver clearance, но внешние MO accessories исключены. Это ровно шесть физических файлов; не превращать разные поверхности одного composite в дополнительные фото. `sources.json` сохраняет источник Zenitco и reference-only provenance.
