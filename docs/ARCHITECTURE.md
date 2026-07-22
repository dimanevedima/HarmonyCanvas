# Архитектура Harmony Canvas

## Компоненты

```text
ReferenceCompare / Harmony Lab
  composer_lab.py + существующий HTML/CSS/JS editor
             │ localhost в M1 / embedded resources в MVP
             ▼
Harmony Canvas VST3 (JUCE 8 + WebView2)
  Web UI + editor state + native MIDI adapter
       │                              │
       │ JSON                        │ MIDI stream
       ▼                              ▼
Harmony Bridge                  Ableton MIDI Bridge track
  AbletonJS                           │
       │                              ▼
       ▼                         Receiver instrument
Ableton Live API
  Pull / Commit / Create clip

JUCE native services
  WebView bridge + SMF writer + external OS drag
```

## Почему WebView, а не повторная реализация GUI в Pd

Harmony Lab уже содержит piano roll, chord lane, редактор свойств аккорда,
палитры, drag/resize, marquee selection и проверенную музыкальную модель.
Стандартный patch plugdata не исполняет HTML/CSS/JavaScript, поэтому перенос
интерфейса в Pd потребовал бы повторной реализации почти всего editor layer.

WebView2 позволяет использовать существующий UI непосредственно, а JUCE нужен
в любом случае для VST3 MIDI I/O и внешнего file drag. Статический plugdata
prototype сохраняется в `plugdata/` как подтверждённый visual spike, но больше
не является продуктовой оболочкой.

## Границы ответственности

### Harmony Lab web UI

- рисует piano roll, chord lane, playhead, palette и inspectors;
- выполняет интерактивные note/chord edits;
- показывает Roles/Degrees и harmonic annotation;
- общается только с версионированным native/API adapter;
- не обращается напрямую к объектам Live.

### Harmony engine

- на M1 используется существующий `ReferenceCompare/app/composer_lab.py`;
- разбирает аккорды и сохраняет точное chord state;
- рассчитывает ладовые ступени, voicings, палитры и рекомендации;
- аннотирует каждую ноту относительно звучащего в этот момент аккорда;
- покрыт существующими тестами ReferenceCompare.

На M1 engine работает как локальный sidecar через текущий FastAPI. Перед
дистрибуцией он будет выделен в отдельный пакет либо перенесён в процесс
плагина; web UI не должен зависеть от способа его размещения.

### JUCE VST3 shell

- размещает WebView2 и загружает focus mode лаборатории;
- переводит preview events из JavaScript в MIDI output плагина;
- хранит plugin/session state;
- предоставляет native functions для Pull, Commit и drag-out;
- в MVP обслуживает встроенные web assets без сетевого запроса.

### Ableton bridge

- разрешает `detail_clip` в устойчивый locator;
- читает расширенные ноты;
- считает fingerprint;
- применяет безопасный Commit;
- создаёт новый клип;
- не содержит музыкальной логики.

### MIDI drag service

- принимает подготовленный MIDI payload;
- атомарно создаёт `.mid` в управляемом cache;
- начинает external file drag;
- не удаляет файл раньше, чем Live закончит чтение;
- сообщает web UI результат начала операции.

## Транспорт

M1 использует локальный HTTP API существующего Harmony Lab и native events
WebView2. Формат проекта остаётся единым и описан JSON Schema в `protocol/`.

MVP встраивает frontend resources в VST3. Транспорт не является источником
истины: каждая сторона хранит последний подтверждённый snapshot и request ID.

## Идентичность клипа

Публичный Live API не обещает постоянный ID между перезапусками Set. Поэтому
locator хранит несколько признаков:

- runtime Live object ID;
- track index/name;
- Session slot либо Arrangement start time;
- clip name и loop boundaries;
- fingerprint содержимого на момент Pull.

Runtime ID используется в текущей сессии. Остальные признаки позволяют найти
клип повторно или потребовать ручное подтверждение после reload.

## Fingerprint

Fingerprint вычисляется из нормализованных полей:

```text
clip metadata + sorted notes(
  pitch, start_time, duration, velocity, mute,
  probability, velocity_deviation, release_velocity
)
```

`note_id` не входит в музыкальный fingerprint, поскольку является технической
идентичностью Live.

## Потоки времени

- внутреннее время — beats от начала клипа;
- UI показывает bars/beats с учётом размера;
- MIDI drag export преобразует beats в ticks по PPQ;
- Arrangement position хранится отдельно от clip-local note time;
- tempo не умножает и не растягивает note positions.
