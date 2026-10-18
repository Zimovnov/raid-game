---
name: RAID GAME
description: Монохромный интерфейс подготовки и рейда
colors:
  background: "#080808"
  surface: "#141414"
  panel: "#1c1c1c"
  accent: "#f5f5f5"
  accent-hover: "#d8d8d8"
  text: "#f5f5f5"
  muted: "#b8b8b8"
  border: "#414141"
  error: "#dedede"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(62px, 7vw, 96px)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.1
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0"
rounded:
  control: "2px"
  panel: "2px"
spacing:
  tight: "9px"
  field: "17px"
  panel: "20px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: RAID GAME

## Direction

**Пункт подготовки к рейду.** Интерфейс ведёт игрока к подготовке, сбору отряда, оценке риска и выходу в рейд. Пользователь зафиксировал чёрно-белую минималистичную палитру. Белая заливка принадлежит главному действию; остальные команды отделяются тонкими линиями и иерархией текста. Декоративные эмблемы и имитация военного прибора не нужны.

## Palette and hierarchy

Фон `#080808`, панели `#141414`, поднятая поверхность `#1c1c1c`, текст `#f5f5f5`, пояснения `#b8b8b8`, граница `#414141`. Ошибка и успех различаются явным текстом и контекстом. Выделение, фокус и активное состояние используют белый контур. Предметные и картографические SVG в UI показаны в градациях серого; 3D-мир сохраняет свою художественную палитру.

## Typography and layout

Системный шрифт не поставляется в сборке как файл. Крупное название используется только в меню и доступе. В рабочих экранах заголовки компактны; числовые показатели используют табличные цифры. Меню располагает действия одним столбцом слева поверх затемнения мира. Экран доступа держит одну форму справа. Схрон, оружейная и лобби сохраняют плотность реальных данных и независимую прокрутку.

## Components and states

Основная кнопка белая с тёмным текстом. Вторичная тёмная, с видимой границей; в меню вторичные команды отделены линиями. Минимальная высота главного действия — 48px. Hover, disabled и фокус различимы без анимации положения. Поля имеют подписи. Ошибки объясняют проблему и следующий шаг. Телефон получает отдельный экран остановки до загрузки движка.

Уменьшение движения соблюдает системную настройку. Диалоги сохраняют управление фокусом. Скролл, выделение текста, каретка и фокус используют ту же палитру. Юмор остаётся только в необязательных описаниях предметов; смерть, потери и ошибки пишутся прямо.
