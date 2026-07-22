# План реализации

## M0 — контракт и read-only bridge

- [x] зафиксировать ТЗ и архитектуру;
- [x] описать JSON-контракты;
- [x] создать CLI `Pull Selected Clip`;
- [x] проверить CLI на реальном MIDI-клипе Live;
- [x] добавить fixture и контрактный тест payload.

Результат: выбранный клип стабильно читается в нормализованный JSON без записи.

## M1 — JUCE WebView prototype

- [x] проверить статический visual spike внутри plugdata VST3;
- [x] подтвердить, что Harmony Lab имеет изолированный `focus=lab` mode;
- [x] создать JUCE 8 VST3/Standalone shell с WebView2;
- [x] описать JS → native MIDI preview adapter;
- [ ] установить локальный MSVC/CMake toolchain;
- [ ] собрать VST3 и загрузить существующий Harmony Lab UI внутри Live;
- [ ] проверить add/move/resize/delete и MIDI preview через receiver track;
- [ ] выделить lab frontend из ReferenceCompare в самостоятельный web bundle.

Результат: существующий полноценный редактор работает внутри Live без
повторной реализации его GUI в Pure Data.

## M2 — live Pull и состояние

- [ ] local transport bridge ↔ JUCE/WebView;
- [ ] кнопка Pull;
- [ ] recovery snapshot;
- [ ] clip locator и fingerprint;
- [ ] отображение connection/conflict state.

## M3 — Commit

- [ ] dry-run validation;
- [ ] безопасная модификация исходного clip;
- [ ] конфликт внешней редакции;
- [ ] Commit as New;
- [ ] проверка Live Undo.

## M4 — MIDI drag-out

- [ ] минимальный native file-drag proof of concept;
- [ ] временный SMF writer;
- [ ] внешний drag в Live 12.4.x;
- [ ] cache TTL cleanup;
- [ ] интерфейс между web editor и JUCE drag service.

## M5 — продуктовый MVP

- [ ] Ableton template;
- [ ] загрузка гармонии из ReferenceCompare;
- [ ] Roles/Degrees modes;
- [ ] zoom, scroll, marquee и keyboard shortcuts;
- [ ] полный acceptance test из PRODUCT_SPEC.
