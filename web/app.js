const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Ошибка запроса");
  }
  return response.status === 204 ? null : response.json();
};

const apiUpload = async (path, body) => {
  const response = await fetch(`/api${path}`, { method: "POST", body });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Ошибка запроса");
  }
  return response.json();
};

const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (message) => {
  const el = document.querySelector("#toast");
  // Move toast into open modal dialog so it lives in the top-layer and stays visible
  const openDialog = document.querySelector("dialog[open]");
  const target = openDialog || document.body;
  if (el.parentElement !== target) target.appendChild(el);
  el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
};

const ICONS = {
  open: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  skip: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.8 5.8l12.4 12.4"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
  handle: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 8H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h4l5 4V4L9 8Z"/><path d="M16.5 9a4 4 0 0 1 0 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  undo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg>',
  redo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.8-10-9.3C.7 8.4 2 5 5.4 4.2 8 3.6 10.4 5 12 7c1.6-2 4-3.4 6.6-2.8C22 5 23.3 8.4 22 11.7 19.5 16.2 12 21 12 21Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a15.3 15.3 0 0 1-3.2 4.1M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6"/><path d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  stems: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M2 13l10 5 10-5"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  pianoRoll: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="3" y="4" width="8" height="3.2" rx="1.6"/><rect x="10" y="10.4" width="11" height="3.2" rx="1.6"/><rect x="5" y="16.8" width="7" height="3.2" rx="1.6"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>',
};

// ── MIDI attachments (e.g. MuScriptor transcriptions) ───────────────────────
// This is an independent source: results never modify or merge with the
// SongMaster/PTM panel. Each attached file can be inspected on demand.

function midiSectionHtml(ownerType, ownerId) {
  const containerId = `midi-${ownerType}-${ownerId}`;
  return `<details class="compare-curves-panel midi-panel" data-owner-type="${esc(ownerType)}" data-owner-id="${esc(ownerId)}">
    <summary>${ICONS.pianoRoll} MIDI-анализ</summary>
    <div class="stems-toolbar">
      <label class="ghost stems-attach-btn">
        + Прикрепить MIDI
        <input type="file" multiple accept=".mid,.midi,.zip" class="hidden-file-input" onchange="uploadMidiFiles('${esc(ownerType)}','${esc(ownerId)}', this)">
      </label>
      <span class="field-hint">Например, транскрипция из MuScriptor (кнопка выше) — там есть Download MIDI.</span>
    </div>
    <div id="${containerId}" class="midi-list"><p class="field-hint">Раскройте, чтобы загрузить…</p></div>
  </details>`;
}

function initMidiPanels(root) {
  (root || document).querySelectorAll(".midi-panel").forEach(panel => {
    if (panel.dataset.midiBound) return;
    panel.dataset.midiBound = "1";
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      loadMidiInto(panel.dataset.ownerType, panel.dataset.ownerId);
    });
  });
}

async function loadMidiInto(ownerType, ownerId) {
  const container = document.getElementById(`midi-${ownerType}-${ownerId}`);
  if (!container) return;
  container.innerHTML = `<p class="field-hint">Загрузка…</p>`;
  try {
    const path = ownerType === "demo" ? `/demos/${ownerId}/midi` : ownerType === "sketch" ? `/sketches/${ownerId}/midi` : `/references/${ownerId}/midi`;
    renderMidiList(container, ownerType, ownerId, await api(path));
  } catch (error) {
    container.innerHTML = `<p class="field-hint">Ошибка загрузки: ${esc(error.message)}</p>`;
  }
}

function renderMidiList(container, ownerType, ownerId, items) {
  if (!items.length) { container.innerHTML = `<p class="field-hint">MIDI ещё не прикреплены.</p>`; return; }
  container.innerHTML = items.map(midi => `<article class="midi-file-card" data-midi-id="${esc(midi.id)}">
    <div class="midi-row">
      <span class="midi-row-icon">${ICONS.pianoRoll}</span>
      <span class="midi-name" title="${esc(midi.filename)}">${esc(midi.filename)}</span>
      <button type="button" class="ghost compact midi-analyze-btn" onclick="analyzeMidi('${esc(midi.id)}', this, null, ${midi.has_analysis ? "true" : "false"})">${midi.has_analysis ? "Пересчитать" : "Анализировать"}</button>
      <a class="icon-mini" aria-label="Скачать MIDI" title="Скачать MIDI" href="/api/midi/${esc(midi.id)}/file" download>${ICONS.download}</a>
      <button type="button" class="icon-mini" aria-label="Открыть папку с MIDI" title="Открыть папку с файлом" onclick="revealMidiInFolder('${esc(midi.id)}', this)">${ICONS.folder}</button>
      <button type="button" class="icon-mini danger" aria-label="Удалить MIDI" title="Удалить MIDI" onclick="deleteMidiFile('${esc(ownerType)}','${esc(ownerId)}','${esc(midi.id)}',this)">${ICONS.trash}</button>
    </div>
    <div id="midi-analysis-${esc(midi.id)}" class="midi-analysis" aria-live="polite"></div>
  </article>`).join("");
  items.filter(midi => midi.has_analysis).forEach(midi => analyzeMidi(midi.id, null));
}

function midiRoleName(role) {
  return ({ drums: "Ударные", bass: "Бас", melody: "Мелодия", harmony: "Гармония", "harmony/arpeggio": "Гармония / арпеджио" })[role] || role;
}

function midiHypothesisHtml(item, primary = false) {
  if (!item) return "";
  const reasons = (item.reasons || []).map(reason => `<li>${esc(reason)}</li>`).join("");
  const theory = [
    item.characteristic_degrees?.length ? `характерные ступени ${item.characteristic_degrees.join(", ")}` : "",
    item.characteristic_chords?.length ? `аккорды ${item.characteristic_chords.join(" · ")}` : "",
  ].filter(Boolean).join(" · ");
  return `<article class="midi-hypothesis ${primary ? "is-primary" : ""}">
    <div class="midi-hypothesis-head"><strong>${esc(item.label)}</strong><span>${Math.round(item.score * 100)} / 100</span></div>
    ${theory ? `<small>${esc(theory)}</small>` : ""}
    ${reasons ? `<ul>${reasons}</ul>` : ""}
  </article>`;
}

function midiVoicingsAttr(voicings) {
  return esc((voicings || []).filter(item => item?.length).map(item => item.join(",")).join("|"));
}

function midiPlayButton(voicings, label) {
  if (!(voicings || []).some(item => item?.length)) return "";
  return `<button type="button" class="midi-play" data-voicings="${midiVoicingsAttr(voicings)}" onclick="midiPlayVoicings(this)" aria-label="${esc(label)}" title="${esc(label)}">${ICONS.play}</button>`;
}

function midiChordHtml(chord) {
  const alternatives = (chord.alternatives || []).map(item =>
    `<span><b>${esc(item.symbol)}</b> ${Math.round(item.score * 100)}</span>`
  ).join("");
  const bars = chord.start_bar === chord.end_bar ? `такт ${chord.start_bar}` : `такты ${chord.start_bar}–${chord.end_bar}`;
  return `<article class="midi-chord ${chord.symbol === "N.C." ? "is-empty" : ""}">
    <div class="midi-chord-head">${midiPlayButton([chord.midis], `Сыграть аккорд ${chord.symbol}`)}<strong>${esc(chord.symbol)}</strong><span>${Math.round(chord.score * 100)} / 100</span></div>
    <small>${bars} · доли ${esc(chord.start_beat)}–${esc(chord.end_beat)}</small>
    ${alternatives ? `<details><summary>Альтернативы</summary><div>${alternatives}</div></details>` : ""}
  </article>`;
}

function midiComposerDigestHtml(digest) {
  if (!digest) return `<p class="field-hint">Недостаточно материала для композиторской выжимки.</p>`;
  const characteristic = [
    digest.characteristic_degrees?.length ? `ступень ${digest.characteristic_degrees.join("/")}` : "",
    digest.characteristic_notes?.length ? `нота ${digest.characteristic_notes.join("/")}` : "",
  ].filter(Boolean).join(" · ");
  const motif = digest.main_motif;
  const motifHtml = motif ? `<article class="midi-main-motif">
    <div class="midi-main-motif-head"><span>Основной гармонический мотив</span><b>${motif.occurrences}×</b>${midiPlayButton(motif.midis, `Сыграть основной мотив ${motif.chords.join(" – ")}`)}</div>
    <strong>${esc(motif.formula.join(" – "))}</strong>
    <p>${esc(motif.chords.join(" – "))}</p>
    ${motif.insight ? `<small>${esc(motif.insight)}</small>` : ""}
    <div class="midi-motif-meta"><span>ярче всего т. ${motif.best_start_bar}–${motif.best_end_bar}</span><span>ступени по корням</span>${motif.quality_ambiguous ? `<span>5/sus не задают мажор или минор</span>` : ""}</div>
    ${motif.expanded_formula?.length > motif.formula.length ? `<details><summary>Развёрнутая форма · ${motif.expanded_formula.length} шагов</summary><div><b>${esc(motif.expanded_formula.join(" – "))}</b><small>${esc(motif.expanded_chords.join(" – "))}</small>${motif.source_expanded_chords?.length ? `<small>Точные варианты MIDI: ${esc(motif.source_expanded_chords.join(" – "))}</small>` : ""}</div></details>` : ""}
  </article>` : "";
  const tryNow = (digest.try_now || []).map(item => `<article class="midi-try-card">
    ${midiPlayButton(item.midis, `Сыграть прогрессию ${item.chords.join(" – ")}`)}
    <span>Сыграть как луп</span><strong>${esc(item.chords.join(" – "))}</strong><small>${esc(item.formula)}</small>
  </article>`).join("");
  const palette = (digest.chord_palette || []).map(item =>
    `<button type="button" class="midi-palette-chord" data-voicings="${midiVoicingsAttr([item.midis])}" onclick="midiPlayVoicings(this)" aria-label="Сыграть аккорд ${esc(item.symbol)}">${ICONS.play}<b>${esc(item.symbol)}</b>${item.degree ? ` <small>${esc(item.degree)}</small>` : ""}</button>`
  ).join("");
  const loops = (digest.recurring_loops || []).map(item => `<article class="midi-found-loop">
    ${midiPlayButton(item.midis, `Сыграть оборот ${item.chords.join(" – ")}`)}
    <div><strong>${esc(item.chords.join(" – "))}</strong><span>${item.occurrences}×</span></div>
    <small>${esc(item.degrees.join(" – "))} · впервые с такта ${item.first_bar}</small>
  </article>`).join("");
  const usage = (digest.mode_usage || []).map(item => `<span class="midi-mode-share">
    <b>${esc(item.label)}</b><i style="--share:${Math.round(item.share * 100)}%"></i><small>${Math.round(item.share * 100)}%</small>
  </span>`).join("");
  const regions = (digest.stable_regions || []).map(item =>
    `<span><b>${esc(item.label)}</b><small>примерно т. ${item.start_bar}–${item.end_bar}</small></span>`
  ).join("");
  return `<section class="midi-digest">
    <div class="midi-practice-lead">
      <span>Главная опора</span><strong>${esc(digest.primary_mode)}</strong>
      <p>Держите <b>${esc(digest.tonic)}</b> в басу и подчёркивайте ${esc(characteristic)}. Характерные аккорды: ${esc((digest.characteristic_chords || []).join(" · "))}.</p>
    </div>
    ${motifHtml}
    ${tryNow ? `<div class="midi-try-grid">${tryNow}</div>` : ""}
    ${palette ? `<div><h5>Рабочая палитра</h5><div class="midi-palette">${palette}</div></div>` : ""}
    ${loops ? `<div><h5>Повторяющиеся обороты из MIDI</h5><div class="midi-found-loops">${loops}</div></div>` : ""}
    ${usage ? `<div><h5>Какие центры преобладают</h5><div class="midi-mode-shares">${usage}</div><p class="midi-caption">Проценты — доля скользящих измерений, а не количество разделов.</p></div>` : ""}
    <div><h5>Подтверждённые длительные смены</h5>${regions ? `<div class="midi-stable-regions">${regions}</div>` : `<p class="midi-caption">Устойчивой смены центра не найдено — лучше мыслить трек в главном ладу, а остальные результаты считать локальной окраской.</p>`}</div>
  </section>`;
}

function renderMidiAnalysis(midiId, report) {
  const container = document.getElementById(`midi-analysis-${midiId}`);
  if (!container) return;
  container.dataset.bpm = report.tempo_bpm || 120;
  const tracks = (report.tracks || []).map(track => {
    const checked = report.included_part_ids.includes(track.id);
    const range = track.pitch_min == null ? "без нот" : `${track.pitch_min}–${track.pitch_max}`;
    return `<label class="midi-part ${track.role === "drums" ? "is-drums" : ""}">
      <input type="checkbox" value="${esc(track.id)}" data-midi-part ${checked ? "checked" : ""}
        onchange="reanalyzeMidiFromSelection('${esc(midiId)}', this)" ${track.role === "drums" ? "disabled" : ""}>
      <span class="midi-part-main"><strong>${esc(track.name)}</strong><small>${esc(track.instrument)} · ch ${track.channel} · ${track.note_count} нот · ${range}</small></span>
      <span class="midi-role"><b>${esc(midiRoleName(track.role))}</b><small>${Math.round(track.role_confidence * 100)}%</small></span>
    </label>`;
  }).join("");
  const global = report.global;
  const hypotheses = global
    ? `${midiHypothesisHtml(global.top, true)}<div class="midi-alternatives">${(global.alternatives || []).map(item => midiHypothesisHtml(item)).join("")}</div>`
    : `<p class="field-hint">Выберите хотя бы одну звуковысотную партию для анализа.</p>`;
  const windows = (report.windows || []).map(window => `<div class="midi-window">
    <span>т. ${window.start_bar}–${window.end_bar}</span><strong>${esc(window.top.label)}</strong><i style="--w:${Math.round(window.top.score * 100)}%"></i>
  </div>`).join("");
  const chordSegments = report.chords?.segments || [];
  const visibleChords = chordSegments.slice(0, 32).map(midiChordHtml).join("");
  const remainingChords = chordSegments.slice(32).map(midiChordHtml).join("");
  const chordShare = Math.round((report.chords?.recognized_duration_share || 0) * 100);
  const savedAt = report._persistence?.updated_at ? new Date(report._persistence.updated_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "";
  container.innerHTML = `<div class="midi-source-note"><strong>Источник: MIDI</strong><span>Отдельно от SongMaster и ПТМ — результаты не смешиваются</span>${savedAt ? `<small>${report._persistence.cached ? "Загружено из базы" : "Сохранено"} · ${esc(savedAt)}</small>` : ""}<button type="button" class="midi-stop" onclick="midiStopPlayback(this)" aria-label="Остановить проигрывание">${ICONS.stop} Стоп</button></div>
    <div class="midi-stats">
      <span><strong>${esc(report.tempo_bpm)}</strong>BPM</span>
      <span><strong>${report.time_signature.numerator}/${report.time_signature.denominator}</strong>Размер</span>
      <span><strong>${esc(report.duration_beats)}</strong>Долей</span>
      <span><strong>${esc(report.pitched_note_count)}</strong>Нот в анализе</span>
    </div>
    <h4 class="midi-heading">Партии и роли</h4>
    <p class="field-hint">Снимите флажок с партии и анализ пересчитается. Ударные исключены автоматически.</p>
    <div class="midi-parts">${tracks}</div>
    <h4 class="midi-heading">Попробовать в своей музыке</h4>
    ${midiComposerDigestHtml(report.composer_digest)}
    <details class="midi-technical">
      <summary>Технические данные · ${chordSegments.length} аккордовых сегментов · ${report.windows?.length || 0} окон</summary>
      <div class="midi-technical-body">
        <div class="midi-heading-row"><h4 class="midi-heading">Точная лента аккордов</h4><span>${chordShare}% длительности распознано</span></div>
        <p class="field-hint">Обращения записаны через слэш. Альтернативы нужны для проверки спорных мест.</p>
        ${visibleChords ? `<div class="midi-chords" aria-label="Точная лента аккордов MIDI">${visibleChords}</div>${remainingChords ? `<details class="midi-chord-more"><summary>Показать остальные сегменты · ${chordSegments.length - 32}</summary><div class="midi-chords">${remainingChords}</div></details>` : ""}` : `<p class="field-hint">Аккорды не распознаны.</p>`}
        <h4 class="midi-heading">Три модальные гипотезы</h4>
        <p class="field-hint">Баллы показывают силу свидетельств, а не статистическую вероятность.</p>
        <div class="midi-hypotheses">${hypotheses}</div>
        ${windows ? `<details class="midi-regions"><summary>Скользящие окна алгоритма · ${report.windows.length}</summary><p class="field-hint">Это диагностические замеры с перекрытием, не предполагаемые музыкальные разделы.</p><div class="midi-window-list">${windows}</div></details>` : ""}
      </div>
    </details>`;
}

async function analyzeMidi(midiId, button, includeIds = null, refresh = false) {
  const container = document.getElementById(`midi-analysis-${midiId}`);
  if (!container) return;
  let buttonLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = "Анализ…"; }
  container.innerHTML = `<div class="midi-loading">Разбираю дорожки, аккорды и 84 модальные гипотезы…</div>`;
  try {
    const params = new URLSearchParams();
    if (includeIds !== null) params.set("include", includeIds.join(","));
    if (refresh) params.set("refresh", "true");
    const query = params.size ? `?${params}` : "";
    renderMidiAnalysis(midiId, await api(`/midi/${midiId}/analysis${query}`));
    if (button) {
      buttonLabel = "Пересчитать";
      button.onclick = () => analyzeMidi(midiId, button, null, true);
    }
  } catch (error) {
    container.innerHTML = `<p class="field-hint">Не удалось проанализировать MIDI: ${esc(error.message)}</p>`;
  } finally {
    if (button) { button.disabled = false; button.textContent = buttonLabel; }
  }
}

function reanalyzeMidiFromSelection(midiId, input) {
  const container = input.closest(".midi-analysis");
  const ids = [...container.querySelectorAll("[data-midi-part]:checked")].map(item => item.value);
  analyzeMidi(midiId, null, ids);
}

function midiStopPlayback(button = null) {
  ptmAudio.stopAll();
  (button?.closest(".midi-analysis") || document).querySelectorAll(".midi-play.is-playing, .midi-palette-chord.is-playing").forEach(item => item.classList.remove("is-playing"));
}

function midiPlayVoicings(button) {
  const voicings = String(button.dataset.voicings || "").split("|").map(chord =>
    chord.split(",").map(Number).filter(Number.isFinite)
  ).filter(chord => chord.length);
  if (!voicings.length) return;
  const container = button.closest(".midi-analysis");
  midiStopPlayback(button);
  button.classList.add("is-playing");
  const bpm = Number(container?.dataset.bpm) || 120;
  const beatSec = Math.min(1.6, Math.max(0.45, 120 / bpm));
  ptmAudio.playChords(voicings, {
    beatSec,
    onStep: index => {
      if (index < 0) button.classList.remove("is-playing");
    },
  });
}

async function uploadMidiFiles(ownerType, ownerId, inputEl) {
  const files = inputEl.files;
  if (!files || !files.length) return;
  const formData = new FormData();
  for (const file of files) formData.append("file", file);
  const path = ownerType === "demo" ? `/demos/${ownerId}/midi` : ownerType === "sketch" ? `/sketches/${ownerId}/midi` : `/references/${ownerId}/midi`;
  try {
    await apiUpload(path, formData);
    toast("MIDI прикреплены");
    loadMidiInto(ownerType, ownerId);
  } catch (error) {
    toast(error.message);
  } finally {
    inputEl.value = "";
  }
}

async function revealMidiInFolder(midiId, button) {
  if (button) button.disabled = true;
  try {
    await api(`/midi/${midiId}/reveal`, { method: "POST" });
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteMidiFile(ownerType, ownerId, midiId, button) {
  if (!confirm("Удалить этот MIDI-файл?")) return;
  button.disabled = true;
  try {
    await api(`/midi/${midiId}`, { method: "DELETE" });
    button.closest(".midi-file-card")?.remove();
    const container = document.getElementById(`midi-${ownerType}-${ownerId}`);
    if (container && !container.querySelector(".midi-file-card")) {
      container.innerHTML = `<p class="field-hint">MIDI ещё не прикреплены.</p>`;
    }
  } catch (error) {
    button.disabled = false;
    toast(error.message);
  }
}


// ── Composition Lab ────────────────────────────────────────────────────────

let currentSketchId = null;
const labInstanceId = new URLSearchParams(location.search).get("instance");

function labModeOptions(value) {
  const modes = [["major", "Ионийский / мажор"], ["dorian", "Дорийский"], ["phrygian", "Фригийский"], ["lydian", "Лидийский"], ["mixolydian", "Миксолидийский"], ["minor", "Эолийский / минор"], ["locrian", "Локрийский"]];
  return modes.map(([id, label]) => `<option value="${id}" ${id === value ? "selected" : ""}>${label}</option>`).join("");
}

function labTonicPicker(value) {
  const notes = [
    ["C", "C"], ["G", "G"], ["D", "D"], ["A", "A"], ["E", "E"], ["B", "B"],
    ["Gb", "F#"], ["Db", "C#"], ["Ab", "G#"], ["Eb", "D#"], ["Bb", "A#"], ["F", "F"],
  ];
  const sharp = String(value).includes("#");
  window.labTonicSpelling = sharp ? "sharp" : "flat";
  return `<div class="lab-meta-field lab-tonic-field">
    <span class="lab-field-label">Тоника</span>
    <input id="lab-tonic" type="hidden" value="${esc(value)}">
    <button type="button" id="lab-tonic-trigger" class="lab-tonic-trigger" aria-haspopup="dialog" aria-expanded="false" onclick="toggleLabTonicPicker(event)">
      <strong id="lab-tonic-value">${esc(value)}</strong><span>выбрать</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div id="lab-tonic-popover" class="lab-tonic-popover" role="dialog" aria-label="Выбор тоники" hidden>
      <div class="lab-tonic-pop-head"><strong>Тональный центр</strong><div class="lab-spelling" aria-label="Обозначение альтераций"><button type="button" data-spelling="flat" class="${sharp ? "" : "active"}" onclick="setLabTonicSpelling('flat', this)">♭</button><button type="button" data-spelling="sharp" class="${sharp ? "active" : ""}" onclick="setLabTonicSpelling('sharp', this)">♯</button></div></div>
      <div class="lab-tonic-wheel">
        ${notes.map(([flatName, sharpName], index) => `<button type="button" class="lab-tonic-note ${value === flatName || value === sharpName ? "selected" : ""}" style="--angle:${index * 30 - 90}deg;--counter:${90 - index * 30}deg" onclick="selectLabTonic('${flatName}','${sharpName}',this)" aria-label="${flatName === sharpName ? flatName : `${flatName} или ${sharpName}`}" aria-pressed="${value === flatName || value === sharpName}"><span>${flatName === sharpName ? flatName : `${flatName}<small>${sharpName}</small>`}</span></button>`).join("")}
        <div class="lab-tonic-center"><strong>${esc(value)}</strong><small>тоника</small></div>
      </div>
      <p>Выберите звук на круге. ♭ / ♯ меняет только написание энгармонических тональностей.</p>
    </div>
  </div>`;
}

function toggleLabTonicPicker(event) {
  event.stopPropagation();
  const popover = document.getElementById("lab-tonic-popover");
  const trigger = document.getElementById("lab-tonic-trigger");
  if (!popover || !trigger) return;
  const willOpen = popover.hidden;
  popover.hidden = !willOpen;
  trigger.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) requestAnimationFrame(() => popover.querySelector(".lab-tonic-note.selected, .lab-tonic-note")?.focus());
}

function closeLabTonicPicker() {
  const popover = document.getElementById("lab-tonic-popover");
  const trigger = document.getElementById("lab-tonic-trigger");
  if (popover) popover.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function labBpmPicker(value) {
  const bpm = Math.max(30, Math.min(300, Number(value) || 120));
  return `<div class="lab-meta-field lab-bpm-field">
    <span class="lab-field-label">BPM</span>
    <input id="lab-bpm" type="hidden" value="${bpm}">
    <button type="button" id="lab-bpm-trigger" class="lab-tonic-trigger lab-bpm-trigger" aria-haspopup="dialog" aria-expanded="false" onclick="toggleLabBpmPicker(event)">
      <strong id="lab-bpm-value">${bpm}</strong><span>BPM</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div id="lab-bpm-popover" class="lab-bpm-popover" role="dialog" aria-label="Выбор темпа" hidden>
      <strong>Темп проекта</strong>
      <label class="lab-bpm-number"><span>Tempo:</span><input id="lab-bpm-number" type="number" min="30" max="300" inputmode="numeric" value="${bpm}" onchange="commitLabBpm(this.value)"><b>BPM</b></label>
      <div class="lab-bpm-slider-row">
        <button type="button" onclick="adjustLabBpm(-1)" aria-label="Уменьшить темп на один BPM">−</button>
        <input id="lab-bpm-range" type="range" min="30" max="300" step="1" value="${bpm}" aria-label="Темп в BPM" oninput="previewLabBpm(this.value)" onchange="commitLabBpm(this.value)">
        <button type="button" onclick="adjustLabBpm(1)" aria-label="Увеличить темп на один BPM">+</button>
      </div>
      <div class="lab-bpm-footer"><button type="button" class="ghost" onclick="tapLabBpm(this)">Tap Tempo</button><small id="lab-bpm-hint">Нажмите несколько раз в ритме</small></div>
    </div>
  </div>`;
}

function toggleLabBpmPicker(event) {
  event.stopPropagation();
  if (window.labDawTransport?.available) {
    toast("Темп синхронизирован с Ableton Live");
    return;
  }
  const popover = document.getElementById("lab-bpm-popover");
  const trigger = document.getElementById("lab-bpm-trigger");
  if (!popover || !trigger) return;
  closeLabTonicPicker();
  const willOpen = popover.hidden;
  popover.hidden = !willOpen;
  trigger.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) requestAnimationFrame(() => document.getElementById("lab-bpm-range")?.focus());
}

function closeLabBpmPicker() {
  const popover = document.getElementById("lab-bpm-popover");
  const trigger = document.getElementById("lab-bpm-trigger");
  if (popover) popover.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function previewLabBpm(rawValue) {
  const value = Math.max(30, Math.min(300, Math.round((Number(rawValue) || 120) * 100) / 100));
  const hidden = document.getElementById("lab-bpm");
  const number = document.getElementById("lab-bpm-number");
  const range = document.getElementById("lab-bpm-range");
  const display = document.getElementById("lab-bpm-value");
  if (hidden) hidden.value = value;
  if (number) number.value = value;
  if (range) range.value = value;
  if (display) display.textContent = value;
  return value;
}

function applyLabDawTransport(state = {}) {
  if (!state.available || !Number.isFinite(Number(state.bpm))) return;
  const receivedAt = performance.now();
  const bpm = Math.round(Number(state.bpm) * 100) / 100;
  window.labDawTransport = { ...state, bpm, receivedAt };
  previewLabBpm(bpm);
  const trigger = document.getElementById("lab-bpm-trigger");
  if (trigger) {
    trigger.classList.add("is-daw");
    trigger.setAttribute("aria-disabled", "true");
    trigger.setAttribute("aria-label", `Темп Ableton Live: ${bpm} BPM`);
    trigger.title = "Синхронизировано с Ableton Live";
  }
  const source = trigger?.querySelector("span");
  if (source) source.textContent = "DAW";
  document.body.dataset.dawPlaying = state.playing ? "true" : "false";
  syncLabDawPlayback(window.labDawTransport);
}

window.addEventListener("harmonycanvas:daw-transport", event => applyLabDawTransport(event.detail));

async function commitLabBpm(rawValue, announce = true) {
  const value = previewLabBpm(rawValue);
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify({ bpm: value }) });
    if (announce) toast(`${value} BPM сохранено`);
  } catch (error) { toast(error.message); }
}

function adjustLabBpm(delta) {
  const current = Number(document.getElementById("lab-bpm")?.value) || 120;
  commitLabBpm(current + delta, false);
}

function tapLabBpm(button) {
  const now = performance.now();
  window.labBpmTaps = (window.labBpmTaps || []).filter(time => now - time < 3000);
  window.labBpmTaps.push(now);
  if (window.labBpmTaps.length > 6) window.labBpmTaps.shift();
  const hint = document.getElementById("lab-bpm-hint");
  if (window.labBpmTaps.length < 2) {
    if (hint) hint.textContent = "Ещё раз…";
    button.classList.add("active");
    return;
  }
  const intervals = window.labBpmTaps.slice(1).map((time, index) => time - window.labBpmTaps[index]);
  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const bpm = Math.round(60000 / average);
  commitLabBpm(bpm, false);
  if (hint) hint.textContent = `${previewLabBpm(bpm)} BPM · ${window.labBpmTaps.length} нажатия`;
}

function setLabTonicSpelling(spelling, button) {
  window.labTonicSpelling = spelling;
  button.closest(".lab-spelling")?.querySelectorAll("button").forEach(item => item.classList.toggle("active", item.dataset.spelling === spelling));
}

async function selectLabTonic(flatName, sharpName, button) {
  const value = window.labTonicSpelling === "sharp" ? sharpName : flatName;
  document.getElementById("lab-tonic").value = value;
  document.getElementById("lab-tonic-value").textContent = value;
  const center = document.querySelector(".lab-tonic-center strong");
  if (center) center.textContent = value;
  button.closest(".lab-tonic-wheel")?.querySelectorAll(".lab-tonic-note").forEach(item => {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  closeLabTonicPicker();
  await patchLabContext({ tonic: value });
}

document.addEventListener("click", event => {
  if (!event.target.closest(".lab-tonic-field")) closeLabTonicPicker();
  if (!event.target.closest(".lab-bpm-field")) closeLabBpmPicker();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!document.getElementById("lab-tonic-popover")?.hidden) {
      closeLabTonicPicker();
      document.getElementById("lab-tonic-trigger")?.focus();
    } else if (!document.getElementById("lab-bpm-popover")?.hidden) {
      closeLabBpmPicker();
      document.getElementById("lab-bpm-trigger")?.focus();
    }
  }
});

function melodyTextToNotes(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).map((token, index) => {
    const [pitch, duration = "1"] = token.split(":");
    return { pitch, duration: Math.max(.125, Number(duration) || 1), start: index };
  });
}

function melodyNotesToText(notes = []) {
  return notes.map(note => `${note.pitch || "C4"}:${note.duration || 1}`).join(" ");
}

async function createLabSketch() {
  try {
    const sketch = await api("/sketches", { method: "POST", body: JSON.stringify({ title: "Новый эскиз", tonic: "C", mode: "major", bpm: 120, instance_id: labInstanceId || undefined }) });
    currentSketchId = sketch.id;
    await loadLab();
  } catch (error) { toast(error.message); }
}

async function loadLab() {
  const container = document.getElementById("lab-content");
  if (!container) return;
  loadLabOutputState();
  const firstPaint = !document.getElementById("lab-score");
  if (firstPaint) container.innerHTML = `<div class="empty">Загружаю эскизы…</div>`;
  try {
    let sketches;
    if (labInstanceId) {
      const bound = await api(`/instances/${encodeURIComponent(labInstanceId)}/sketch`);
      sketches = await api(`/sketches?instance=${encodeURIComponent(labInstanceId)}`);
      if (!currentSketchId || !sketches.some(item => item.id === currentSketchId)) currentSketchId = bound.id;
    } else {
      sketches = await api("/sketches");
    }
    // All sketches across instances feed the "share sketch" picker.
    try { window.labAllSketches = await api("/sketches?all=1"); } catch { window.labAllSketches = sketches; }
    if (!currentSketchId && sketches.length) currentSketchId = sketches[0].id;
    if (!currentSketchId) {
      container.innerHTML = `<section class="lab-empty panel"><p class="eyebrow">COMPOSITION LAB</p><h2>Начните с музыкального фрагмента</h2><p>Введите прогрессию, добавьте мелодию или прикрепите MIDI. Эскиз не обязан быть готовым демо.</p><button class="primary" onclick="createLabSketch()">Создать первый эскиз</button></section>`;
      return;
    }
    const current = window.labSelectedChordIndex;
    const selected = current === null || current === undefined ? -1 : Math.max(0, Number(current) || 0);
    const [sketch, advice] = await Promise.all([
      api(`/sketches/${currentSketchId}`),
      api(`/sketches/${currentSketchId}/advice?selected_index=${selected}${labPaletteQuery()}`),
    ]);
    window.labSelectedChordIndex = advice.selected_index < 0 ? null : advice.selected_index;
    window.labSketchVersion = sketch.updated_at;
    renderLab(container, sketches, sketch, advice);
  } catch (error) { if (firstPaint) container.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

// ── Multi-instance: shared sketch link and live sync ────────────────────────
// Several plug-in instances can edit one shared sketch (like Scaler's multi-
// instance sync). Each instance still outputs its own chosen parts, so one
// instance feeds the chord instrument and another feeds a melody voice.

function labOutputStorageKey() { return `hc-output-${labInstanceId || "default"}`; }

function loadLabOutputState() {
  if (window.labOutputLoaded) return;
  window.labOutputLoaded = true;
  try {
    const raw = localStorage.getItem(labOutputStorageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    window.labChordsMuted = !!saved.chordsMuted;
    window.labVoiceMuteState = Object.assign({ 1: false, 2: false, 3: false, 4: false }, saved.voiceMutes || {});
    window.labOutputToDaw = !!saved.outputToDaw;
    window.labPartVolState = Object.assign({ chords: 1, v1: 1, v2: 1, v3: 1, v4: 1 }, saved.partVol || {});
    if (saved.loop && typeof saved.loop.from === "number") window.labLoop = saved.loop;
    if (typeof saved.octave === "number") window.labOctave = saved.octave;
  } catch {}
}

function saveLabOutputState() {
  try {
    localStorage.setItem(labOutputStorageKey(), JSON.stringify({
      chordsMuted: !!window.labChordsMuted, voiceMutes: labVoiceMutes(), outputToDaw: !!window.labOutputToDaw,
      partVol: labPartVolume(), loop: window.labLoop || null, octave: window.labOctave || 0,
    }));
  } catch {}
}

/** Per-part output volume (chords + voices 1-4), scaling MIDI velocity. */
function labPartVolume() {
  if (!window.labPartVolState) window.labPartVolState = { chords: 1, v1: 1, v2: 1, v3: 1, v4: 1 };
  return window.labPartVolState;
}

function setLabPartVolume(part, value) {
  let v = Math.max(0, Math.min(1.5, Number(value) || 0));
  // Detent near the two values users actually reach for, so the slider always
  // lands exactly on 0% (silent) and 100% (unity) instead of a fuzzy 0.05.
  if (v < 0.04) v = 0;
  else if (Math.abs(v - 1) < 0.04) v = 1;
  labPartVolume()[part] = v;
  saveLabOutputState();
  syncNativePlaybackTimeline();
  // Reflect the snapped value back into the live control + its readout.
  const wrap = document.querySelector(`.lab-mix[data-part="${part}"]`);
  if (wrap) {
    const input = wrap.querySelector("input[type=range]");
    if (input && Number(input.value) !== v) input.value = v;
    const out = wrap.querySelector(".lab-mix-val");
    if (out) out.textContent = `${Math.round(v * 100)}%`;
  }
}

/** Reset a single fader to unity (100%). */
function resetLabPartVolume(part) { setLabPartVolume(part, 1); }

/** Toggle between in-app piano preview and playing through Ableton instruments.
 * In Ableton mode Play/Stop drive the host transport and the app is silent. */
function setLabOutputMode(toDaw) {
  window.labOutputToDaw = !!toDaw;
  if (window.labOutputToDaw) ptmAudio.stopAll();
  else if (window.labAppPlaying) labSetAppTransport(false);
  saveLabOutputState();
  labRenderVoicesBar();
}

/** Poll the shared sketch; reload when another instance changed it. */
function startLabSyncPoll() {
  if (window.labSyncTimer) return;
  window.labSyncTimer = setInterval(async () => {
    if (!currentSketchId || !document.getElementById("lab-score")) return;
    // Never interrupt an active drag, an open field or a fresh local edit.
    if (window.labPointerBusy) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
    if (Date.now() - (window.labLastLocalEdit || 0) < 1600) return;
    try {
      const sketch = await api(`/sketches/${currentSketchId}`);
      if (sketch?.updated_at && sketch.updated_at !== window.labSketchVersion) {
        window.labSketchVersion = sketch.updated_at;
        await loadLab();
      }
    } catch {}
  }, 1500);
}

/** One-shot copy of another instance's content into the current sketch. */
async function copyFromLabSketch(sourceId) {
  if (!sourceId) return;
  try {
    const src = await api(`/sketches/${sourceId}`);
    labPushHistory();
    await api(`/sketches/${currentSketchId}`, {
      method: "PATCH",
      body: JSON.stringify({
        chord_input: src.chord_input || "", chord_beats: src.chord_beats || [], chord_starts: src.chord_starts || [],
        melody: src.melody || [], tonic: src.tonic, mode: src.mode, meter: src.meter, bpm: src.bpm,
      }),
    });
    await loadLab();
    toast("Скопировано из другого инстанса");
  } catch (error) { toast(error.message); }
}

function renderLab(container, sketches, sketch, advice) {
  window.currentLabAdvice = advice;
  window.labSelectedChordIndex = labClampSelection(advice.chords.length);
  const actions = advice.actions.map(item => `<article class="lab-action lab-action-${item.type}"><p class="eyebrow">${item.type === "harmony" ? "ГАРМОНИЯ" : item.type === "polyphony" ? "ПОЛИФОНИЯ" : "РАЗВИТИЕ"}</p><h3>${esc(item.title)}</h3><p>${esc(item.action)}</p>${item.risk ? `<small><b>Проверьте:</b> ${esc(item.risk)}</small>` : ""}<details><summary>Посмотреть в справочнике</summary><span>${esc(item.reference.title)} · ${esc(item.reference.section)}</span></details></article>`).join("");
  const polyphony = advice.polyphony_options.map(item => `<article><strong>${esc(item.name)}</strong><p>${esc(item.action)}</p><small>Риск: ${esc(item.risk)}</small></article>`).join("");
  const catalogMatches = (advice.catalog_matches || []).map(item => `<span class="ptm-badge ptm-badge-${esc(item.source || "extended")}"><b>${esc(item.roman || "")}</b> · ${esc(item.name || "")}</span>`).join("");
  container.innerHTML = `<div class="lab-shell">
    <aside class="lab-sketch-list"><div class="section-head"><h2>Эскизы</h2><button class="icon-mini" onclick="createLabSketch()" aria-label="Новый эскиз">+</button></div>${sketches.map(item => `<button class="lab-sketch-link ${item.id === sketch.id ? "active" : ""}" onclick="currentSketchId='${item.id}';loadLab()"><strong>${esc(item.title)}</strong><small>${esc(item.tonic)} · ${esc(item.mode)} · ${item.bpm} BPM</small></button>`).join("")}</aside>
    <div class="lab-workspace">
      <header class="lab-toolbar">${labCompactToolbarHtml(sketch)}</header>
      <div id="lab-context-bar" class="lab-context-bar">${labContextBarHtml(advice)}</div>
      <div class="lab-stage">
        <div id="lab-score" class="lab-score-panel">${labScoreHtml(advice)}</div>
        <aside id="lab-chord-inspector" class="lab-chord-inspector">${labInspectorHtml(advice)}</aside>
      </div>
      <div id="lab-scale-strip" class="lab-scale-strip" hidden>${labScaleHtml(advice)}</div>
      <div id="lab-drawer-scrim" class="lab-drawer-scrim" hidden onclick="closeLabDrawers()"></div>
      <aside id="lab-voices-drawer" class="lab-drawer" hidden aria-hidden="true" aria-label="Голоса и микшер">
        <div class="lab-drawer-head"><strong>Голоса, выход и микшер</strong><button type="button" class="lab-drawer-close" onclick="closeLabDrawers()" aria-label="Закрыть">×</button></div>
        <div id="lab-voices-bar" class="lab-voices-bar">${labVoicesBarHtml(advice)}</div>
      </aside>
      <div id="lab-analysis" hidden>${labAnalysisHtml(advice)}</div>
      <details class="panel lab-text-inputs" hidden><summary>Ввод текстом и заметки</summary>
        <label class="lab-main-field">Аккорды <small>через пробел или тире</small><textarea id="lab-chords" rows="2" placeholder="Bbmaj13/D Am/E C Dm" onchange="persistLabChordText()">${esc(sketch.chord_input)}</textarea></label>
        <label class="lab-main-field">Мелодия <small>нота:длительность, например D4:1 F4:.5 A4:.5</small><textarea id="lab-melody" rows="2" oninput="queueLabFieldSave()">${esc(melodyNotesToText(sketch.melody))}</textarea></label>
        <label class="lab-main-field">Заметка<textarea id="lab-notes" rows="2" oninput="queueLabFieldSave()">${esc(sketch.notes)}</textarea></label>
      </details>
      <section class="lab-try-it-section"><div class="section-head"><div><p class="eyebrow">TRY IT NOW</p><h2>Три контрастных действия</h2></div></div><div class="lab-actions">${actions}</div></section>
      <details class="panel lab-more"><summary>База теории и дополнительные техники</summary>${catalogMatches ? `<div class="lab-knowledge"><p class="eyebrow">СОВПАДЕНИЯ С КАТАЛОГАМИ ПТМ И РЕСЕРЧА</p><div class="ptm-badges">${catalogMatches}</div></div>` : `<p class="field-hint">Точного совпадения прогрессии с каталогом пока нет — это не означает, что материал неверен.</p>`}<div class="lab-poly-grid">${polyphony}</div><p class="field-hint">Подключено источников: ${advice.knowledge?.providers?.length || 0} · в гармоническом пуле ${advice.knowledge?.ptm_catalog_size || 0} схем.</p></details>
      ${midiSectionHtml("sketch", sketch.id)}
      <div class="lab-source-policy"><strong>Источники не смешиваются молча</strong><span>Аккорды = авторский замысел · MIDI = сыгранные ноты · объединение только по вашему решению.</span></div>
    </div></div>`;
  if (labFocusMode()) {
    const manualInput = container.querySelector(".lab-text-inputs");
    while (manualInput?.nextElementSibling) manualInput.nextElementSibling.remove();
  }
  initMidiPanels(container);
  labSyncHistoryButtons();
  syncNativePlaybackTimeline(advice);
  if (window.harmonyCanvasDawTransport) applyLabDawTransport(window.harmonyCanvasDawTransport);
}

const LAB_DIAL_COLORS = { 1: "#5da648", 2: "#2f9ed6", 3: "#8f63d8", 4: "#d97286", 5: "#cf4437" };

function labAnalysisHtml(advice) {
  const analysis = advice.tonality_analysis || {};
  const inferred = analysis.inferred;
  const status = analysis.matches_declared ? "совпадает с выбранной" : "отличается от выбранной";
  const alternatives = (analysis.alternatives || []).map(item => `<span>${esc(item.label)} · ${Math.round(item.score * 100)}%</span>`).join("");
  const colors = (advice.dial_colors || []).map(item => `<span class="lab-color-pill" style="--dial:${LAB_DIAL_COLORS[item.category] || "#777"}"><i></i><b>${esc(item.name)}</b><small>${Math.round(item.share * 100)}%</small></span>`).join("");
  const transitions = (advice.transitions || []).map(item => {
    const pair = item.pair;
    return `<li><b>${esc(item.from)} → ${esc(item.to)}</b><span>${esc(item.clock)}</span>${pair ? `<em style="--dial:${LAB_DIAL_COLORS[pair.category] || "#777"}">${esc(pair.category_name)}</em><small>${esc(pair.mood)}</small>` : `<small>${esc(item.move?.name || item.approx?.[0] || "вне таблицы 46 пар")}</small>`}</li>`;
  }).join("");
  // Collapsed by default so the editor stays focused on writing; one click on
  // the summary reveals the full key/dial breakdown when it is wanted.
  if (!advice.chords?.length) return "";
  const inner = `<div class="lab-analysis-grid"><article><small>ВЫБРАНО</small><strong>${esc(analysis.declared || advice.key.label)}</strong><span>${esc(advice.key.characteristic)}</span></article><article><small>РАСПОЗНАНО ПО АККОРДАМ</small><strong>${inferred ? `${esc(inferred.label)} · ${Math.round(inferred.score * 100)}%` : "Недостаточно материала"}</strong><span>${inferred ? esc(inferred.evidence) : "Добавьте хотя бы два аккорда"}</span>${alternatives ? `<details><summary>Другие гипотезы</summary>${alternatives}</details>` : ""}</article><article><small>КРАСКИ ЦИФЕРБЛАТА</small><div class="lab-color-list">${colors || `<span class="field-hint">Пары пока не распознаны</span>`}</div></article></div>${transitions ? `<details class="lab-transition-details"><summary>Переходы по циферблату · ${advice.transitions.length}</summary><ul>${transitions}</ul></details>` : ""}`;
  return `<details class="panel lab-analysis-collapsible"><summary><span class="eyebrow">HARMONY ANALYSIS</span><span>Что слышно в материале</span><span class="lab-analysis-status ${analysis.matches_declared ? "match" : "mismatch"}">${esc(status)}</span></summary><div class="lab-analysis-panel">${inner}</div></details>`;
}

function labScaleHtml(advice) {
  return `<span>Ступени ${esc(advice.key.label)}</span>${advice.key.scale_notes.map(note => `<b>${esc(note)}</b>`).join("")}<small>${esc(advice.key.characteristic)}</small>`;
}

// ── Score: melody grid and chord lane on one time axis ──────────────────────
// Rows are real pitches; the degree label and the chord-tone dot are derived
// from the key, so a piano roll can later edit notes in the same coordinates.

const LAB_DURATIONS = [[1, "1/4"], [2, "1/2"], [4, "1"], [8, "2"]];

// The roll is one continuous horizontal lane (webaudio-pianoroll style) — the
// whole piece scrolls sideways rather than wrapping into stacked systems.
const LAB_BARS_PER_SYSTEM = 8; // kept for legacy playhead math fallback

// Horizontal zoom presets (px per quarter-note beat). Bigger beats + taller
// rows make the note cells read closer to square, which the user asked for.
const LAB_ZOOMS = [22, 30, 40, 52, 68];

function labBeatWidth() {
  const zoom = Number.isFinite(window.labZoom) ? window.labZoom : 40;
  return Math.max(14, Math.min(96, zoom));
}

/** Whole span of the piece in beats, rounded up to a full bar. */
function labScoreSpan(advice = window.currentLabAdvice) {
  const timeline = advice?.timeline || { beats_per_bar: 4, total_beats: 16, bars: 4 };
  const beatsPerBar = timeline.beats_per_bar || 4;
  const raw = timeline.total_beats || beatsPerBar * (timeline.bars || 4);
  return Math.max(beatsPerBar, Math.ceil(raw / beatsPerBar) * beatsPerBar);
}

// Colour by tonic-relative pitch class (0-11), so borrowed/out-of-scale notes
// and chords read by their real pitch instead of falling back to grey.
function labChromaStyle(chroma) { return chroma === null || chroma === undefined ? "" : `--deg:var(--chroma-${chroma});`; }
function labChromaColor(chroma) { return chroma === null || chroma === undefined ? "var(--deg-1)" : `var(--chroma-${chroma})`; }
function labChordToneLabel(chord, pitchClass) {
  return (chord.tone_labels || []).find(item => item.pitch_class === pitchClass)?.label || "";
}

function labScoreHtml(advice) {
  const timeline = advice.timeline || { beats_per_bar: 4, total_beats: 16, bars: 4, chromatic: false };
  window.labGridRows = (advice.melody_grid || []).map(row => row.midi);
  const span = labScoreSpan(advice);
  window.labTotalBeats = span;
  const selected = labSelectedChord(advice);
  return `${labScoreHeadHtml(advice, timeline, selected)}
    <div class="lab-systems">
      ${labSystemHtml(advice, timeline, 0, span, 0)}
    </div>`;
}

/** One system: eight bars of ruler, note grid and chord lane on one axis. */
function labSystemHtml(advice, timeline, offset, span, systemIndex) {
  const grid = advice.melody_grid || [];
  const selectedNotes = window.labSelectedNotes || [];
  const activeVoice = window.labActiveVoice || 1;
  const inSystem = at => at >= offset && at < offset + span;
  const beatsPerBar = timeline.beats_per_bar || 4;
  const barCount = Math.max(1, Math.round(span / beatsPerBar));
  const firstBar = Math.round(offset / beatsPerBar);
  const bars = Array.from({ length: barCount }, (_, bar) =>
    `<span class="lab-bar" style="--at:${bar * beatsPerBar};--span:${beatsPerBar}">${firstBar + bar + 1}</span>`).join("");

  const rows = grid.map(row => {
    const deg = labChromaStyle(row.chroma);
    const toneBands = (advice.chords || []).map(chord => {
      const from = Math.max(Number(chord.start) || 0, offset);
      const to = Math.min((Number(chord.start) || 0) + (Number(chord.beats) || 0), offset + span);
      const pitchClasses = new Set((chord.midi || []).map(midi => Number(midi) % 12));
      if (to <= from || !pitchClasses.has(row.pitch_class)) return "";
      const label = labChordToneLabel(chord, row.pitch_class);
      const showLabel = (Number(chord.start) || 0) >= offset;
      return `<i class="lab-chord-tone-band ${chord.diatonic === false ? "is-outside" : ""}" style="--start:${from - offset};--len:${to - from};--chord-deg:${labChromaColor(chord.chroma)}" aria-hidden="true">${showLabel && label ? `<b>${esc(label)}</b>` : ""}</i>`;
    }).join("");
    const notes = (advice.melody || []).map((note, index) => [note, index])
      .filter(([note]) => note.pitch === row.midi && inSystem(note.start))
      .map(([note, index]) => {
        const noteDeg = labChromaStyle(note.chroma);
        const voice = note.voice || 1;
        const inactive = voice !== activeVoice;
        // Inactive voices stay visible but grey and get no pointer handler, so
        // only the active voice can be selected, moved or resized.
        return `<i class="lab-note lab-voice-${voice} ${inactive ? "is-inactive" : ""} ${note.chord_tone ? "is-chord-tone" : ""} ${note.in_scale ? "" : "is-outside"} ${selectedNotes.includes(index) ? "selected" : ""}" data-note="${index}" data-voice="${voice}" style="--start:${note.start - offset};--len:${note.duration};${noteDeg}" ${inactive ? "" : `onpointerdown="labNotePointerDown(event,${index})"`} title="${esc(note.name)} · ступень ${esc(note.degree)} · голос ${voice}${note.chord_symbol ? ` · под ${esc(note.chord_symbol)}` : ""}"><b class="lab-note-voice">${voice}</b><b class="lab-note-grip"></b></i>`;
      }).join("");
    // A chromatic row shows no degree: labels like "#6/b7" wrap and wreck the
    // column, and the note name already says what the row is.
    return `<div class="lab-row ${row.in_scale ? "" : "is-chromatic"} ${row.chord_tone ? "is-chord-tone" : ""}" style="${deg}" title="${esc(row.name)} · ступень ${esc(row.degree)}">
      <span class="lab-row-label"><b>${row.in_scale ? esc(row.degree) : ""}</b><small>${esc(row.name)}</small>${row.chord_tone ? `<em class="lab-row-dot" title="тон выбранного аккорда"></em>` : ""}</span>
      <span class="lab-row-track" data-midi="${row.midi}" onpointerdown="labRowPointerDown(event,${row.midi})">${toneBands}${notes}</span></div>`;
  }).join("");

  // The chord block is the control: drag to move, drag the edge to resize,
  // click to hear it. No buttons to squeeze into a one-beat card.
  const lane = (advice.chords || []).map((chord, index) => [chord, index])
    .filter(([chord]) => inSystem(chord.start))
    .map(([chord, index]) => `<article class="lab-lane-chord ${index === window.labSelectedChordIndex || (window.labSelectedChords || []).includes(index) ? "selected" : ""} ${chord.diatonic === false ? "is-outside" : ""}" style="--start:${chord.start - offset};--len:${chord.beats};--deg:${labChromaColor(chord.chroma)}" data-chord="${index}" onpointerdown="labChordPointerDown(event,${index})" title="${esc(chord.symbol)} · ${esc(chord.degree)} · ${chord.beats} доли — тяните, чтобы двигать; за края — растянуть">
      <b class="lab-chord-grip lab-chord-grip-left"></b>
      <span class="lab-lane-name"><b>${esc(chord.degree)}</b><strong>${esc(chord.symbol)}</strong></span>
      <b class="lab-chord-grip lab-chord-grip-right"></b></article>`).join("");

  const loop = window.labLoop;
  const from = loop ? Math.max(loop.from, offset) : 0;
  const to = loop ? Math.min(loop.to, offset + span) : 0;
  const loopOff = loop?.enabled === false;
  const loopBand = loop && to > from
    ? `<i class="lab-loop ${loopOff ? "is-off" : ""}" style="--from:${from - offset};--len:${to - from}" onpointerdown="labLoopBandPointerDown(event)" title="Луп ${loop.from}–${loop.to} доли · клик — ${loopOff ? "включить" : "выключить"}">
        <b class="lab-loop-grip lab-loop-grip-left"></b>
        <b class="lab-loop-clear" onpointerdown="event.stopPropagation();clearLabLoop()" title="Убрать луп">×</b>
        <b class="lab-loop-grip lab-loop-grip-right"></b>
      </i>`
    : "";
  const caret = window.labChordCaret;
  const caretMark = caret != null && caret >= offset && caret < offset + span
    ? `<i class="lab-chord-caret" style="--at:${caret - offset}" title="Сюда вставится Ctrl+V (клик по пустому месту переносит метку)"><b onpointerdown="event.stopPropagation();clearLabChordCaret()" title="Убрать метку">×</b></i>`
    : "";

  return `<div class="lab-score lab-system" data-offset="${offset}" style="--beats:${span};--bar:${beatsPerBar};--beat:${labBeatWidth()}px;--snap:${window.labSnapBeats || 0.5}">
      <div class="lab-score-inner">
        <i class="lab-playhead" data-playhead="${systemIndex}" style="--pos:0" hidden></i>
        <i class="lab-marquee" data-marquee="${systemIndex}" hidden></i>
        <div class="lab-ruler"><span class="lab-row-label">луп</span><span class="lab-row-track" onpointerdown="labLoopPointerDown(event)" title="Протяните по линейке, чтобы задать луп">${bars}${loopBand}</span></div>
        <div class="lab-rows">${rows || `<p class="field-hint">Сетка появится после выбора лада</p>`}</div>
        <div class="lab-lane-row"><span class="lab-row-label">Гармония</span><span class="lab-row-track" onpointerdown="labLaneBackgroundDown(event)" ondblclick="labLaneDblClick(event)" title="Двойной клик — палитра аккордов">${lane}${caretMark}</span></div>
      </div>
    </div>`;
}

function labScoreHeadHtml(advice, timeline, selected) {
  const hidden = (advice.melody || []).filter(note => !note.in_scale).length;
  return `<div class="lab-score-head">
      ${hidden && !timeline.chromatic
        // A note outside the scale has no row while the grid is diatonic, so it
        // would silently vanish from view even though it still plays.
        ? `<button type="button" class="lab-hidden-warning" onclick="setLabChromatic(true)">Скрыто вне лада: ${hidden} — показать хроматику</button>`
        : ""}
      <small>${timeline.bars} т. · ${timeline.beats_per_bar}/4</small>
    </div>`;
}

// ── Contextual top bar: chord palette OR note menu, by what you're editing ───
// Clicking the harmony lane shows the chord palette (drag-drop, Hookpad-style);
// clicking the piano roll shows the note menu (default length, range, grid…).

function labContextBarHtml(advice) {
  const mode = window.labContextMode === "note" ? "note" : "chord";
  return `<div class="lab-ctxbar">
    <div class="lab-ctxbar-tabs" role="tablist" aria-label="Что редактируем">
      <button type="button" role="tab" aria-selected="${mode === "chord"}" class="${mode === "chord" ? "active" : ""}" onclick="setLabContextMode('chord')">Аккорды</button>
      <button type="button" role="tab" aria-selected="${mode === "note"}" class="${mode === "note" ? "active" : ""}" onclick="setLabContextMode('note')">Ноты</button>
    </div>
    <div class="lab-ctxbar-body">${mode === "note" ? labNoteMenuHtml(advice) : labChordPaletteHtml(advice)}</div>
  </div>`;
}

/** The "note menu": default duration, the melody range, snap grid, chromatic,
 *  horizontal zoom — everything that shapes how notes are written. */
function labNoteMenuHtml(advice) {
  const timeline = advice.timeline || {};
  const dur = window.labNoteLength || 1;
  const oct = window.labOctave || 0;
  const snap = window.labSnapBeats || 0.5;
  return `<div class="lab-notemenu">
    <label class="lab-rollctl-field" title="Длительность новой ноты по умолчанию — с ней ставятся ноты кликом по сетке">
      <span>Длина ноты</span>
      <select onchange="setLabNoteLength(this.value)">${LAB_NOTE_LENGTHS.map(([value, label]) => `<option value="${value}" ${dur === value ? "selected" : ""}>${label}</option>`).join("")}</select>
    </label>
    <label class="lab-rollctl-field" title="Диапазон нот мелодии: какие октавы видны на сетке — смещайте, чтобы писать верх или низ без прокрутки">
      <span>Диапазон</span>
      <select onchange="setLabOctave(this.value)">${LAB_REGISTERS.map(([value, label]) => `<option value="${value}" ${oct === value ? "selected" : ""}>${label}</option>`).join("")}</select>
    </label>
    <label class="lab-rollctl-field" title="Шаг сетки для привязки нот и аккордов">
      <span>Сетка</span>
      <select onchange="setLabSnap(this.value)">${LAB_SNAPS.map(([value, label]) => `<option value="${value}" ${snap === value ? "selected" : ""}>${label}</option>`).join("")}</select>
    </label>
    <label class="lab-rollctl-check" title="Показать все хроматические ступени в сетке"><input type="checkbox" ${timeline.chromatic ? "checked" : ""} onchange="setLabChromatic(this.checked)"><span>Хроматика</span></label>
    <span class="lab-rollctl-zoom" title="Масштаб дорожки по горизонтали">
      <span>Масштаб</span>
      <button type="button" onclick="labZoomStep(-1)" aria-label="Уменьшить масштаб">−</button>
      <button type="button" onclick="labZoomStep(1)" aria-label="Увеличить масштаб">＋</button>
    </span>
  </div>`;
}

function labRenderContextBar() {
  if (document.getElementById("lab-context-bar")) labSetRegion("lab-context-bar", labContextBarHtml(window.currentLabAdvice));
}

function setLabContextMode(mode) {
  const next = mode === "note" ? "note" : "chord";
  if (window.labContextMode === next) return;
  window.labContextMode = next;
  labRenderContextBar();
}

function labZoomStep(dir) {
  const cur = labBeatWidth();
  let idx = LAB_ZOOMS.findIndex(z => Math.abs(z - cur) < 3);
  if (idx < 0) idx = LAB_ZOOMS.findIndex(z => z >= cur);
  if (idx < 0) idx = LAB_ZOOMS.length - 1;
  window.labZoom = LAB_ZOOMS[Math.max(0, Math.min(LAB_ZOOMS.length - 1, idx + (dir > 0 ? 1 : -1)))];
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
}

/** Double-click a chord block selects it for replacement from the palette. */
function labLaneDblClick(event) {
  const block = event.target.closest?.(".lab-lane-chord");
  if (block) { openLabPairDial(Number(block.dataset.chord)); return; }
  deselectLabChord(event);
  setLabContextMode("chord");
}

// ── Pair dial: modal circle for exploring the mood of A → B (docs Phase 2) ───

const PAIR_FIFTHS = ["C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb", "F"];
const PAIR_PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const PAIR_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const PAIR_QUALS = [
  ["", "maj"], ["m", "min"], ["dim", "dim"], ["aug", "aug"], ["6", "6"], ["m6", "m6"],
  ["7", "7"], ["m7", "m7"], ["maj7", "△7"], ["9", "9"], ["m9", "m9"], ["11", "11"],
  ["m11", "m11"], ["13", "13"], ["m13", "m13"], ["sus2", "sus2"], ["sus4", "sus4"], ["add9", "add9"],
  ["7(b9)", "7♭9"], ["7(#9)", "7♯9"], ["7(b5)", "7♭5"], ["7(#5)", "7♯5"], ["7(b13)", "7♭13"],
  ["m7(b5)", "ø"], ["dim7", "°7"], ["maj7(#11)", "△♯11"],
];

const PAIR_MODES = [
  ["", "— лад —"], ["major", "Ionian"], ["dorian", "Dorian"], ["phrygian", "Phrygian"],
  ["lydian", "Lydian"], ["mixolydian", "Mixolydian"], ["minor", "Aeolian"], ["locrian", "Locrian"],
  ["harmonic_minor", "Harm. minor"], ["phrygian_dominant", "Phr. dominant"],
];
const PAIR_LEVELS = [["7", "7"], ["9", "9"], ["11", "11"], ["13", "13"]];

function pairSplit(symbol) {
  const m = /^([A-G][#b]?)(.*)$/.exec(String(symbol || "").trim());
  return m ? { root: m[1], qual: m[2] } : { root: "C", qual: "" };
}

function pairRelMinor(major) {
  return PAIR_FLAT[(PAIR_PC[major] + 9) % 12] + "m";
}

function openLabPairDial(index) {
  const advice = window.currentLabAdvice;
  const chord = (advice?.chords || [])[index];
  if (!chord) return;
  const next = (advice.chords || [])[index + 1];
  const bSym = next ? next.symbol : PAIR_FLAT[(chord.chroma != null ? (PAIR_PC[pairSplit(chord.symbol).root] + 7) % 12 : 7)]; // default B = a fifth up
  // Keep the originals so "Сбросить" can restore what was double-clicked.
  window.labPair = { index, active: "b", a: chord.symbol, b: bSym, a0: chord.symbol, b0: bSym, aMode: "", bMode: "", aSrc: "own", bSrc: "own", aLevel: "13", bLevel: "13", aVariants: [], bVariants: [], mood: null, aMidi: [], bMidi: [] };
  let host = document.getElementById("lab-pair-dial");
  if (!host) { host = document.createElement("div"); host.id = "lab-pair-dial"; document.body.appendChild(host); }
  host.hidden = false;
  labRenderPairDial();
  refreshLabPair();
}

function closeLabPairDial() {
  ptmAudio.stopAll();
  const host = document.getElementById("lab-pair-dial");
  if (host) host.hidden = true;
  window.labPair = null;
}

function resetLabPair() {
  const p = window.labPair; if (!p) return;
  p.a = p.a0; p.b = p.b0; p.active = "b";
  labRenderPairDial(); refreshLabPair();
}

function setLabPairActive(side) { if (window.labPair) { window.labPair.active = side; labRenderPairDial(); } }
function setLabPairRoot(root, minor) {
  const p = window.labPair; if (!p) return;
  p[p.active] = minor ? root + "m" : root;
  applyLabPair(p.active, true);
}
function setLabPairQual(qual) {
  const p = window.labPair; if (!p) return;
  p[p.active] = pairSplit(p[p.active]).root + qual;
  p[p.active + "Mode"] = ""; p[p.active + "Src"] = "own"; // a manual quality overrides any fit
  applyLabPair(p.active, true);
}
function setLabPairMode(mode) {
  const p = window.labPair; if (!p) return;
  p[p.active + "Mode"] = mode;
  applyLabPair(p.active, true);
}
function setLabPairLevel(level) {
  const p = window.labPair; if (!p) return;
  p[p.active + "Level"] = level;
  applyLabPair(p.active, true);
}
function setLabPairSource(src) {
  const p = window.labPair; if (!p) return;
  p[p.active + "Src"] = src;
  applyLabPair(p.active, true);
}

/** Recompute one chord from its mode-fit settings: from its own root (chord-
 *  scale) or as a degree inside the partner chord's key. */
async function applyLabPairSide(side) {
  const p = window.labPair; if (!p) return;
  const src = p[side + "Src"] || "own";
  const level = p[side + "Level"] || "13";
  let res = null;
  if (src === "partner") {
    const other = side === "a" ? "b" : "a";
    res = await api("/degree-chord", { method: "POST", body: JSON.stringify({ tonic: pairSplit(p[other]).root, mode: p[other + "Mode"] || "major", root: pairSplit(p[side]).root, type: level }) });
  } else if (p[side + "Mode"]) {
    res = await api("/mode-chord", { method: "POST", body: JSON.stringify({ root: pairSplit(p[side]).root, mode: p[side + "Mode"], type: level }) });
  }
  if (!window.labPair) return;
  if (res) { p[side] = res.symbol; p[side + "Variants"] = res.variants || []; }
  else p[side + "Variants"] = [];
}

/** Apply the changed side, then reactively refit the partner if it reads inside
 *  this side's key, and refresh the mood. */
async function applyLabPair(changed, audition = false) {
  try {
    await applyLabPairSide(changed);
    const other = changed === "a" ? "b" : "a";
    if ((window.labPair || {})[other + "Src"] === "partner") await applyLabPairSide(other);
    if (window.labPair) { labRenderPairDial(); refreshLabPair(audition); }
  } catch (error) { toast(error.message); }
}

async function refreshLabPair(audition = false) {
  const p = window.labPair; if (!p) return;
  try {
    const res = await api("/pair-mood", { method: "POST", body: JSON.stringify({ a: p.a, b: p.b }) });
    if (!window.labPair) return;
    p.mood = res.mood; p.aMidi = res.a?.midi || []; p.bMidi = res.b?.midi || [];
    labRenderPairMood();
    // Auditioning a single pick plays just that chord; the pair only plays on
    // the explicit "Сыграть пару" button.
    if (audition) { const midi = p[p.active + "Midi"]; if (midi && midi.length) labPlay([midi]); }
  } catch (error) { toast(error.message); }
}

function playLabPair() {
  const p = window.labPair; if (!p) return;
  labPlay([p.aMidi, p.bMidi]);
}

async function insertLabPairAfter() {
  const p = window.labPair; if (!p || !currentSketchId) return;
  const advice = window.currentLabAdvice;
  const a = (advice.chords || [])[p.index];
  const beat = a ? a.start + a.beats : 0;
  await labInsertChordAt(p.b, beat);
  closeLabPairDial();
}

function labPairWheelHtml() {
  const p = window.labPair;
  const aRoot = pairSplit(p.a); const bRoot = pairSplit(p.b);
  const aPc = PAIR_PC[aRoot.root]; const bPc = PAIR_PC[bRoot.root];
  const isMin = q => q.startsWith("m") && !q.startsWith("maj");
  const aMaj = q => !isMin(q); // dim/aug/sus sit on the major seat
  // Fifths seat of a chord (minor borrows its relative major's seat), then the
  // wheel is rotated so chord A always sits at 12 o'clock — the hour hand.
  const seat = (root, qual) => PAIR_FIFTHS.findIndex(m => PAIR_PC[m] === (isMin(qual) ? (PAIR_PC[root] + 3) % 12 : PAIR_PC[root]));
  const aIdx = seat(aRoot.root, aRoot.qual);
  const bIdx = seat(bRoot.root, bRoot.qual);
  const cells = PAIR_FIFTHS.map((maj, i) => {
    const rel = pairRelMinor(maj);
    const majPc = PAIR_PC[maj]; const minPc = PAIR_PC[rel.slice(0, -1)];
    const majA = aPc === majPc && aMaj(aRoot.qual), minA = aPc === minPc && isMin(aRoot.qual);
    const majB = bPc === majPc && aMaj(bRoot.qual), minB = bPc === minPc && isMin(bRoot.qual);
    const angle = ((i - aIdx) * 30 + 360) % 360;
    return `<div class="lab-pair-cell" style="--angle:${angle}deg;--counter:${-angle}deg">
      <button type="button" class="lab-pair-maj ${majA ? "is-a" : ""} ${majB ? "is-b" : ""}" onclick="setLabPairRoot('${maj}',false)">${maj}</button>
      <button type="button" class="lab-pair-min ${minA ? "is-a" : ""} ${minB ? "is-b" : ""}" onclick="setLabPairRoot('${rel.slice(0, -1)}',true)">${rel}</button>
    </div>`;
  }).join("");
  const handAngle = ((bIdx - aIdx) * 30 + 360) % 360;
  const hands = aIdx >= 0 && bIdx >= 0
    ? `<i class="lab-pair-hour"></i><i class="lab-pair-minute" style="--hand:${handAngle}deg"></i>`
    : "";
  return `<div class="lab-pair-wheel">${hands}${cells}<div class="lab-pair-center"><b id="lab-pair-clock">—</b><small>A → B</small></div></div>`;
}

function labChordChipRow(side) {
  const p = window.labPair;
  const cur = pairSplit(p[side]).qual;
  return `<div class="lab-pair-quals">${PAIR_QUALS.map(([q, label]) =>
    `<button type="button" class="${cur === q ? "active" : ""}" onclick="setLabPairActive('${side}');setLabPairQual('${q}')">${label}</button>`).join("")}</div>`;
}

/** Mode fit: set the active chord to a mode's characteristic sound from its own
 *  root (chord-scale relationship — Dorian → m13, Lydian → maj13(#11)). */
function labPairModeRow(side) {
  const p = window.labPair;
  const mode = p[side + "Mode"] || ""; const level = p[side + "Level"] || "13";
  return `<label class="lab-pair-modefit" title="Аккорд подстраивается под лад от собственной тоники">
      <span>Лад аккорда</span>
      <select onchange="setLabPairActive('${side}');setLabPairMode(this.value)">${PAIR_MODES.map(([v, l]) => `<option value="${v}" ${mode === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    </label>
    <label class="lab-pair-modefit" title="Читать лад от собственной тоники аккорда (chord-scale) или как ступень в тональности партнёра">
      <span>Лад от</span>
      <select onchange="setLabPairActive('${side}');setLabPairSource(this.value)">${[["own", "своей тоники"], ["partner", "тональности партнёра"]].map(([v, l]) => `<option value="${v}" ${(p[side + "Src"] || "own") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    </label>`;
}

/** Ready-made chords the mode offers at 7/9/11/13 — click one instead of a
 *  numeric level. Shown only once a mode fit is active. */
function labPairVariantsRow(side) {
  const p = window.labPair;
  const variants = p[side + "Variants"] || [];
  if (!variants.length) return "";
  const level = p[side + "Level"] || "13";
  return `<div class="lab-pair-variants"><span class="lab-pair-variants-label">Аккорды лада</span>${variants.map(v =>
    `<button type="button" class="${level === v.level ? "active" : ""}" onclick="setLabPairActive('${side}');setLabPairLevel('${v.level}')">${esc(v.symbol)}</button>`).join("")}</div>`;
}

function labRenderPairDial() {
  const host = document.getElementById("lab-pair-dial"); const p = window.labPair;
  if (!host || !p) return;
  host.innerHTML = `<div class="lab-pair-scrim" onclick="closeLabPairDial()"></div>
    <div class="lab-pair-modal" role="dialog" aria-label="Пара аккордов">
      <div class="lab-pair-headbar"><strong>Пара аккордов — настроение перехода</strong><button type="button" class="lab-drawer-close" onclick="closeLabPairDial()" aria-label="Закрыть">×</button></div>
      <div class="lab-pair-grid">
        ${labPairWheelHtml()}
        <div class="lab-pair-side">
          <div class="lab-pair-tabs">
            <button type="button" class="${p.active === "a" ? "active" : ""}" onclick="setLabPairActive('a')">Аккорд A: <b>${esc(p.a)}</b></button>
            <button type="button" class="${p.active === "b" ? "active" : ""}" onclick="setLabPairActive('b')">Аккорд B: <b>${esc(p.b)}</b></button>
          </div>
          ${labChordChipRow(p.active)}
          <div class="lab-pair-moderow">${labPairModeRow(p.active)}</div>
          ${labPairVariantsRow(p.active)}
          <div id="lab-pair-mood" class="lab-pair-mood"></div>
          <div class="lab-pair-actions">
            <button type="button" class="lab-tool-btn" onclick="playLabPair()">▶ Сыграть пару</button>
            <button type="button" class="lab-tool-btn lab-pair-insert" onclick="insertLabPairAfter()">Вставить B после A</button>
            <button type="button" class="lab-tool-btn" onclick="resetLabPair()" title="Вернуть исходные аккорды (A: ${esc(p.a0)}, B: ${esc(p.b0)})">↺ Сбросить</button>
          </div>
        </div>
      </div>
    </div>`;
  labRenderPairMood();
}

function labRenderPairMood() {
  const box = document.getElementById("lab-pair-mood"); const p = window.labPair;
  if (!box || !p) return;
  const clock = document.getElementById("lab-pair-clock");
  const m = p.mood;
  if (!m) { box.innerHTML = `<span class="field-hint">Выберите аккорды на круге</span>`; return; }
  if (clock) clock.textContent = m.clock;
  const prov = { authored: "из таблицы 46", derived: "производное", heuristic: "эвристика" }[m.provenance] || m.provenance;
  box.innerHTML = `<div class="lab-pair-cat lab-pair-cat-${m.category}"><span class="lab-pair-time">${esc(m.clock)}</span><strong>${esc(m.category_name)}</strong><em>${esc(prov)}</em></div>
    <p class="lab-pair-desc">${esc(m.mood)}</p>`;
}

async function setLabChromatic(on) {
  window.labChromatic = !!on;
  await refreshLabAdvice();
}

// ── Note editing on the grid ────────────────────────────────────────────────

const LAB_NOTE_LENGTHS = [[0.25, "1/16"], [0.5, "1/8"], [1, "1/4"], [2, "1/2"], [4, "целая"]];
const LAB_SNAPS = [[0.25, "1/16"], [0.5, "1/8"], [1, "1/4"]];

function labBeatPx() {
  const score = document.querySelector(".lab-system");
  return score ? parseFloat(getComputedStyle(score).getPropertyValue("--beat")) || 26 : 26;
}

function labSnap(beats) {
  const step = window.labSnapBeats || 0.5;
  return Math.max(0, Math.round(beats / step) * step);
}

async function labNoteEdit(op, payload = {}) {
  const requestId = (window.labAdviceRequestId || 0) + 1;
  window.labAdviceRequestId = requestId;
  labPushHistory();
  try {
    const advice = await api(`/sketches/${currentSketchId}/note-edit`, {
      method: "POST",
      body: JSON.stringify({
        op, ...payload,
        selected_index: Math.max(0, Number(window.labSelectedChordIndex) || 0),
        palette_mode: window.labPaletteMode, palette_secondary: window.labSecondary, chromatic: !!window.labChromatic, octave: window.labOctave || 0,
      }),
    });
    if (requestId !== window.labAdviceRequestId) return;
    window.labSelectedNote = advice.selected_note >= 0 ? advice.selected_note : null;
    if (window.labSelectedNote !== null) window.labInspector = "note";
    applyLabAdvice(advice, { syncChordText: true });
  } catch (error) { toast(error.message); }
}

/** A click on empty grid space writes a note; Shift-drag rubber-bands a
 *  selection. Adding on the down-press (not on release) makes clicks reliable —
 *  a shaky mouse or trackpad tap no longer gets swallowed as an empty marquee. */
function labRowPointerDown(event, midi) {
  if (event.target.closest(".lab-note")) return;
  event.preventDefault();
  if (event.button === 2) return; // right-click on empty grid: no-op (menu suppressed)
  setLabContextMode("note");
  const track = event.currentTarget;
  if (event.shiftKey) { labMarqueeStart(event, track); return; }
  const beats = labSnap(labTrackBeats(track, event.clientX));
  labNoteEdit("add", { pitch: midi, start: beats, duration: window.labNoteLength || 1, voice: window.labActiveVoice || 1 });
}

/** Drag a note to move it, or drag its right edge to change the length.
 *  Right-click deletes the note. */
function labNotePointerDown(event, index) {
  event.stopPropagation();
  event.preventDefault();
  const note = (window.currentLabAdvice?.melody || [])[index];
  if (!note) return;
  if (event.button === 2) { labNoteEdit("delete", { index }); return; }
  selectLabNote(index);
  const element = event.currentTarget;
  const resizing = !!event.target.closest(".lab-note-grip");
  const beatPx = labBeatPx();
  const rowHeight = element.closest(".lab-row").getBoundingClientRect().height || 15;
  const rows = window.labGridRows || [];
  const rowIndex = rows.indexOf(note.pitch);
  const origin = { x: event.clientX, y: event.clientY };
  let next = { pitch: note.pitch, start: note.start, duration: note.duration };
  let moved = false;

  const onMove = pointer => {
    const dx = (pointer.clientX - origin.x) / beatPx;
    if (resizing) {
      next.duration = Math.max(0.125, labSnap(note.duration + dx) || 0.125);
      element.style.setProperty("--len", next.duration);
    } else {
      next.start = labSnap(note.start + dx);
      const step = Math.round((pointer.clientY - origin.y) / rowHeight);
      const target = rows[Math.min(rows.length - 1, Math.max(0, rowIndex + step))];
      next.pitch = target ?? note.pitch;
      element.style.setProperty("--start", next.start);
      element.style.transform = `translateY(${(rows.indexOf(next.pitch) - rowIndex) * rowHeight}px)`;
    }
    if (Math.abs(pointer.clientX - origin.x) > 2 || Math.abs(pointer.clientY - origin.y) > 2) moved = true;
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!moved) return;
    if (resizing) labNoteEdit("resize", { index, duration: next.duration });
    else labNoteEdit("move", { index, pitch: next.pitch, start: next.start });
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// ── Timeline: chord blocks, loop region and marquee selection ───────────────

function labSystemOffset(element) {
  return Number(element?.closest(".lab-system")?.dataset.offset || 0);
}

/** Absolute beat under the pointer, counting the system this track belongs to. */
function labTrackBeats(track, clientX) {
  const local = (clientX - track.getBoundingClientRect().left) / labBeatPx();
  return Math.max(0, labSystemOffset(track) + local);
}

/** Chord blocks move freely and resize from either edge; dropping over another
 *  chord trims it (the moved block wins). A plain click selects and plays. */
function labChordPointerDown(event, index) {
  event.stopPropagation();
  event.preventDefault();
  const advice = window.currentLabAdvice;
  const chord = (advice?.chords || [])[index];
  if (!chord) return;
  if (event.button === 2) { labEdit("delete", "", index); return; } // right-click deletes
  const element = event.currentTarget;
  const resizeRight = !!event.target.closest(".lab-chord-grip-right");
  const resizeLeft = !!event.target.closest(".lab-chord-grip-left");
  const beatPx = labBeatPx();
  const originX = event.clientX;
  const end = chord.start + chord.beats;
  const minBeats = window.labSnapBeats || 0.5;
  let moved = false;
  let nextBeats = chord.beats;
  let nextStart = chord.start;

  const onMove = pointer => {
    if (Math.abs(pointer.clientX - originX) > 3) moved = true;
    if (!moved) return;
    const dBeats = (pointer.clientX - originX) / beatPx;
    if (resizeRight) {
      nextBeats = Math.max(minBeats, labSnap(chord.beats + dBeats));
      element.style.setProperty("--len", nextBeats);
    } else if (resizeLeft) {
      // Right edge is anchored; drag the start, length follows.
      nextStart = Math.max(0, Math.min(labSnap(chord.start + dBeats), end - minBeats));
      nextBeats = Math.max(minBeats, end - nextStart);
      element.style.setProperty("--start", nextStart - labSystemOffset(element));
      element.style.setProperty("--len", nextBeats);
    } else {
      nextStart = Math.max(0, labSnap(chord.start + dBeats));
      element.style.setProperty("--start", nextStart - labSystemOffset(element));
      element.style.opacity = ".75";
    }
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    element.style.opacity = "";
    if (!moved) {
      if (event.shiftKey) labExtendChordSelection(index);
      else selectLabChord(index);
      labPlay([chord.midi]);
      return;
    }
    if (resizeRight) labEdit("duration", nextBeats, index);
    else if (resizeLeft) labEdit("resize_left", nextStart, index);
    else if (nextStart !== chord.start) labEdit("position", nextStart, index);
    else labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function labLaneBackgroundDown(event) {
  setLabContextMode("chord");
  if (event.target.closest(".lab-lane-chord")) return;
  // A click on empty lane drops a paste caret at that beat: Ctrl+V lands here.
  window.labChordCaret = labSnap(labTrackBeats(event.currentTarget, event.clientX));
  deselectLabChord(event);
}
function clearLabChordCaret() {
  window.labChordCaret = null;
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
}

/** Drag across empty ruler space to mark a new loop; playback then repeats
 *  that span. A pointerdown that starts on the loop band itself never reaches
 *  here — labLoopBandPointerDown claims it (Hookpad-style: click the existing
 *  band to toggle it, drag its own edges to resize). */
function labLoopPointerDown(event) {
  event.preventDefault();
  const track = event.currentTarget;
  const from = labSnap(labTrackBeats(track, event.clientX));
  let to = from;
  const onMove = pointer => {
    to = labSnap(labTrackBeats(track, pointer.clientX));
    const band = document.querySelector(".lab-loop") || (() => {
      const node = document.createElement("i");
      node.className = "lab-loop";
      node.innerHTML = `<b class="lab-loop-clear" onpointerdown="event.stopPropagation();clearLabLoop()" title="Убрать луп">×</b>`;
      track.appendChild(node);
      return node;
    })();
    // The band lives inside this system's track, so position it system-relative
    // (subtract the offset); otherwise it lands far off on lower systems.
    band.style.setProperty("--from", Math.min(from, to) - labSystemOffset(track));
    band.style.setProperty("--len", Math.abs(to - from));
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const span = Math.abs(to - from);
    if (span < (window.labSnapBeats || 0.5)) return clearLabLoop();
    window.labLoop = { from: Math.min(from, to), to: Math.min(from, to) + span, enabled: true };
    saveLabOutputState();
    labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
    syncNativePlaybackTimeline();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

/** The existing loop band: a plain click toggles it on/off (bounds stay
 *  remembered either way — playback just stops honouring them while off), and
 *  either edge grip stretches or narrows that side. No move-by-dragging-the-
 *  middle, matching what was asked for — Hookpad doesn't have that either. */
function labLoopBandPointerDown(event) {
  event.stopPropagation();
  event.preventDefault();
  const loop = window.labLoop;
  if (!loop) return;
  const resizeRight = !!event.target.closest(".lab-loop-grip-right");
  const resizeLeft = !!event.target.closest(".lab-loop-grip-left");
  if (!resizeRight && !resizeLeft) {
    window.labLoop = { ...loop, enabled: loop.enabled === false };
    saveLabOutputState();
    labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
    syncNativePlaybackTimeline();
    return;
  }
  const element = event.currentTarget;
  const beatPx = labBeatPx();
  const originX = event.clientX;
  const minSpan = window.labSnapBeats || 0.5;
  const offset = labSystemOffset(element);
  let nextFrom = loop.from;
  let nextTo = loop.to;
  const onMove = pointer => {
    const dBeats = (pointer.clientX - originX) / beatPx;
    if (resizeRight) {
      nextTo = Math.max(loop.from + minSpan, labSnap(loop.to + dBeats));
      element.style.setProperty("--len", nextTo - loop.from);
    } else {
      nextFrom = Math.max(0, Math.min(labSnap(loop.from + dBeats), loop.to - minSpan));
      element.style.setProperty("--from", nextFrom - offset);
      element.style.setProperty("--len", loop.to - nextFrom);
    }
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.labLoop = { from: nextFrom, to: nextTo, enabled: loop.enabled !== false };
    saveLabOutputState();
    labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
    syncNativePlaybackTimeline();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function clearLabLoop() {
  window.labLoop = null;
  saveLabOutputState();
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
  syncNativePlaybackTimeline();
}

/** The loop only affects playback while switched on; a disabled loop still
 *  remembers its bounds (rendered dimmed) so a click re-enables the same
 *  region instead of forcing the user to redraw it. */
function labActiveLoop() {
  const loop = window.labLoop;
  return loop && loop.enabled !== false ? loop : null;
}

/** Drag over empty grid space to rubber-band a group of notes. */
function labMarqueeStart(event, track) {
  const inner = track.closest(".lab-score-inner");
  const box = inner.getBoundingClientRect();
  const marquee = inner.querySelector(".lab-marquee");
  const origin = { x: event.clientX, y: event.clientY };
  let dragged = false;

  const paint = pointer => {
    const left = Math.min(origin.x, pointer.clientX) - box.left;
    const top = Math.min(origin.y, pointer.clientY) - box.top;
    marquee.hidden = false;
    marquee.style.left = `${left}px`;
    marquee.style.top = `${top}px`;
    marquee.style.width = `${Math.abs(pointer.clientX - origin.x)}px`;
    marquee.style.height = `${Math.abs(pointer.clientY - origin.y)}px`;
  };
  const onMove = pointer => {
    if (Math.abs(pointer.clientX - origin.x) > 4 || Math.abs(pointer.clientY - origin.y) > 4) dragged = true;
    if (dragged) paint(pointer);
  };
  const onUp = pointer => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    marquee.hidden = true;
    if (!dragged) return false;
    const area = { left: Math.min(origin.x, pointer.clientX), right: Math.max(origin.x, pointer.clientX), top: Math.min(origin.y, pointer.clientY), bottom: Math.max(origin.y, pointer.clientY) };
    // Only the active voice is selectable — greyed voices are locked, so the
    // marquee ignores them.
    const hits = [...document.querySelectorAll(".lab-note:not(.is-inactive)")].filter(note => {
      const rect = note.getBoundingClientRect();
      return rect.right >= area.left && rect.left <= area.right && rect.bottom >= area.top && rect.top <= area.bottom;
    }).map(note => Number(note.dataset.note));
    window.labSelectedNotes = hits;
    window.labSelectedNote = hits.length === 1 ? hits[0] : null;
    window.labInspector = hits.length ? "note" : "chord";
    labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
    labSetRegion("lab-chord-inspector", labInspectorHtml(window.currentLabAdvice));
    if (hits.length > 1) toast(`Выбрано нот: ${hits.length}`);
    return true;
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  return () => dragged;
}

function selectLabNote(index) {
  window.labSelectedNote = index;
  window.labSelectedNotes = [index];
  window.labInspector = "note";
  setLabContextMode("note");
  document.querySelectorAll(".lab-note").forEach(item => item.classList.toggle("selected", Number(item.dataset.note) === index));
  labSetRegion("lab-chord-inspector", labInspectorHtml(window.currentLabAdvice));
}

/** Delete every selected note, highest index first so the rest stay valid. */
async function labDeleteSelectedNotes() {
  const selected = [...(window.labSelectedNotes || [])].sort((a, b) => b - a);
  if (!selected.length) return;
  for (const index of selected) await labNoteEdit("delete", { index });
  window.labSelectedNotes = [];
  window.labSelectedNote = null;
}

function setLabNoteLength(value) { window.labNoteLength = Number(value); }
function setLabSnap(value) {
  window.labSnapBeats = Number(value) || 0.5;
  // Re-render so the grid draws subdivision lines at the new snap resolution.
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
}

// ── Voices and MIDI output routing ──────────────────────────────────────────
// Chords play on MIDI channel 1; melody voice N plays on channel N+1, so the
// user can point separate Ableton instrument tracks at each channel.

const LAB_VOICE_COUNT = 4;

function labVoiceMutes() {
  // Note: a global `function labVoiceMutes` already occupies window.labVoiceMutes,
  // so the state is kept under a distinct name to avoid clobbering the function.
  if (!window.labVoiceMuteState) window.labVoiceMuteState = { 1: false, 2: false, 3: false, 4: false };
  return window.labVoiceMuteState;
}

function labVoicesBarHtml(advice) {
  const active = window.labActiveVoice || 1;
  const mutes = labVoiceMutes();
  const counts = {};
  for (const note of advice?.melody || []) { const v = note.voice || 1; counts[v] = (counts[v] || 0) + 1; }
  const picks = Array.from({ length: LAB_VOICE_COUNT }, (_, i) => {
    const v = i + 1;
    const n = counts[v] || 0;
    return `<button type="button" class="lab-voice-pick lab-voice-${v} ${v === active ? "active" : ""}" onclick="setLabActiveVoice(${v})" aria-pressed="${v === active}" title="Голос ${v}${n ? ` · ${n} нот · клавиша ${v}` : ` · пусто · клавиша ${v}`}"><b>${v}</b><small>${n || "·"}</small></button>`;
  }).join("");
  const chordsMuted = !!window.labChordsMuted;
  const chordChip = `<button type="button" class="lab-out-chip lab-out-chords ${chordsMuted ? "is-muted" : ""}" onclick="toggleLabChordsMute()" aria-pressed="${!chordsMuted}" title="Этот инстанс ${chordsMuted ? "не выводит" : "выводит"} аккорды (Ch 1 для Logic/Cubase)"><span>Аккорды</span><small>Ch 1</small></button>`;
  const voiceChips = Array.from({ length: LAB_VOICE_COUNT }, (_, i) => {
    const v = i + 1;
    const muted = !!mutes[v];
    return `<button type="button" class="lab-out-chip lab-voice-${v} ${muted ? "is-muted" : ""}" onclick="toggleLabVoiceMute(${v})" aria-pressed="${!muted}" title="Этот инстанс ${muted ? "не выводит" : "выводит"} голос ${v} (Ch ${v + 1} для Logic/Cubase)"><span>Г${v}</span><small>Ch ${v + 1}</small></button>`;
  }).join("");
  return `<div class="lab-voices-edit"><span class="lab-voices-label">Голос</span>${picks}</div>
    ${labSharePickerHtml()}
    <div class="lab-voices-out"><span class="lab-voices-label" title="Отдельный инстанс на каждый инструмент: выключите здесь всё, кроме своей партии, и заведите MIDI From → этот инстанс в Ableton">Выводит этот инстанс</span>${chordChip}${voiceChips}</div>
    ${labMixerHtml()}`;
}

/** Per-part vertical volume mixer (chords + voices), scaling MIDI velocity.
 *  Faders are tall for precision; double-click a fader resets it to 100%. */
function labMixerHtml() {
  const vol = labPartVolume();
  const strip = (part, label) => {
    const v = vol[part] ?? 1;
    return `<div class="lab-mix" data-part="${part}" title="Громкость ${label} — двойной клик сбрасывает на 100%">
      <b class="lab-mix-val">${Math.round(v * 100)}%</b>
      <span class="lab-mix-fader">
        <input type="range" min="0" max="1.5" step="0.01" value="${v}" aria-label="Громкость ${label}"
          oninput="setLabPartVolume('${part}', this.value)" ondblclick="resetLabPartVolume('${part}')">
      </span>
      <small class="lab-mix-name">${label}</small>
    </div>`;
  };
  return `<div class="lab-voices-mix">
    <span class="lab-voices-label">Микшер</span>
    <div class="lab-mixer">
      ${strip("chords", "Акк")}${strip("v1", "Г1")}${strip("v2", "Г2")}${strip("v3", "Г3")}${strip("v4", "Г4")}
    </div>
  </div>`;
}

/** Picker to copy another instance's content into this one — a one-shot copy,
 * not a live link, so instances stay independent. */
function labSharePickerHtml() {
  if (!labInstanceId) return "";
  const others = (window.labAllSketches || []).filter(s => s.instance_id && s.instance_id !== labInstanceId);
  if (!others.length) return "";
  const options = others.map(s => {
    const label = `${s.title || "эскиз"} · ${s.tonic || ""} ${(s.chord_input || "").slice(0, 16)}`.trim();
    return `<option value="${esc(s.id)}">${esc(label)}</option>`;
  }).join("");
  return `<label class="lab-share" title="Скопировать аккорды и ноты из другого инстанса в этот (разово, без связывания — инстансы остаются независимыми)">
    <span class="lab-voices-label">Копировать из</span>
    <select onchange="copyFromLabSketch(this.value); this.selectedIndex = 0;"><option value="">— инстанс —</option>${options}</select>
  </label>`;
}

function labRenderVoicesBar() {
  if (document.getElementById("lab-voices-bar")) labSetRegion("lab-voices-bar", labVoicesBarHtml(window.currentLabAdvice));
}

function setLabActiveVoice(voice) {
  window.labActiveVoice = Math.min(LAB_VOICE_COUNT, Math.max(1, Number(voice) || 1));
  labRenderVoicesBar();
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
}

function toggleLabVoiceMute(voice) {
  const mutes = labVoiceMutes();
  mutes[voice] = !mutes[voice];
  saveLabOutputState();
  labRenderVoicesBar();
  syncNativePlaybackTimeline();
}

function toggleLabChordsMute() {
  window.labChordsMuted = !window.labChordsMuted;
  saveLabOutputState();
  labRenderVoicesBar();
  syncNativePlaybackTimeline();
}

// Pause shared-sketch sync while the pointer is actively editing the score,
// so an incoming reload never interrupts a drag or click.
document.addEventListener("pointerdown", event => {
  if (event.target.closest?.(".lab-systems, .lab-voices-bar, .lab-insert, .lab-chord-inspector")) window.labPointerBusy = true;
}, true);
document.addEventListener("pointerup", () => { setTimeout(() => { window.labPointerBusy = false; }, 80); }, true);

// Right-click in the roll/lane/palette edits (delete note/chord) rather than
// opening the browser's own context menu, so nothing gets in the way.
document.addEventListener("contextmenu", event => {
  if (event.target.closest?.(".lab-systems, .lab-context-bar, .lab-voices-bar, .lab-chord-inspector, .lab-lane-row")) event.preventDefault();
});

/** Editor shortcuts, ignored while typing into a field. */
document.addEventListener("keydown", event => {
  if (!currentSketchId || !document.getElementById("lab-score")) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === "z" && event.shiftKey) { event.preventDefault(); labRedo(); }
    else if (key === "z") { event.preventDefault(); labUndo(); }
    else if (key === "y") { event.preventDefault(); labRedo(); }
    else if (key === "c") { event.preventDefault(); labCopy(); }
    else if (key === "x") { event.preventDefault(); labCut(); }
    else if (key === "v") { event.preventDefault(); labPaste(); }
    else if (key === "a") { event.preventDefault(); labSelectAll(); }
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    ptmAudio.isPlaying() ? labStopScore() : labPlayScore(document.querySelector(".lab-tool-play"));
  } else if (event.key === "Escape") {
    const drawerOpen = document.querySelector(".lab-drawer:not([hidden])");
    if (drawerOpen) { event.preventDefault(); closeLabDrawers(); }
    else if (ptmAudio.isPlaying()) labStopScore(); else deselectLabChord();
  } else if (event.key === "Delete" || event.key === "Backspace") {
    if (window.labInspector === "note" && (window.labSelectedNotes || []).length) {
      event.preventDefault();
      labDeleteSelectedNotes();
    } else if (labSelectedChord(window.currentLabAdvice)) {
      event.preventDefault();
      labEdit("delete", "", window.labSelectedChordIndex);
    }
  } else if (event.key >= "1" && event.key <= "4") {
    event.preventDefault();
    setLabActiveVoice(Number(event.key));
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const chords = window.currentLabAdvice?.chords || [];
    if (!chords.length) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const current = window.labSelectedChordIndex;
    const next = current == null || current < 0 ? (step > 0 ? 0 : chords.length - 1) : Math.min(chords.length - 1, Math.max(0, current + step));
    selectLabChord(next);
  }
});

// ── Toolbar and insert strip ────────────────────────────────────────────────

const LAB_METERS = ["4/4", "3/4", "6/8", "5/4", "7/8"];


function labCompactToolbarHtml(sketch) {
  return `<div class="lab-tool-group lab-tool-transport" aria-label="Воспроизведение">
      <button type="button" class="lab-tool-icon lab-tool-play" onclick="labPlayScore(this)" aria-label="Проиграть эскиз">${ICONS.play}</button>
      <button type="button" class="lab-tool-icon lab-tool-stop" onclick="labStopScore()" aria-label="Остановить">${ICONS.stop}</button>
    </div>
    <div class="lab-tool-group lab-tool-history" aria-label="История действий">
      <button type="button" id="lab-undo" class="lab-tool-icon" onclick="labUndo()" aria-label="Отменить действие" title="Отменить · Ctrl+Z">${ICONS.undo}</button>
      <button type="button" id="lab-redo" class="lab-tool-icon" onclick="labRedo()" aria-label="Повторить действие" title="Повторить · Ctrl+Shift+Z">${ICONS.redo}</button>
    </div>
    ${labTonicPicker(sketch.tonic)}
    <label class="lab-meta-field lab-mode-field"><span class="lab-field-label">Лад</span><select id="lab-mode" onchange="patchLabContext({mode:this.value})">${labModeOptions(sketch.mode)}</select></label>
    ${labBpmPicker(sketch.bpm)}
    <label class="lab-meta-field lab-meter-field"><span class="lab-field-label">Размер</span><select id="lab-meter" onchange="patchLabContext({meter:this.value})">${LAB_METERS.map(item => `<option value="${item}" ${item === sketch.meter ? "selected" : ""}>${item}</option>`).join("")}</select></label>
    <div class="lab-tool-group lab-tool-panels" aria-label="Панели">
      <button type="button" id="lab-voices-btn" class="lab-tool-btn" onclick="toggleLabVoices()" aria-expanded="false" title="Голоса инструмента, MIDI-выход и микшер">Голоса</button>
      <button type="button" class="lab-tool-btn" onclick="openLabChordText(this)" title="Ввести аккорды текстом — символами (Cmaj7 Am) или римскими ступенями (I V vi IV, bVII)">⌨ Аккорды</button>
      <button type="button" class="lab-tool-btn" onclick="exportLabMidi(this)" title="Экспорт MIDI: создаёт .mid по частям и открывает папку — файлы можно перетащить в DAW">↧ MIDI</button>
    </div>
    ${labInPlugin() ? "" : `<div class="lab-tool-group lab-tool-actions">
      ${labFocusMode() ? `<button type="button" class="lab-tool-btn" onclick="window.close()">Закрыть</button>` : `<button type="button" class="lab-tool-btn" onclick="openLabFocus()" title="Открыть редактор на весь экран">⤢</button>`}
      <button type="button" class="lab-tool-btn lab-tool-danger" onclick="deleteLabSketch()" title="Удалить эскиз">🗑</button>
    </div>`}
    <span id="lab-save-state" class="lab-save-state lab-visually-hidden" aria-live="polite">сохранено</span>`;
}

/** True when the editor runs inside the JUCE/WebView2 plug-in — the native
 * transport hooks are injected before page scripts run. Controls that only make
 * sense in a standalone browser tab (close window, delete sketch) drop out. */
function labInPlugin() {
  return typeof window.harmonyCanvasSetPlaybackTimeline === "function";
}

// ── Text chord entry ────────────────────────────────────────────────────────
// A modal for typing a whole progression: absolute symbols (Cmaj7 Am7 F) or
// roman-numeral degrees (I V vi IV, bVII) resolved against the sketch's key.
// The sidecar normalises numerals to symbols on save, so this only sends text.

function openLabChordText() {
  if (!currentSketchId) return;
  const current = document.getElementById("lab-chords")?.value
    ?? window.currentLabAdvice?.chord_input ?? "";
  closeLabChordText();
  const scrim = document.createElement("div");
  scrim.id = "lab-chordtext-scrim";
  scrim.className = "lab-modal-scrim";
  scrim.innerHTML = `<div class="lab-modal" role="dialog" aria-modal="true" aria-label="Ввод аккордов текстом">
    <div class="lab-modal-head"><strong>Аккорды текстом</strong><button type="button" class="lab-drawer-close" aria-label="Закрыть" onclick="closeLabChordText()">×</button></div>
    <textarea id="lab-chordtext-input" rows="3" spellcheck="false" placeholder="Cmaj7 Am7 Dm7 G7    ·    I V vi IV    ·    i bVII bVI V">${esc(current)}</textarea>
    <p class="field-hint">Разделяйте пробелом, тире или запятой. Понимает символы (<b>Cmaj7</b>, <b>Am/E</b>) и римские ступени в текущей тональности (<b>I&nbsp;V&nbsp;vi&nbsp;IV</b>, <b>bVII</b>) — ЗАГЛАВНЫЕ читаются как мажор, строчные как минор.</p>
    <div class="lab-modal-foot"><button type="button" class="lab-tool-btn" onclick="closeLabChordText()">Отмена</button><button type="button" class="lab-tool-btn lab-tool-primary" onclick="applyLabChordText()">Применить</button></div>
  </div>`;
  scrim.addEventListener("click", event => { if (event.target === scrim) closeLabChordText(); });
  document.body.appendChild(scrim);
  const field = document.getElementById("lab-chordtext-input");
  field?.focus();
  field?.setSelectionRange(field.value.length, field.value.length);
  field?.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeLabChordText(); }
    else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); applyLabChordText(); }
  });
}

function closeLabChordText() {
  document.getElementById("lab-chordtext-scrim")?.remove();
}

async function applyLabChordText() {
  const field = document.getElementById("lab-chordtext-input");
  if (!field) return;
  const value = field.value.trim();
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify({ chord_input: value }) });
    closeLabChordText();
    window.labSelectedChordIndex = null;
    window.labLastLocalEdit = Date.now();
    await refreshLabAdvice();
    toast("Аккорды обновлены");
  } catch (error) { toast(error.message); }
}

// ── Slide-out drawers: chord palette and voices/mixer ───────────────────────

function openLabDrawer(which) {
  const palette = document.getElementById("lab-palette-drawer");
  const voices = document.getElementById("lab-voices-drawer");
  const scrim = document.getElementById("lab-drawer-scrim");
  const target = which === "palette" ? palette : voices;
  const other = which === "palette" ? voices : palette;
  if (!target) return;
  if (other) { other.hidden = true; other.setAttribute("aria-hidden", "true"); }
  target.hidden = false;
  target.setAttribute("aria-hidden", "false");
  if (scrim) scrim.hidden = false;
  document.getElementById("lab-palette-btn")?.setAttribute("aria-expanded", String(which === "palette"));
  document.getElementById("lab-voices-btn")?.setAttribute("aria-expanded", String(which === "voices"));
}

function closeLabDrawers() {
  for (const id of ["lab-palette-drawer", "lab-voices-drawer"]) {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; el.setAttribute("aria-hidden", "true"); }
  }
  const scrim = document.getElementById("lab-drawer-scrim");
  if (scrim) scrim.hidden = true;
  document.getElementById("lab-palette-btn")?.setAttribute("aria-expanded", "false");
  document.getElementById("lab-voices-btn")?.setAttribute("aria-expanded", "false");
}

function openLabPalette() { openLabDrawer("palette"); }

function toggleLabPalette() {
  const el = document.getElementById("lab-palette-drawer");
  if (el && el.hidden) openLabDrawer("palette"); else closeLabDrawers();
}

function toggleLabVoices() {
  const el = document.getElementById("lab-voices-drawer");
  if (el && el.hidden) openLabDrawer("voices"); else closeLabDrawers();
}

/** Export each part as a .mid into a folder on the desktop and open it, so the
 *  files can be dragged straight into the DAW. */
async function exportLabMidi(button) {
  if (!currentSketchId) return;
  if (button) button.disabled = true;
  try {
    const result = await api(`/sketches/${currentSketchId}/export-midi`, { method: "POST", body: "{}" });
    const files = (result.files || []).length;
    toast(files ? `MIDI сохранён (${files} файл(ов)) — папка открыта` : "Нет нот для экспорта");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

const LAB_INSERT_TABS = [["mode", "Лад"], ["context", "После аккорда"], ["key", "В тональности"], ["theory", "По теории"]];

function labInsertHtml(advice) {
  const active = window.labInsertTab || "mode";
  return `<div class="lab-insert-tabs" role="tablist">${LAB_INSERT_TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === active}" class="${id === active ? "active" : ""}" onclick="setLabInsertTab('${id}')">${label}</button>`).join("")}</div>
    <div id="lab-insert-body" class="lab-insert-body">${labInsertBodyHtml(advice)}</div>`;
}

function labInsertBodyHtml(advice) {
  const tab = window.labInsertTab || "mode";
  if (tab === "mode") return labChordPaletteHtml(advice);
  if (tab === "theory") return labTheoryHtml(advice);
  const source = advice.statistics_source || {};
  const selected = labSelectedChord(advice);
  const items = tab === "context" ? advice.context_chords || [] : advice.key_chords || [];
  const caption = tab === "context"
    ? `Чаще всего после ${selected ? esc(selected.degree) : "выбранного"} · условная частота по ${source.progressions || 0} схемам ПТМ`
    : `Общая частота в тональности · ${source.observations || 0} наблюдений`;
  return `<div class="lab-insert-caption">${caption}</div><div class="lab-weight-row">${items.length ? labWeightedRow(items) : `<span class="field-hint">Каталог не знает продолжений для этой ступени</span>`}</div>`;
}

function labTheoryHtml(advice) {
  const groups = [["stable", "Опора"], ["color", "Краска лада"], ["contrast", "Выход наружу"]];
  return `<div class="lab-insert-caption">Правила гармонии, а не статистика — почему аккорд уместен</div>
    ${groups.map(([id, label]) => `<div class="lab-next-group"><strong>${label}</strong><div>${(advice.next_chords || []).filter(item => item.group === id).map(item => `<span class="lab-next-chip" title="${esc(item.reason)}"><button type="button" onclick="labPlay([[${item.midi.join(",")}]],this)" aria-label="Проиграть ${esc(item.symbol)}">▶</button><button type="button" onclick="appendLabChord('${esc(item.symbol)}')"><b>${esc(item.symbol)}</b><small>${esc(item.degree)}</small><i>+</i></button></span>`).join("")}</div></div>`).join("")}`;
}

async function setLabInsertTab(tab) {
  window.labInsertTab = tab;
  labSetRegion("lab-insert-body", labInsertBodyHtml(window.currentLabAdvice));
  document.querySelectorAll(".lab-insert-tabs button").forEach(button => {
    const active = button.textContent === (LAB_INSERT_TABS.find(([id]) => id === tab) || [])[1];
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function labChordPaletteHtml(advice) {
  const selected = labSelectedChord(advice);
  const context = advice.palette_context || {};
  const modes = [["", "свой лад"], ...LAB_BORROW_MODES.map(([value, label]) => [value, label])];
  const hintTitle = selected
    ? `Клик по ступени заменит ${esc(selected.symbol)}; перетащите на гармонию, чтобы вставить`
    : "Клик добавит аккорд в конец; перетащите на дорожку гармонии, чтобы вставить в нужное место";
  return `<div class="lab-palette">
    <span class="lab-palette-hint ${selected ? "is-replace" : ""}" title="${hintTitle}">${selected ? `⇄ ${esc(selected.symbol)}` : "＋ в конец"}</span>
    <select class="lab-palette-mode" title="В каком ладу читать палитру ступеней" onchange="setLabPaletteMode(this.value)">${modes.map(([value, label]) => `<option value="${value}" ${(window.labPaletteMode || "") === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>
    <div class="lab-palette-row">${(advice.diatonic_palette || []).map(item => labChordCellHtml(item, item.degree_index, context)).join("")}</div>
  </div>`;
}

/** One compact, degree-coloured cell: play on the left, insert on the right. */
function labChordCellHtml(item, degreeIndex, context = {}) {
  return `<span class="lab-cell ${item.borrowed ? "is-borrowed" : ""}" style="--deg:${labChromaColor(item.chroma)}">
    <button type="button" class="lab-cell-play" onclick="labPlay([[${item.midi.join(",")}]],this)" aria-label="Проиграть ${esc(item.symbol)}" title="Проиграть">▶</button>
    <button type="button" class="lab-cell-main" onpointerdown="labChordDragStart(event, '${esc(item.symbol)}', [${item.midi.join(",")}])" title="${esc(item.symbol)} — клик проиграет и добавит, перетащите на гармонию">
      <b>${esc(item.degree)}</b><strong>${esc(item.symbol)}</strong>${item.borrowed ? `<i>${esc((context.label || "").slice(0, 3))}</i>` : ""}
    </button></span>`;
}

/** Keep the selection in range, but never turn "nothing selected" into zero. */
function labClampSelection(total) {
  const current = window.labSelectedChordIndex;
  if (current === null || current === undefined || current < 0) return null;
  return total ? Math.min(current, total - 1) : null;
}

function labSelectedChord(advice) {
  const index = window.labSelectedChordIndex;
  return index === null || index === undefined || index < 0 ? null : advice?.chords?.[index];
}

/** A selected chord is replaced; with nothing selected the chord is appended. */
async function putLabChord(symbol) {
  const advice = window.currentLabAdvice;
  if (labSelectedChord(advice)) return labEdit("symbol", symbol);
  await labEdit("insert", symbol, Math.max(0, (advice?.chords?.length || 1) - 1), { keepSelection: true });
}

function deselectLabChord(event) {
  if (event && event.target.closest(".lab-lane-chord")) return;
  window.labSelectedChordIndex = null;
  window.labSelectedChords = [];
  window.labInspector = "chord";
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
  labRenderContextBar();
  labSetRegion("lab-chord-inspector", labInspectorHtml(window.currentLabAdvice));
}

async function clearLabSecondary() {
  window.labSecondary = null;
  await refreshLabAdvice();
}

async function setLabPaletteMode(mode) {
  window.labPaletteMode = mode || null;
  await refreshLabAdvice();
}

// Option ids come straight from the server so availability and spelling agree.
const LAB_OPTION_SPEC = [["sus2", "sus2"], ["add9", "add9"], ["b5", "♭5"], ["sus4", "sus4"], ["add11", "add11"], ["#5", "♯5"], ["6", "6"], ["add13", "add13"], ["b9", "♭9"], ["no3", "no3"], ["no5", "no5"], ["#9", "♯9"], ["#11", "♯11"], ["b13", "♭13"]];
const LAB_BORROW_MODES = [["major", "Major"], ["dorian", "Dorian"], ["phrygian", "Phrygian"], ["lydian", "Lydian"], ["mixolydian", "Mixolydian"], ["minor", "Minor"], ["locrian", "Locrian"], ["harmonic_minor", "Har. Minor"], ["phrygian_dominant", "Phr. Dominant"]];

function labSegments(items, current, op) {
  return `<div class="lab-property-segments">${items.map(([value, label, disabled]) => `<button type="button" class="${current === value ? "active" : ""}" ${disabled ? "disabled" : ""} onclick="labEdit('${op}','${value}')">${label}</button>`).join("")}</div>`;
}

/** The inspector follows whatever was touched last: a chord or a note. */
function labInspectorHtml(advice) {
  return window.labInspector === "note" ? labNoteInspectorHtml(advice) : labChordInspectorHtml(advice);
}

function labNoteInspectorHtml(advice) {
  const index = window.labSelectedNote;
  const note = (advice?.melody || [])[index];
  if (!note) return `<div class="lab-inspector-empty"><strong>Свойства ноты</strong><span>Кликните по сетке, чтобы поставить ноту</span></div>`;
  const rows = window.labGridRows || [];
  const position = rows.indexOf(note.pitch);
  return `<div class="lab-inspector-head"><div><small>NOTE PROPERTIES</small><strong>${esc(note.name)} <i>ступень ${esc(note.degree)}</i></strong></div><button type="button" onclick="labPlay([[${note.pitch}]],this)" aria-label="Проиграть ноту">▶</button></div>
    <div class="lab-note-facts">
      <span><small>В ладу</small><b>${note.in_scale ? "да" : "нет, альтерация"}</b></span>
      <span><small>Тон аккорда</small><b>${note.chord_tone ? "да" : "нет"}${note.chord_symbol ? ` · ${esc(note.chord_symbol)}` : ""}</b></span>
    </div>
    <div class="lab-property-title"><span>Высота</span></div>
    <div class="lab-property-segments lab-pitch-nudge">
      <button type="button" onclick="labNoteEdit('move',{index:${index},pitch:${note.pitch + 12}})" ${position <= 0 ? "disabled" : ""}>+ окт</button>
      <button type="button" onclick="labNoteEdit('move',{index:${index},pitch:${rows[Math.max(0, position - 1)] ?? note.pitch}})" ${position <= 0 ? "disabled" : ""}>▲</button>
      <button type="button" onclick="labNoteEdit('move',{index:${index},pitch:${rows[Math.min(rows.length - 1, position + 1)] ?? note.pitch}})" ${position >= rows.length - 1 ? "disabled" : ""}>▼</button>
      <button type="button" onclick="labNoteEdit('move',{index:${index},pitch:${note.pitch - 12}})" ${position >= rows.length - 1 ? "disabled" : ""}>− окт</button>
    </div>
    <div class="lab-property-title"><span>Длина</span></div>
    ${`<div class="lab-property-segments">${LAB_NOTE_LENGTHS.map(([value, label]) => `<button type="button" class="${note.duration === value ? "active" : ""}" onclick="labNoteEdit('resize',{index:${index},duration:${value}})">${label}</button>`).join("")}</div>`}
    <label class="lab-borrow-label">Начало, доля<input type="number" min="0" step="0.25" value="${note.start}" onchange="labNoteEdit('move',{index:${index},start:Number(this.value)})"></label>
    <label class="lab-borrow-label">Голос<select onchange="labNoteEdit('voice',{index:${index},voice:Number(this.value)})">${[1, 2, 3, 4].map(voice => `<option value="${voice}" ${note.voice === voice ? "selected" : ""}>${voice}</option>`).join("")}</select></label>
    <div class="lab-inspector-actions"><button type="button" class="danger" onclick="labNoteEdit('delete',{index:${index}})">Удалить ноту</button></div>`;
}

const LAB_NOTE_PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

/** Twelve roots in the key's own spelling, current root pre-selected by pitch. */
function labRootOptions(currentRoot) {
  const sharp = window.labTonicSpelling === "sharp";
  const roots = sharp
    ? ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    : ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const currentPc = LAB_NOTE_PC[currentRoot];
  return roots.map(name => {
    const label = name.replace("#", "♯").replace("b", "♭");
    return `<option value="${name}" ${LAB_NOTE_PC[name] === currentPc ? "selected" : ""}>${label}</option>`;
  }).join("");
}

function labChordInspectorHtml(advice) {
  const index = window.labSelectedChordIndex;
  const chord = labSelectedChord(advice);
  if (!chord) return `<div class="lab-inspector-empty"><strong>Редактор аккорда</strong><span>Выберите аккорд на таймлайне. Пока ничего не выбрано, палитра добавляет аккорды в конец.</span></div>`;
  const state = chord.state || {};
  const available = chord.options_available || {};
  const inversions = chord.inversions_available || [true, false, false, false];
  const options = new Set(state.options || []);
  const inversionItems = [["none", "None"], ["1", "1st", !inversions[1]], ["2", "2nd", !inversions[2]], ["3", "3rd", !inversions[3]]];
  const currentInversion = state.inversion === null || state.inversion === undefined || state.inversion === 0 ? "none" : String(state.inversion);
  const seventhRow = state.type !== "triad" && state.base !== "dim"
    ? `<div class="lab-property-title"><span>Септима</span></div>${labSegments([["maj", "Δ большая"], ["dom", "малая"]], state.seventh === "maj" ? "maj" : "dom", "seventh")}`
    : "";
  const optionGrid = LAB_OPTION_SPEC.map(([value, label]) => {
    const enabled = available[value] !== false;
    return `<label class="${enabled ? "" : "is-disabled"}"><input type="checkbox" ${options.has(value) ? "checked" : ""} ${enabled ? "" : "disabled"} onchange="labEdit('option','${value}:'+(this.checked?1:0))"><span>${label}</span></label>`;
  }).join("");
  return `<div class="lab-inspector-head"><div><small>CHORD PROPERTIES</small><strong>${esc(chord.symbol)} <i>${esc(chord.degree)}</i></strong></div><button type="button" onclick="labPlay([[${chord.midi.join(",")}]],this)" aria-label="Проиграть аккорд">▶</button></div>
    <div class="lab-property-title"><span>Тоника аккорда</span></div>
    <label class="lab-borrow-label lab-root-field"><select onchange="labEdit('root',this.value)" aria-label="Корень аккорда">${labRootOptions(state.root)}</select></label>
    <div class="lab-property-title"><span>Type</span><button type="button" onclick="labEdit('reset')">Reset</button></div>${labSegments([["triad", "Triad"], ["7", "7"], ["9", "9"], ["11", "11"], ["13", "13"]], state.type || "triad", "type")}
    <div class="lab-property-title"><span>Quality</span></div>${labSegments([["maj", "Maj"], ["min", "Min"], ["dim", "Dim"], ["aug", "Aug"]], state.base || "maj", "quality")}
    ${seventhRow}
    <div class="lab-property-title"><span>Inversion</span>${state.inversion === null ? `<em class="lab-property-note">бас вне аккорда</em>` : ""}</div>${labSegments(inversionItems, currentInversion, "inversion")}
    <div class="lab-property-title"><span>Options</span></div><div class="lab-option-grid">${optionGrid}</div>
    <div class="lab-property-title"><span>Secondary</span>${window.labSecondary ? `<button type="button" onclick="clearLabSecondary()">Убрать линзу</button>` : ""}</div>${labSegments([["V", "V/"], ["IV", "IV/"], ["vii", "vii°/"]], window.labSecondary || "", "secondary")}
    <label class="lab-borrow-label">Читать ступень в ладу<select onchange="labEdit('borrow',this.value)">${[[advice.key.mode, `${esc(advice.key.label)} (свой)`], ...LAB_BORROW_MODES.filter(([value]) => value !== advice.key.mode)].map(([value, label]) => `<option value="${value}" ${(window.labPaletteMode || advice.key.mode) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <details class="lab-exact-symbol"><summary>Точная запись</summary><input id="lab-chord-symbol-input" value="${esc(chord.symbol)}" onchange="labEdit('symbol',this.value)"></details><div class="lab-inspector-actions"><button type="button" class="danger" onclick="labEdit('delete')">Удалить аккорд</button></div>`;
}

function labWeightedRow(items) {
  return items.map(item => `<span class="lab-cell lab-cell-weighted" title="${item.count} вхождений в каталоге ПТМ" style="--deg:var(--deg-${(item.degree_index ?? 0) + 1});--weight:${item.weight}%">
    <button type="button" class="lab-cell-play" onclick="labPlay([[${item.midi.join(",")}]],this)" aria-label="Проиграть ${esc(item.symbol)}" title="Проиграть">▶</button>
    <button type="button" class="lab-cell-main" onclick="putLabChord('${esc(item.symbol)}')"><b>${esc(item.degree)}</b><strong>${esc(item.symbol)}</strong><em>${item.weight}</em></button>
    <i class="lab-cell-bar"></i></span>`).join("");
}

// ── Lab state plumbing ──────────────────────────────────────────────────────

function labSetRegion(id, html) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = html;
}

function applyLabAdvice(advice, { syncChordText = false } = {}) {
  window.labLastLocalEdit = Date.now();
  window.currentLabAdvice = advice;
  window.labSelectedChordIndex = labClampSelection(advice.chords.length);
  if (syncChordText && typeof advice.chord_input === "string") {
    const input = document.getElementById("lab-chords");
    if (input && input.value !== advice.chord_input) input.value = advice.chord_input;
  }
  labSetRegion("lab-analysis", labAnalysisHtml(advice));
  labRenderContextBar();
  labSetRegion("lab-chord-inspector", labInspectorHtml(advice));
  labSetRegion("lab-score", labScoreHtml(advice));
  labSetRegion("lab-scale-strip", labScaleHtml(advice));
  syncNativePlaybackTimeline(advice);
}

function labPaletteQuery() {
  return `${window.labPaletteMode ? `&palette_mode=${encodeURIComponent(window.labPaletteMode)}` : ""}`
    + `${window.labSecondary ? `&palette_secondary=${encodeURIComponent(window.labSecondary)}` : ""}`
    + `${window.labChromatic ? "&chromatic=true" : ""}`
    + `${window.labOctave ? `&octave=${window.labOctave}` : ""}`;
}

const LAB_REGISTERS = [[-2, "Низкий"], [-1, "Ниже"], [0, "Средний"], [1, "Выше"], [2, "Высокий"]];

async function setLabOctave(value) {
  window.labOctave = Math.max(-3, Math.min(4, Number(value) || 0));
  saveLabOutputState();
  await refreshLabAdvice();
}

/** Every chord property edit goes through the server so the symbol stays derived. */
async function labEdit(op, value = "", index = null, { keepSelection = false } = {}) {
  const target = index === null ? Math.max(0, Number(window.labSelectedChordIndex) || 0) : index;
  const requestId = (window.labAdviceRequestId || 0) + 1;
  window.labAdviceRequestId = requestId;
  labPushHistory();
  // Borrowing a chord also switches the palette, so the neighbours match it.
  if (op === "borrow") window.labPaletteMode = value || null;
  if (op === "secondary") window.labSecondary = value in { V: 1, IV: 1, vii: 1 } ? value : null;
  if (op === "reset") { window.labPaletteMode = null; window.labSecondary = null; }
  try {
    const advice = await api(`/sketches/${currentSketchId}/chord-edit`, { method: "POST", body: JSON.stringify({ index: target, op, value: String(value), palette_mode: window.labPaletteMode, palette_secondary: window.labSecondary, chromatic: !!window.labChromatic, octave: window.labOctave || 0 }) });
    if (requestId !== window.labAdviceRequestId) return;
    if (!keepSelection) window.labSelectedChordIndex = advice.selected_index < 0 ? null : advice.selected_index;
    applyLabAdvice(advice, { syncChordText: true });
  } catch (error) { toast(error.message); }
}

/** Place a chord on the harmony lane at a specific beat (drag-drop from palette). */
async function labInsertChordAt(symbol, beat) {
  const requestId = (window.labAdviceRequestId || 0) + 1;
  window.labAdviceRequestId = requestId;
  labPushHistory();
  try {
    const advice = await api(`/sketches/${currentSketchId}/chord-edit`, {
      method: "POST",
      body: JSON.stringify({ index: 0, op: "insert_at", value: String(symbol), start: Math.max(0, beat), palette_mode: window.labPaletteMode, palette_secondary: window.labSecondary, chromatic: !!window.labChromatic, octave: window.labOctave || 0 }),
    });
    if (requestId !== window.labAdviceRequestId) return;
    window.labSelectedChordIndex = advice.selected_index < 0 ? null : advice.selected_index;
    applyLabAdvice(advice, { syncChordText: true });
  } catch (error) { toast(error.message); }
}

/** Drag a palette chord onto the harmony lane; a plain click previews it and
 *  inserts it, so a single tap both adds the chord and lets you hear it. */
function labChordDragStart(event, symbol, midi = null) {
  if (event.button) return;
  event.preventDefault();
  const startX = event.clientX, startY = event.clientY;
  let dragging = false, ghost = null;
  const laneTrack = point => document.elementFromPoint(point.clientX, point.clientY)?.closest(".lab-lane-row .lab-row-track");
  const onMove = pointer => {
    if (!dragging && (Math.abs(pointer.clientX - startX) > 5 || Math.abs(pointer.clientY - startY) > 5)) {
      dragging = true;
      ghost = document.createElement("div");
      ghost.className = "lab-chord-ghost";
      ghost.textContent = symbol;
      document.body.appendChild(ghost);
    }
    if (!dragging) return;
    ghost.style.left = `${pointer.clientX}px`;
    ghost.style.top = `${pointer.clientY}px`;
    const track = laneTrack(pointer);
    document.querySelectorAll(".lab-lane-row .lab-row-track").forEach(t => t.classList.toggle("is-drop", t === track));
  };
  const onUp = pointer => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.querySelectorAll(".lab-lane-row .lab-row-track").forEach(t => t.classList.remove("is-drop"));
    if (ghost) ghost.remove();
    if (!dragging) {
      if (midi && midi.length) labPlay([midi]);
      return putLabChord(symbol);
    }
    const track = laneTrack(pointer);
    if (track) labInsertChordAt(symbol, labSnap(labTrackBeats(track, pointer.clientX)));
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// ── Undo history and clipboard ──────────────────────────────────────────────
// Snapshots come from the advice already in memory, so recording a step costs
// nothing; undo replays a whole sketch state rather than inverting operations.

const labHistory = [];
const labRedoHistory = [];

function labSnapshot() {
  const advice = window.currentLabAdvice;
  if (!advice) return null;
  return {
    chord_input: advice.chord_input || "",
    chord_beats: (advice.chords || []).map(chord => chord.beats),
    melody: (advice.melody || []).map(({ pitch, start, duration, voice }) => ({ pitch, start, duration, voice })),
  };
}

function labSyncHistoryButtons() {
  const undo = document.getElementById("lab-undo");
  const redo = document.getElementById("lab-redo");
  if (undo) undo.disabled = labHistory.length === 0;
  if (redo) redo.disabled = labRedoHistory.length === 0;
}

function labPushHistory() {
  const snapshot = labSnapshot();
  if (!snapshot) return;
  labHistory.push(snapshot);
  if (labHistory.length > 60) labHistory.shift();
  labRedoHistory.length = 0;
  labSyncHistoryButtons();
}

async function labUndo() {
  const previous = labHistory.pop();
  if (!previous) return toast("Отменять нечего");
  const current = labSnapshot();
  if (current) labRedoHistory.push(current);
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify(previous) });
    await loadLab();
    toast("Отменено");
  } catch (error) {
    if (current) labRedoHistory.pop();
    labHistory.push(previous);
    labSyncHistoryButtons();
    toast(error.message);
  }
}

async function labRedo() {
  const next = labRedoHistory.pop();
  if (!next) return toast("Повторять нечего");
  const current = labSnapshot();
  if (current) labHistory.push(current);
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify(next) });
    await loadLab();
    toast("Повторено");
  } catch (error) {
    if (current) labHistory.pop();
    labRedoHistory.push(next);
    labSyncHistoryButtons();
    toast(error.message);
  }
}

// ── Copy / cut / paste for a selection of notes or chords ───────────────────

function labSelectedNoteIndices() {
  const list = window.labSelectedNotes || [];
  if (list.length) return [...list].sort((a, b) => a - b);
  return window.labSelectedNote != null ? [window.labSelectedNote] : [];
}

function labSelectedChordIndices() {
  const list = window.labSelectedChords || [];
  if (list.length) return [...list].sort((a, b) => a - b);
  return window.labSelectedChordIndex != null ? [window.labSelectedChordIndex] : [];
}

/** Copy the current selection (notes when the note inspector is active, else
 *  chords) into the in-app clipboard, preserving relative timing and lengths. */
function labCopy() {
  const advice = window.currentLabAdvice;
  if (window.labInspector === "note") {
    const notes = labSelectedNoteIndices().map(i => (advice?.melody || [])[i]).filter(Boolean)
      .map(n => ({ pitch: n.pitch, start: n.start, duration: n.duration, voice: n.voice }));
    if (!notes.length) return toast("Ноты не выделены");
    const minStart = Math.min(...notes.map(n => n.start));
    const span = Math.max(0.25, Math.max(...notes.map(n => n.start + n.duration)) - minStart);
    window.labClip = { type: "notes", notes: notes.map(n => ({ ...n, start: +(n.start - minStart).toFixed(3) })), span, origStart: minStart, pasteN: 0 };
    return toast(`Скопировано нот: ${notes.length}`);
  }
  const chords = labSelectedChordIndices().map(i => (advice?.chords || [])[i]).filter(Boolean)
    .map(c => ({ symbol: c.symbol, beats: c.beats }));
  if (!chords.length) return toast("Аккорды не выделены");
  window.labClip = { type: "chords", chords };
  toast(`Скопировано аккордов: ${chords.length}`);
}

async function labCut() {
  labCopy();
  const clip = window.labClip;
  if (!clip) return;
  if (clip.type === "notes") return labDeleteSelectedNotes();
  await labDeleteSelectedChords();
}

async function labPaste() {
  const clip = window.labClip;
  if (!clip) return toast("Буфер пуст");
  if (clip.type === "notes") return labPasteNotes();
  return labPasteChords();
}

/** Paste notes tiled just after the copied block; the pasted notes are left
 *  selected so they can be dragged straight away. Repeat to keep duplicating. */
async function labPasteNotes() {
  const clip = window.labClip; const advice = window.currentLabAdvice;
  if (!clip?.notes?.length) return;
  const base = clip.origStart + clip.span * (clip.pasteN + 1);
  const existing = (advice?.melody || []).map(n => ({ pitch: n.pitch, start: n.start, duration: n.duration, voice: n.voice }));
  const pasted = clip.notes.map(n => ({ pitch: n.pitch, start: +(base + n.start).toFixed(3), duration: n.duration, voice: n.voice || 1 }));
  const key = n => `${n.pitch}:${Number(n.start).toFixed(2)}:${Number(n.duration).toFixed(2)}:${n.voice || 1}`;
  const pastedKeys = new Set(pasted.map(key));
  labPushHistory();
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify({ melody: existing.concat(pasted) }) });
    clip.pasteN += 1;
    await refreshLabAdvice();
    const mel = window.currentLabAdvice?.melody || [];
    window.labSelectedNotes = mel.map((n, i) => [n, i]).filter(([n]) => pastedKeys.has(key(n))).map(([, i]) => i);
    window.labSelectedNote = window.labSelectedNotes.length === 1 ? window.labSelectedNotes[0] : null;
    window.labInspector = "note";
    labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
    labSetRegion("lab-chord-inspector", labInspectorHtml(window.currentLabAdvice));
    toast(`Вставлено нот: ${pasted.length} (выделены)`);
  } catch (error) { toast(error.message); }
}

/** Paste chords keeping each chord's length. With a caret on the harmony lane
 *  they land there and everything after shifts to make room; otherwise appended
 *  at the end. */
async function labPasteChords() {
  const clip = window.labClip; const advice = window.currentLabAdvice;
  if (!clip?.chords?.length) return;
  const chords = advice?.chords || [];
  const span = clip.chords.reduce((sum, c) => sum + c.beats, 0);
  const caret = window.labChordCaret;
  let combined;
  if (caret != null) {
    combined = chords.map(c => ({ symbol: c.symbol, beats: c.beats, start: c.start >= caret - 1e-6 ? c.start + span : c.start }));
    let cursor = caret;
    for (const c of clip.chords) { combined.push({ symbol: c.symbol, beats: c.beats, start: cursor }); cursor += c.beats; }
    combined.sort((a, b) => a.start - b.start);
    window.labChordCaret = +(caret + span).toFixed(3);
  } else {
    let cursor = chords.length ? Math.max(...chords.map(c => c.start + c.beats)) : 0;
    combined = chords.map(c => ({ symbol: c.symbol, beats: c.beats, start: c.start }));
    for (const c of clip.chords) { combined.push({ symbol: c.symbol, beats: c.beats, start: cursor }); cursor += c.beats; }
  }
  labPushHistory();
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify({ chord_input: combined.map(c => c.symbol).join(" "), chord_beats: combined.map(c => c.beats), chord_starts: combined.map(c => c.start) }) });
    await refreshLabAdvice();
    toast(`Вставлено аккордов: ${clip.chords.length}${caret != null ? " в позицию метки" : " в конец"}`);
  } catch (error) { toast(error.message); }
}

/** Delete the whole selected chord range (rebuilds the aligned arrays). */
async function labDeleteSelectedChords() {
  const advice = window.currentLabAdvice;
  const drop = new Set(labSelectedChordIndices());
  if (!drop.size) return;
  const kept = (advice?.chords || []).filter((_, i) => !drop.has(i));
  labPushHistory();
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify({ chord_input: kept.map(c => c.symbol).join(" "), chord_beats: kept.map(c => c.beats), chord_starts: kept.map(c => c.start) }) });
    window.labSelectedChords = []; window.labSelectedChordIndex = null;
    await refreshLabAdvice();
  } catch (error) { toast(error.message); }
}

function labSelectAll() {
  const advice = window.currentLabAdvice;
  if (window.labInspector === "note") {
    window.labSelectedNotes = (advice?.melody || []).map((n, i) => [n, i]).filter(([n]) => (n.voice || 1) === (window.labActiveVoice || 1)).map(([, i]) => i);
    labSetRegion("lab-score", labScoreHtml(advice));
    return toast(`Выделено нот: ${window.labSelectedNotes.length}`);
  }
  window.labSelectedChords = (advice?.chords || []).map((_, i) => i);
  window.labInspector = "chord";
  labSetRegion("lab-score", labScoreHtml(advice));
  toast(`Выделено аккордов: ${window.labSelectedChords.length}`);
}

async function refreshLabAdvice() {
  const requestId = (window.labAdviceRequestId || 0) + 1;
  window.labAdviceRequestId = requestId;
  const selected = Math.max(0, Number(window.labSelectedChordIndex) || 0);
  const advice = await api(`/sketches/${currentSketchId}/advice?selected_index=${selected}${labPaletteQuery()}`);
  if (requestId !== window.labAdviceRequestId) return window.currentLabAdvice;
  applyLabAdvice(advice);
  return advice;
}

async function patchLabContext(payload) {
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify(payload) });
    await refreshLabAdvice();
  } catch (error) { toast(error.message); }
}

function labSaveState(text) {
  const badge = document.getElementById("lab-save-state");
  if (badge) badge.textContent = text;
}

/** Title, melody and notes autosave, so they behave like the chords already do. */
function queueLabFieldSave() {
  labSaveState("…");
  clearTimeout(window.labFieldSaveTimer);
  window.labFieldSaveTimer = setTimeout(saveLabFields, 600);
}

async function saveLabFields() {
  const melody = document.getElementById("lab-melody");
  const notes = document.getElementById("lab-notes");
  if (!melody || !notes) return;
  try {
    await api(`/sketches/${currentSketchId}`, {
      method: "PATCH",
      body: JSON.stringify({ melody: melodyTextToNotes(melody.value), notes: notes.value }),
    });
    labSaveState("сохранено");
  } catch (error) { labSaveState("не сохранено"); toast(error.message); }
}

function labChordTokens() {
  return String(document.getElementById("lab-chords")?.value || "").trim().split(/\s*(?:→|—|–|\||,|;)\s*|\s+/).filter(Boolean);
}

async function persistLabChordText() {
  const input = document.getElementById("lab-chords");
  if (!input) return;
  input.value = labChordTokens().join(" ");
  window.labSelectedChordIndex = labClampSelection(labChordTokens().length);
  try {
    await api(`/sketches/${currentSketchId}`, { method: "PATCH", body: JSON.stringify({ chord_input: input.value }) });
    await refreshLabAdvice();
  } catch (error) { toast(error.message); }
}

async function appendLabChord(symbol) {
  await putLabChord(symbol);
}

/** Shift-click extends a contiguous chord range from the anchor selection. */
function labExtendChordSelection(index) {
  const anchor = window.labSelectedChordIndex == null ? index : window.labSelectedChordIndex;
  const lo = Math.min(anchor, index), hi = Math.max(anchor, index);
  window.labSelectedChords = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  window.labInspector = "chord";
  labSetRegion("lab-score", labScoreHtml(window.currentLabAdvice));
  labSetRegion("lab-chord-inspector", labInspectorHtml(window.currentLabAdvice));
}

/** Selection is local first: only the suggestion palette needs the server. */
async function selectLabChord(index) {
  const wasNote = window.labInspector === "note";
  window.labInspector = "chord";
  setLabContextMode("chord");
  window.labSelectedChords = [index]; // a plain click resets any multi-selection
  if (index === window.labSelectedChordIndex) {
    if (wasNote) labSetRegion("lab-chord-inspector", labInspectorHtml(window.currentLabAdvice));
    return;
  }
  window.labSelectedChordIndex = index;
  const advice = window.currentLabAdvice;
  labSetRegion("lab-score", labScoreHtml(advice));
  labSetRegion("lab-chord-inspector", labInspectorHtml(advice));
  labRenderContextBar();
  const requestId = (window.labAdviceRequestId || 0) + 1;
  window.labAdviceRequestId = requestId;
  try {
    const fresh = await api(`/sketches/${currentSketchId}/advice?selected_index=${index}${labPaletteQuery()}`);
    if (requestId !== window.labAdviceRequestId || window.labSelectedChordIndex !== index) return;
    window.currentLabAdvice = fresh;
    labSetRegion("lab-insert-body", labInsertBodyHtml(fresh));
    labSetRegion("lab-score", labScoreHtml(fresh));
    labRenderContextBar();
  } catch (error) { toast(error.message); }
}

function labPlay(midis, button = null) {
  // Click-auditions preview through the built-in Web Audio synth (works in the
  // browser and inside the WebView2 plug-in). Only suppressed while the DAW is
  // actually rolling, so a preview never fights the host's own playback.
  if (window.labDawTransport?.playing) return;
  ptmAudio.stopAll();
  if (button) button.classList.add("is-playing");
  const bpm = Number(document.getElementById("lab-bpm")?.value) || 120;
  ptmAudio.playChords(midis, { beatSec: Math.max(.45, Math.min(1.4, 120 / bpm)), onStep: index => { if (index < 0 && button) button.classList.remove("is-playing"); } });
}

/** Send an immutable score snapshot to the audio processor. The processor owns
 * DAW-synchronised playback, so replacing this snapshot never stops transport. */
function syncNativePlaybackTimeline(advice = window.currentLabAdvice) {
  if (typeof window.harmonyCanvasSetPlaybackTimeline !== "function" || !advice) return;
  const loop = labActiveLoop();
  const scoreEnd = Math.max(
    1,
    ...(advice.chords || []).map(chord => Number(chord.start) + Number(chord.beats)),
    ...(advice.melody || []).map(note => Number(note.start) + Number(note.duration)),
  );
  const rangeFrom = loop ? Number(loop.from) : 0;
  const rangeTo = loop ? Number(loop.to) : scoreEnd;
  const length = Math.max(.25, rangeTo - rangeFrom);
  const wrap = beat => ((beat % length) + length) % length;
  const clip = (start, duration) => {
    const from = Math.max(Number(start), rangeFrom);
    const to = Math.min(Number(start) + Number(duration), rangeTo);
    return to > from ? { start: wrap(from), duration: to - from } : null;
  };
  // Chords → MIDI channel 1, voice N → channel N+1. Muted parts are left out;
  // per-part volume scales the note velocity the processor renders.
  const mutes = labVoiceMutes();
  const vol = labPartVolume();
  const vel = (base, gain) => Math.max(1, Math.min(127, Math.round(base * (gain == null ? 1 : gain))));
  const events = [];
  if (!window.labChordsMuted) for (const chord of advice.chords || []) {
    const timing = clip(chord.start, Number(chord.beats) * .98);
    if (!timing) continue;
    for (const note of chord.midi || []) events.push({ note, ...timing, velocity: vel(64, vol.chords), channel: 1 });
  }
  for (const note of advice.melody || []) {
    const voice = note.voice || 1;
    if (mutes[voice]) continue;
    const timing = clip(note.start, Number(note.duration) * .95);
    if (timing) events.push({ note: note.pitch, ...timing, velocity: vel(100, vol["v" + voice]), channel: Math.min(16, voice + 1) });
  }
  window.harmonyCanvasSetPlaybackTimeline({ length, events });
}

function syncLabDawPlayback(state = {}) {
  if (!document.getElementById("lab-score") || !window.currentLabAdvice) return;
  const isPlaying = !!state.playing;
  const advice = window.currentLabAdvice;
  const loop = labActiveLoop();
  const scoreEnd = Math.max(1,
    ...(advice.chords || []).map(chord => chord.start + chord.beats),
    ...(advice.melody || []).map(note => note.start + note.duration));
  const rangeFrom = loop ? loop.from : 0;
  const rangeLength = loop ? Math.max(.25, loop.to - loop.from) : scoreEnd;
  const beat = rangeFrom + ((((Number(state.ppq) || 0) - rangeFrom) % rangeLength) + rangeLength) % rangeLength;
  const span = labScoreSpan(advice);
  const active = Math.floor(beat / span);
  document.querySelectorAll(".lab-system").forEach((system, index) => {
    const head = system.querySelector(".lab-playhead");
    if (!head) return;
    head.hidden = !isPlaying || index !== active;
    if (isPlaying && index === active) head.style.setProperty("--pos", beat - index * span);
  });
  document.querySelectorAll(".lab-tool-play").forEach(button => button.classList.toggle("is-playing", isPlaying));
  window.labDawWasPlaying = isPlaying;
}

/** Play harmony and melody together on the score's own timeline. */
function labPlayScore(button, options = {}) {
  // Inside the plug-in the app makes no sound itself: Play/Stop drive the host
  // transport (the DAW renders the timeline). Only a genuine DAW-driven call
  // (options.daw) falls through to move the on-screen playhead.
  if (typeof window.harmonyCanvasSetPlaybackTimeline === "function" && !options.daw) {
    window.labAppPlaying = !window.labAppPlaying;
    if (typeof window.harmonyCanvasTransport === "function") window.harmonyCanvasTransport(window.labAppPlaying);
    // Ableton denies VST3 plug-ins transport control, so the native call above
    // is a no-op there. Also post to the sidecar: the ableton-js transport-sync
    // bridge reads it and starts/stops Live's transport for us.
    labPostTransport(window.labAppPlaying);
    document.querySelectorAll(".lab-tool-play").forEach(b => b.classList.toggle("is-playing", window.labAppPlaying));
    return;
  }
  // "Звук из Ableton" mode: Play/Stop drive Ableton's transport via the M4L
  // player; the app makes no sound of its own.
  if (window.labOutputToDaw && !options.daw) {
    labSetAppTransport(!window.labAppPlaying);
    return;
  }
  if (window.labDawTransport?.playing && !options.daw) return toast("Playback следует за Ableton Live");
  if (ptmAudio.isPlaying()) {
    if (options.daw) return;
    return labStopScore();
  }
  const advice = window.currentLabAdvice;
  if (!advice?.chords?.length && !advice?.melody?.length) return toast("Сначала введите аккорды или ноты");
  const beatSec = 60 / (Number(document.getElementById("lab-bpm")?.value) || 120);
  const loop = labActiveLoop();
  const scoreEnd = Math.max(
    1,
    ...(advice.chords || []).map(chord => chord.start + chord.beats),
    ...(advice.melody || []).map(note => note.start + note.duration),
  );
  const rangeFrom = loop ? loop.from : 0;
  const rangeLength = loop ? Math.max(.25, loop.to - loop.from) : scoreEnd;
  const requestedBeat = Number(options.startBeat) || rangeFrom;
  const normalizedStartBeat = rangeFrom + (((requestedBeat - rangeFrom) % rangeLength) + rangeLength) % rangeLength;
  const within = item => !loop || (item.at >= loop.from && item.at < loop.to);
  const mutes = labVoiceMutes();
  const events = [
    ...(window.labChordsMuted ? [] : (advice.chords || []).map(chord => ({ midis: chord.midi, at: chord.start, dur: chord.beats * 0.98, vol: 0.16 }))),
    ...(advice.melody || []).filter(note => !mutes[note.voice || 1]).map(note => ({ midis: [note.pitch], at: note.start, dur: note.duration * 0.95, vol: 0.3 })),
  ].filter(within).map(item => ({ ...item, at: (item.at - (loop ? loop.from : 0)) * beatSec, dur: item.dur * beatSec }));
  if (!events.length) return toast("В выбранном лупе нечего играть");
  const systems = [...document.querySelectorAll(".lab-system")];
  const span = labScoreSpan(advice);
  if (button) button.classList.add("is-playing");
  ptmAudio.playTimeline(events, {
    loop: !!loop || !!options.daw,
    span: rangeLength * beatSec,
    startAt: (normalizedStartBeat - rangeFrom) * beatSec,
    onTick: elapsed => {
      // Only the system holding the current beat shows a cursor.
      const beat = elapsed / beatSec + (loop ? loop.from : 0);
      const active = Math.floor(beat / span);
      systems.forEach((system, index) => {
        const head = system.querySelector(".lab-playhead");
        if (!head) return;
        head.hidden = index !== active;
        if (index === active) head.style.setProperty("--pos", beat - index * span);
      });
    },
    onEnd: () => labStopScore(button),
  });
}

function labStopScore(button = null) {
  if (typeof window.harmonyCanvasTransport === "function") {
    window.labAppPlaying = false;
    window.harmonyCanvasTransport(false);
    labPostTransport(false);   // ableton-js bridge stops Live's transport
  }
  ptmAudio.stopAll();
  document.querySelectorAll(".lab-playhead").forEach(head => { head.hidden = true; head.style.setProperty("--pos", 0); });
  document.querySelectorAll(".lab-tool-play.is-playing").forEach(item => item.classList.remove("is-playing"));
  if (button) button.classList.remove("is-playing");
}

/** Post the editor's Play/Stop to the sidecar; an M4L player drives Ableton. */
async function labPostTransport(playing) {
  try { await api("/transport", { method: "POST", body: JSON.stringify({ playing: !!playing }) }); }
  catch (error) { toast(error.message); }
}

function labSetAppTransport(playing) {
  window.labAppPlaying = !!playing;
  document.querySelectorAll(".lab-tool-play").forEach(b => b.classList.toggle("is-playing", !!playing));
  if (!playing) document.querySelectorAll(".lab-playhead").forEach(head => { head.hidden = true; });
  labPostTransport(!!playing);
}

// ── Full-screen editor window ───────────────────────────────────────────────

function labFocusMode() {
  return new URLSearchParams(location.search).get("focus") === "lab";
}

function openLabFocus() {
  const instance = labInstanceId ? `&instance=${encodeURIComponent(labInstanceId)}` : "";
  const url = `${location.pathname}?focus=lab&sketch=${encodeURIComponent(currentSketchId)}${instance}`;
  const opened = window.open(url, `lab-${currentSketchId}`, "width=1700,height=1050");
  if (!opened) return toast("Браузер заблокировал новое окно — разрешите всплывающие окна для этого сайта");
  // A window reused by name keeps whatever page it already had, which after a
  // release is the previous build. Replacing the location forces a fresh load.
  try { opened.location.replace(url); } catch (error) { /* окно ещё не наше — оно и так загрузится */ }
  opened.focus();
}

function applyLabFocusMode() {
  if (!labFocusMode()) return false;
  document.body.classList.add("lab-focus");
  const sketch = new URLSearchParams(location.search).get("sketch");
  if (sketch) currentSketchId = sketch;
  loadLab();
  return true;
}

async function deleteLabSketch() {
  if (!confirm("Удалить этот эскиз и прикреплённые к нему MIDI?")) return;
  try {
    await api(`/sketches/${currentSketchId}`, { method: "DELETE" });
    currentSketchId = null;
    if (labFocusMode()) return window.close();
    await loadLab();
  } catch (error) { toast(error.message); }
}


if (!applyLabFocusMode()) loadLab();
