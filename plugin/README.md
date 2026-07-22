# JUCE WebView shell

M1 загружает существующий полноэкранный режим Harmony Lab прямо в VST3:

`http://127.0.0.1:8000/?focus=lab`

Так сохраняются существующие HTML/CSS/JS, chord editor и piano roll. Встроенный
WebView2 bridge заменяет WebAudio preview на MIDI output плагина.

Для другого адреса перед запуском DAW можно задать переменную окружения
`HARMONY_CANVAS_LAB_URL`.

## Сборка

Требуются CMake 3.22+, Visual Studio 2022 Build Tools с workload
`Desktop development with C++` и WebView2 Runtime.

```powershell
cmake -S plugin -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --target HarmonyCanvas_VST3
```

JUCE 8.0.13 загружается CMake через `FetchContent`.
