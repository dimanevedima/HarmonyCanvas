# Исследование семейств лупов и пробелов каталога

Дата: 2026-07-20. Область: 10 локальных SongMaster-проектов, 10 лупов без
совпадения с каталогом до изменений.

## Выводы для алгоритма

1. Луп — упорядоченный циклический паттерн. Ротация точки старта сохраняет
   схему, перестановка тех же корней — нет. Это соответствует разбору Axis-
   прогрессий как семейства ротаций одной последовательности, а не множества
   аккордов: https://mtosmt.org/issues/mto.17.23.3/mto.17.23.3.richards.html
2. Качество аккорда нельзя выбрасывать, но его локальная замена может быть
   вариантом того же корневого контура. В MIR для сравнения последовательностей
   применяют выравнивание/DTW и транспозиционную проверку, а не set overlap:
   https://archives.ismir.net/ismir2011/paper/000082.pdf
3. Более длинное окно может быть расширением короткого цикла. Сравнивать его
   нужно с периодическим повторением базового контура, ограничивая долю замен.
4. Фразовые схемы и каденции нельзя автоматически вращать как лупы. Каталог
   теперь различает `cyclic=true/false`.

Реализация: циклическое выравнивание всех фаз; максимум 25% замен корня,
отдельный мягкий штраф за смену качества, длина расширения не более 2.25 базовых
циклов. В UI причина объединения выводится рядом с вариантом.

## Аудит «недостающих» последовательностей

Не всякая частая последовательность заслуживает имени. В локальном корпусе
многие кандидаты являются авторскими модальными петлями, следствием спорной
тоники или фрагментом более длинной формы. Им не присваиваются выдуманные
жанровые названия.

Добавлены только три документированные схемы, отсутствовавшие в каталоге:

- `I–III–IV`, Puff progression — направленное начало фразы, не цикл:
  https://openmusictheory.github.io/popRockHarmony-puff.html
- `i–iv–bVII–bIII`, минорный круг квинт:
  https://openmusictheory.github.io/popRockHarmony-fifths.html
- `bVI–bIII–bVII–IV–I`, расширенная плагальная цепь:
  https://openmusictheory.github.io/popRockHarmony-plagal.html

Полезный следующий шаг для тональной неоднозначности — считать параллельные
интерпретации относительно основной и относительной тоники и показывать их как
альтернативы, а не молча менять итоговую тональность. Теоретическое основание:
одни и те же Axis-лупы действительно могут проецировать major/Aeolian в
зависимости от мелодии и контекста:
https://mtosmt.org/issues/mto.17.23.3/mto.17.23.3.richards.html

## Источники

- Open Music Theory, Harmony in pop/rock music:
  https://openmusictheory.github.io/popRockHarmony.html
- Richards, *Tonal Ambiguity in Popular Music's Axis Progressions*, MTO 23.3:
  https://mtosmt.org/issues/mto.17.23.3/mto.17.23.3.richards.html
- Duinker, *Plateau Loops and Hybrid Tonics in Recent Pop Music*, MTO 25.4:
  https://mtosmt.org/issues/mto.19.25.4/mto.19.25.4.duinker.html
- McVicar et al., chord-sequence similarity with DTW, ISMIR 2011:
  https://archives.ismir.net/ismir2011/paper/000082.pdf
- Mauch et al., transposition-invariant cyclic chord-pattern mining, ISMIR 2011:
  https://archives.ismir.net/ismir2011/paper/000048.pdf
