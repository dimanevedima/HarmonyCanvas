# JUCE MIDI drag-out extension

Цель — добавить в нашу сборку plugdata узкую возможность:

```text
Pd message / UI gesture
  → write stable temporary .mid
  → juce::DragAndDropContainer::performExternalDragDropOfFiles(...)
```

Ограничения реализации:

- не удалять временный файл в drag completion callback;
- `canMoveFiles=false`;
- cache directory имеет TTL cleanup на следующем запуске;
- операция запускается только из mouse drag callback;
- никакая работа с файлами не выполняется в audio thread;
- drag-in timeline clip из Ableton не является частью этого модуля.
