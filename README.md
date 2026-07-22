# Harmony Canvas

Harmony Canvas — цветной гармонический MIDI-редактор для Ableton Live. Готовый
интерфейс Harmony Lab размещается внутри JUCE VST3 через WebView2, а обмен с
настоящими MIDI-клипами Live выполняется через AbletonJS.

Проект решает одну конкретную задачу: писать мелодии, басы и дополнительные
голоса поверх меняющейся гармонии, постоянно видя роль каждой высоты в текущем
аккорде.

## Принятые решения

- Существующие HTML/CSS/JS piano roll, chord lane и chord editor переиспользуются
  из Harmony Lab; нативный piano roll Live не модифицируется.
- `Pull Selected Clip` получает активный MIDI-клип через AbletonJS.
- `Commit` обновляет исходный клип, `Commit as New` создаёт новый.
- Drag-out создаёт временный `.mid` и начинает системное перетаскивание через
  JUCE-слой самого Harmony Canvas VST3.
- Drag-in MIDI-клипа с timeline Live не является обязательным: Live не отдаёт
  такой клип VST3 как обычный файл. Его заменяет `Pull Selected Clip`.
- MIDI routing закрывается готовым Ableton template.

## Документы

- [Финальное ТЗ](docs/PRODUCT_SPEC.md)
- [Архитектура](docs/ARCHITECTURE.md)
- [План реализации](docs/IMPLEMENTATION_PLAN.md)
- [Протокол обмена](protocol/README.md)

## Первый запускаемый компонент

`bridge/pull-selected-clip.mjs` читает открытый в Detail View MIDI-клип без его
изменения и печатает нормализованный JSON.

```powershell
cd bridge
npm install
npm run pull:selected
```

Перед запуском Live должен быть открыт, а AbletonJS Control Surface — активен.

## Структура

```text
harmony-canvas/
├─ bridge/       AbletonJS-команды Pull/Commit
├─ docs/         продуктовая и техническая спецификация
├─ plugin/       JUCE VST3/Standalone WebView shell
├─ plugdata/     сохранённый статический visual spike
├─ protocol/     стабильные JSON-контракты
└─ tests/        fixtures и контрактные тесты
```
