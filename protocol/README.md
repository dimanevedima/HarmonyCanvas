# Протокол Harmony Canvas

Версия MVP: `1.0`

`harmony-project.schema.json` описывает snapshot, которым обмениваются UI,
ReferenceCompare и Ableton bridge.

Обязательные правила:

- время хранится в beats;
- MIDI pitch — integer 0–127;
- duration строго больше нуля;
- velocity — 0–127;
- неизвестные поля допустимы;
- изменение major `protocol_version` требует явной миграции.
