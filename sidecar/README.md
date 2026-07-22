# Harmony Canvas sidecar

Автономный локальный backend лаборатории. Он использует только стандартную
библиотеку Python и не импортирует ReferenceCompare, его модели, базу данных или
FastAPI.

```powershell
python -m sidecar.server --port 8787
```

Интерфейс откроется по адресу:

`http://127.0.0.1:8787/?focus=lab`

Эскизы сохраняются атомарно в
`%LOCALAPPDATA%\HarmonyCanvas\sketches.json`. Для тестов и разработки путь можно
переопределить через `--data` или `HARMONY_CANVAS_DATA`.

`harmony_engine.py` и исходный UI перенесены из Composition Lab
ReferenceCompare как самостоятельный baseline. Дальнейшие изменения Harmony
Canvas выполняются только в этом репозитории.
