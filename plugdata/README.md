# plugdata patch

Здесь появятся:

- `Harmony Canvas.pd` — корневой patch в plugin mode;
- `lua/` — музыкальная модель и команды редактора;
- `ui/` — piano roll, chord lane, ruler и inspector;
- `presets/` — palette и настройки по умолчанию.

Первый visual prototype работает с fixture до подключения live transport.

## Запуск visual prototype 01

В plugdata VST3 нажать `Open Patch...` и открыть:

`C:\Users\smallochko\Documents\HarmonyCanvas\plugdata\Harmony Canvas.pd`

Patch показывает 8 тактов fixture `D Aeolian sketch`: четыре аккордовых
сегмента, меняющиеся по времени фоновые роли высот и четыре тестовые ноты.
На этом этапе элементы интерфейса являются визуальным прототипом; MIDI input
проходит напрямую в MIDI output плагина.
