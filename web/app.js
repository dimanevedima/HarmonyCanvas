function buildTuneBatSearchUrl(artist, title) {
  const query = [artist, title].filter(Boolean).join(" ").trim();
  return "https://tunebat.com/Search?q=" + encodeURIComponent(query);
}

function spotifyTrackId(url = "") {
  const match = String(url).match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  return match ? match[1] : "";
}

function buildSpotiSaverTrackUrl(url = "") {
  const id = spotifyTrackId(url);
  return id ? `https://spotisaver.net/en/track/${id}/` : "";
}

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

// Parse duration string: "1:30" → 90, "90.5" → 90.5
function parseDurationInput(str) {
  str = String(str).trim();
  const mm = str.match(/^(\d+):(\d{1,2})$/);
  if (mm) return parseInt(mm[1], 10) * 60 + parseFloat(mm[2]);
  return parseFloat(str) || 0;
}

const ABLETON_LS_KEY = "ableton_form_state";
const WS_VOLUME_LS_KEY = "rc_wave_volume";
function saveAbletonFormState(form) {
  const state = {
    structure: form.querySelector("[name=structure]").value,
    target_bpm: form.querySelector("[name=target_bpm]").value,
    target_duration: form.querySelector("[name=target_duration]").value,
    keep_bpm: form.querySelector("[name=keep_bpm]").checked,
    keep_duration: form.querySelector("[name=keep_duration]").checked,
    include_audio: form.querySelector("[name=include_audio]").checked,
  };
  localStorage.setItem(ABLETON_LS_KEY, JSON.stringify(state));
}
function restoreAbletonFormState(form) {
  try {
    const state = JSON.parse(localStorage.getItem(ABLETON_LS_KEY) || "{}");
    if (state.structure) form.querySelector("[name=structure]").value = state.structure;
    if (state.target_bpm) form.querySelector("[name=target_bpm]").value = state.target_bpm;
    if (state.target_duration) form.querySelector("[name=target_duration]").value = state.target_duration;
    if (state.keep_bpm != null) form.querySelector("[name=keep_bpm]").checked = state.keep_bpm;
    if (state.keep_duration != null) form.querySelector("[name=keep_duration]").checked = state.keep_duration;
    // include_audio is always off by default, only restore if explicitly saved as true
    if (state.include_audio) form.querySelector("[name=include_audio]").checked = true;
  } catch (_) {}
}
const SYSTEM_TAGS = new Set(["spotify", "track", "album", "generated", "candidate"]);
const visibleTags = (items = []) => (items || []).filter(tag => {
  const value = String(tag || "").trim();
  if (!value) return false;
  if (SYSTEM_TAGS.has(value.toLowerCase())) return false;
  if (value.toLowerCase().startsWith("album:")) return false;
  return true;
});
const tags = (items = []) => {
  const shown = visibleTags(items);
  return shown.length ? `<div class="tags">${shown.map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : "";
};
const statusName = { to_listen: "to listen", listened: "listened", selected: "selected", applied: "applied" };
let currentDemoId = null;
let currentDemoCache = null;
let lastOpenDemoReferenceTrackId = "";
let compareZoom = 0.75;
const compareBaseWidth = 1500;
let compareZoomFrame = 0;

function demoDurationLabel(demo) {
  const seconds = Number(demo.audio_analysis?.duration_sec || demo.audio_duration_sec || 0);
  if (seconds > 0) return formatSeconds(seconds);
  return demo.target_duration || "no audio";
}

function audioPathEditorHtml({ id, name = "audio_path", value = "", placeholder = "C:\\Users\\...\\track.mp3", label = "Локальный audio path" }) {
  const hasValue = !!value;
  const filename = value ? String(value).split(/[\\/]/).filter(Boolean).pop() : "";
  return `<details class="audio-path-details" ${hasValue ? "" : "open"}>
    <summary><span>${esc(label)}</span>${hasValue ? `<strong>${esc(filename)}</strong>` : `<em>путь не прикреплён</em>`}</summary>
    <label class="audio-path-label"><input id="${id}" name="${name}" value="${esc(value || "")}" placeholder="${esc(placeholder)}"></label>
  </details>`;
}

function hashString(value = "") {
  let hash = 0;
  for (let i = 0; i < String(value).length; i++) hash = ((hash << 5) - hash + String(value).charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function demoVisual(demo) {
  const palettes = [
    ["#d7ff43", "#6f55e8", "#171816"],
    ["#22c55e", "#2196f3", "#111827"],
    ["#ff8a00", "#f85d9a", "#20231f"],
    ["#60a5fa", "#c084fc", "#171816"],
    ["#f4d35e", "#2bd48f", "#22223b"],
    ["#ef476f", "#ffd166", "#073b4c"],
  ];
  const palette = palettes[hashString(demo.id || demo.demo_name) % palettes.length];
  const angle = 120 + (hashString(demo.demo_name || "") % 70);
  const initials = String(demo.demo_name || "RC").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  return {
    style: `background:
      radial-gradient(circle at 18% 20%, ${palette[0]}88, transparent 28%),
      radial-gradient(circle at 82% 18%, ${palette[1]}77, transparent 24%),
      linear-gradient(${angle}deg, ${palette[2]}, ${palette[1]} 58%, ${palette[0]});`,
    initials,
  };
}

function normalizeWorkItem(item, fallbackStatus = "open") {
  if (item && typeof item === "object") {
    return { text: String(item.text || ""), status: item.status || fallbackStatus };
  }
  return { text: String(item || ""), status: fallbackStatus };
}

function serializeWorkItems(items = []) {
  return items.map(item => {
    const normalized = normalizeWorkItem(item);
    return { text: normalized.text.trim(), status: normalized.status || "open" };
  }).filter(item => item.text);
}

function demoPlanSections(demo) {
  const saved = demo.arrangement_sections || [];
  if (saved.length) return saved.map(section => ({
    time: section.time || formatSeconds(section.start_sec || 0),
    name: section.name || section.label || "Section",
    goal: section.goal || section.notes || "",
    notes: section.notes || "",
    source: "manual",
  }));
  return demoAnalysisPlanSections(demo);
}

function demoAnalysisPlanSections(demo) {
  const analysis = demo.audio_analysis || {};
  const sections = analysis.song_sections?.length ? analysis.song_sections : (analysis.sections || []);
  return sections.map(section => ({
    time: formatSeconds(section.start_sec || 0),
    name: section.label || "Section",
    goal: `${formatSeconds(section.start_sec || 0)} – ${formatSeconds(section.end_sec || 0)}`,
    notes: section.energy != null ? `energy ${Number(section.energy).toFixed(2)}` : "",
    source: "audio",
  }));
}

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

// ── Reveal audio file in Explorer (drag-out from the browser into native apps
// like Ableton proved unreliable across browsers/OS drop targets, so instead
// we just open the file's folder with it selected — genuinely reliable, and
// the user can drag it from there into anything). ──────────────────────────
async function revealAudioInFolder(kind, id, button) {
  const path = kind === "reference" ? `/references/${id}/reveal-audio`
    : kind === "demo" ? `/demos/${id}/reveal-audio`
    : `/stems/${id}/reveal`;
  if (button) button.disabled = true;
  try {
    await api(path, { method: "POST" });
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

// ── Stems (multi-file / zip stem attachments for references and demos) ──────

function stemsSectionHtml(ownerType, ownerId) {
  const containerId = `stems-${ownerType}-${ownerId}`;
  return `<details class="compare-curves-panel stems-panel" data-owner-type="${esc(ownerType)}" data-owner-id="${esc(ownerId)}">
    <summary>Стемы</summary>
    <div class="stems-toolbar">
      <label class="ghost stems-attach-btn">
        + Прикрепить стемы
        <input type="file" multiple accept="audio/*,.mp3,.wav,.aiff,.aif,.flac,.zip" class="hidden-file-input" onchange="uploadStems('${esc(ownerType)}','${esc(ownerId)}', this)">
      </label>
    </div>
    <div id="${containerId}" class="stems-list"><p class="field-hint">Раскройте, чтобы загрузить стемы…</p></div>
  </details>`;
}

function initStemsPanels(root) {
  (root || document).querySelectorAll(".stems-panel").forEach(panel => {
    if (panel.dataset.stemsBound) return;
    panel.dataset.stemsBound = "1";
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      loadStemsInto(panel.dataset.ownerType, panel.dataset.ownerId);
    });
  });
}

async function loadStemsInto(ownerType, ownerId) {
  const container = document.getElementById(`stems-${ownerType}-${ownerId}`);
  if (!container) return;
  container.innerHTML = `<p class="field-hint">Загрузка…</p>`;
  try {
    const path = ownerType === "demo" ? `/demos/${ownerId}/stems` : `/references/${ownerId}/stems`;
    const stems = await api(path);
    renderStemsList(container, ownerType, ownerId, stems);
  } catch (error) {
    container.innerHTML = `<p class="field-hint">Ошибка загрузки: ${esc(error.message)}</p>`;
  }
}

window._stemGroups = window._stemGroups || {};
window._stemState = window._stemState || {};

function renderStemsList(container, ownerType, ownerId, stems) {
  if (!stems.length) { container.innerHTML = `<p class="field-hint">Стемы ещё не прикреплены.</p>`; return; }
  const groupKey = `${ownerType}-${ownerId}`;
  const masterVolume = getSavedWaveVolume();
  window._stemGroups[groupKey] = { stemIds: stems.map(s => s.id), masterVolume };
  stems.forEach(s => { window._stemState[s.id] = { muted: false, solo: false, group: groupKey }; });
  const masterBar = `<div class="stems-master-bar">
    <button type="button" class="stem-master-play" id="stems-master-play-${esc(groupKey)}" title="Играть все стемы синхронно" onclick="stemsMasterToggle('${esc(groupKey)}')">${ICONS.play}</button>
    <label class="ws-volume" title="Общая громкость">
      <span>Vol</span>
      <input type="range" min="0" max="1" step="0.01" value="${masterVolume}" oninput="stemsMasterVolume('${esc(groupKey)}', this.value)">
    </label>
  </div>`;
  container.innerHTML = masterBar + stems.map(s => stemRowHtml(ownerType, ownerId, s)).join("");
  initStemDrag(container);
  initStemPlayers(stems, groupKey);
}

function stemRowHtml(ownerType, ownerId, stem) {
  return `<div class="stem-row" draggable="true" data-stem-id="${esc(stem.id)}">
    <span class="stem-handle" title="Перетащить для сортировки">${ICONS.handle}</span>
    <button type="button" class="stem-mute" id="stem-mute-${esc(stem.id)}" title="Mute" onclick="stemToggleMute('${esc(stem.id)}',this)">${ICONS.speaker}</button>
    <button type="button" class="stem-solo" id="stem-solo-${esc(stem.id)}" title="Solo" onclick="stemToggleSolo('${esc(stem.id)}')">S</button>
    <button type="button" class="stem-play-btn" id="stem-play-${esc(stem.id)}" onclick="stemTogglePlay('${esc(stem.id)}')">&#9654;</button>
    <div class="stem-wave-wrap">
      <div class="stem-name" title="${esc(stem.filename)}">${esc(stem.filename)}</div>
      <div id="stem-ws-${esc(stem.id)}" class="stem-ws"></div>
    </div>
    <button type="button" class="icon-mini" title="Открыть папку с файлом" onclick="revealAudioInFolder('stem','${esc(stem.id)}', this)">${ICONS.folder}</button>
    <button type="button" class="icon-mini danger" title="Удалить стем" onclick="deleteStem('${esc(ownerType)}','${esc(ownerId)}','${esc(stem.id)}',this)">${ICONS.trash}</button>
  </div>`;
}

function initStemPlayers(stems, groupKey) {
  if (!window.WaveSurfer) return;
  window._stemPlayers = window._stemPlayers || {};
  stems.forEach(stem => {
    const container = document.getElementById(`stem-ws-${stem.id}`);
    if (!container) return;
    if (window._stemPlayers[stem.id]) { try { window._stemPlayers[stem.id].destroy(); } catch (_) {} }
    const ws = WaveSurfer.create({
      container,
      url: `/api/stems/${stem.id}/audio-file`,
      waveColor: "#b7aef0",
      progressColor: "#6f55e8",
      height: 32,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      interact: true,
    });
    ws.on("play", () => { const b = document.getElementById(`stem-play-${stem.id}`); if (b) b.innerHTML = "&#9646;&thinsp;&#9646;"; updateStemsMasterButton(groupKey); });
    ws.on("pause", () => { const b = document.getElementById(`stem-play-${stem.id}`); if (b) b.innerHTML = "&#9654;"; updateStemsMasterButton(groupKey); });
    ws.on("finish", () => { const b = document.getElementById(`stem-play-${stem.id}`); if (b) b.innerHTML = "&#9654;"; updateStemsMasterButton(groupKey); });
    // Seeking one stem keeps the rest of the group aligned to the same position.
    ws.on("interaction", () => {
      const time = ws.getCurrentTime();
      (window._stemGroups[groupKey]?.stemIds || []).forEach(id => {
        if (id === stem.id) return;
        const other = window._stemPlayers[id];
        if (other) other.seekTo(Math.min(1, time / (other.getDuration() || 1)));
      });
    });
    window._stemPlayers[stem.id] = ws;
  });
  applyStemVolumes(groupKey);
}

function stemTogglePlay(stemId) { window._stemPlayers?.[stemId]?.playPause(); }

// ── Stem group transport: shared play/pause, master volume, mute/solo ───────

function computeStemVolume(stemId) {
  const state = window._stemState[stemId];
  if (!state) return getSavedWaveVolume();
  const group = window._stemGroups[state.group];
  const groupStemIds = group?.stemIds || [];
  const anySolo = groupStemIds.some(id => window._stemState[id]?.solo);
  const audible = anySolo ? state.solo : !state.muted;
  const master = group?.masterVolume ?? getSavedWaveVolume();
  return audible ? master : 0;
}

function applyStemVolumes(groupKey) {
  const group = window._stemGroups[groupKey];
  if (!group) return;
  group.stemIds.forEach(id => {
    const ws = window._stemPlayers?.[id];
    if (ws) ws.setVolume(computeStemVolume(id));
  });
}

function stemToggleMute(stemId, btn) {
  const state = window._stemState[stemId];
  if (!state) return;
  state.muted = !state.muted;
  btn.classList.toggle("active", state.muted);
  applyStemVolumes(state.group);
}

function stemToggleSolo(stemId) {
  const state = window._stemState[stemId];
  if (!state) return;
  state.solo = !state.solo;
  const btn = document.getElementById(`stem-solo-${stemId}`);
  if (btn) btn.classList.toggle("active", state.solo);
  applyStemVolumes(state.group);
}

function stemsMasterVolume(groupKey, value) {
  const group = window._stemGroups[groupKey];
  if (!group) return;
  group.masterVolume = Math.max(0, Math.min(1, Number(value) || 0));
  applyStemVolumes(groupKey);
}

function stemsMasterToggle(groupKey) {
  const group = window._stemGroups[groupKey];
  if (!group) return;
  const players = group.stemIds.map(id => window._stemPlayers?.[id]).filter(Boolean);
  if (!players.length) return;
  const anyPlaying = players.some(p => p.isPlaying());
  if (anyPlaying) {
    players.forEach(p => p.pause());
  } else {
    const leaderTime = Math.max(0, ...players.map(p => p.getCurrentTime() || 0));
    players.forEach(p => p.seekTo(Math.min(1, leaderTime / (p.getDuration() || 1))));
    players.forEach(p => p.play());
  }
}

function updateStemsMasterButton(groupKey) {
  const group = window._stemGroups[groupKey];
  const btn = document.getElementById(`stems-master-play-${groupKey}`);
  if (!group || !btn) return;
  const anyPlaying = group.stemIds.some(id => window._stemPlayers?.[id]?.isPlaying());
  btn.innerHTML = anyPlaying ? ICONS.pause : ICONS.play;
}

function initStemDrag(container) {
  let dragEl = null;
  container.querySelectorAll(".stem-row").forEach(row => {
    row.addEventListener("dragstart", event => {
      dragEl = row;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.stemId);
      row.classList.add("dragging-row");
    });
    row.addEventListener("dragend", () => { row.classList.remove("dragging-row"); dragEl = null; });
    row.addEventListener("dragover", event => {
      if (!dragEl || dragEl === row) return;
      event.preventDefault();
      const rect = row.getBoundingClientRect();
      const before = (event.clientY - rect.top) < rect.height / 2;
      container.insertBefore(dragEl, before ? row : row.nextSibling);
    });
    row.addEventListener("drop", async event => {
      event.preventDefault();
      if (!dragEl) return;
      const order = [...container.querySelectorAll(".stem-row")].map(r => r.dataset.stemId);
      try {
        await api("/stems/reorder", { method: "POST", body: JSON.stringify({ order }) });
      } catch (error) { toast(error.message); }
    });
  });
}

async function uploadStems(ownerType, ownerId, inputEl) {
  const files = inputEl.files;
  if (!files || !files.length) return;
  const formData = new FormData();
  for (const file of files) formData.append("file", file);
  const path = ownerType === "demo" ? `/demos/${ownerId}/stems` : `/references/${ownerId}/stems`;
  try {
    await apiUpload(path, formData);
    toast("Стемы прикреплены");
    loadStemsInto(ownerType, ownerId);
  } catch (error) {
    toast(error.message);
  } finally {
    inputEl.value = "";
  }
}

async function deleteStem(ownerType, ownerId, stemId, button) {
  if (!confirm("Удалить этот стем?")) return;
  button.disabled = true;
  try {
    await api(`/stems/${stemId}`, { method: "DELETE" });
    try { window._stemPlayers?.[stemId]?.destroy(); } catch (_) {}
    delete window._stemPlayers?.[stemId];
    delete window._stemState?.[stemId];
    const groupKey = `${ownerType}-${ownerId}`;
    const group = window._stemGroups?.[groupKey];
    if (group) group.stemIds = group.stemIds.filter(id => id !== stemId);
    button.closest(".stem-row")?.remove();
    const container = document.getElementById(`stems-${ownerType}-${ownerId}`);
    if (container && !container.querySelector(".stem-row")) {
      container.innerHTML = `<p class="field-hint">Стемы ещё не прикреплены.</p>`;
    }
  } catch (error) {
    button.disabled = false;
    toast(error.message);
  }
}

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

// ── MuScriptor (Kyutai) — audio → notation transcription in the browser ─────
// The MuScriptor web app accepts audio only via drag-and-drop (no URL params
// or API), so the button opens it in a new tab and reveals the audio file in
// Explorer so it can be dragged straight onto the page. The tab goes through
// /api/muscriptor/go, so the target stays configurable (.env: MUSCRIPTOR_URL)
// — e.g. a locally hosted model (`uvx muscriptor serve`) later.

function openInMuscriptor(kind, id) {
  window.open("/api/muscriptor/go", "_blank", "noopener");
  if (kind && id) {
    revealAudioInFolder(kind, id);
    toast("MuScriptor открыт — перетащите файл из Проводника на страницу");
  }
}

function muscriptorButton(kind, id, compact = false) {
  const args = kind && id ? `'${esc(kind)}','${esc(id)}'` : "";
  const title = "Открыть MuScriptor (транскрипция в ноты) — файл откроется в Проводнике, перетащите его на страницу";
  return compact
    ? `<button type="button" class="icon-mini muscriptor-btn" title="${title}" onclick="openInMuscriptor(${args})">${ICONS.pianoRoll}</button>`
    : `<button type="button" class="ghost muscriptor-btn" title="${title}" onclick="openInMuscriptor(${args})">${ICONS.pianoRoll} MuScriptor</button>`;
}

// ── Optional local-only SongMaster Pro integration ──────────────────────────
// Never runs on its own — only when the user clicks. Opens the track in the
// desktop app; once the user analyzes + saves it there, the chords/structure
// panel below can read the result back, and stems (if SongMaster separated
// them) can be attached to our own Stems panel with one click.

async function openInSongmaster(trackId) {
  try {
    await api(`/references/${trackId}/songmaster/open`, { method: "POST" });
    toast("Открываю в SongMaster Pro…");
  } catch (error) {
    toast(error.message);
  }
}

async function openInSongmasterDemo(demoId) {
  try {
    await api(`/demos/${demoId}/songmaster/open`, { method: "POST" });
    toast("Открываю в SongMaster Pro…");
  } catch (error) {
    toast(error.message);
  }
}

function songmasterSectionHtml(ownerType, ownerId) {
  const containerId = `songmaster-${ownerType}-${ownerId}`;
  return `<details class="compare-curves-panel songmaster-panel" data-owner-type="${esc(ownerType)}" data-owner-id="${esc(ownerId)}">
    <summary>${ICONS.note} Аккорды и структура (SongMaster)</summary>
    <div id="${containerId}" class="songmaster-body"><p class="field-hint">Раскройте, чтобы проверить…</p></div>
  </details>${ptmSectionHtml(ownerType, ownerId)}`;
}

function songmasterQuickActions(ownerType, ownerId, compact = false) {
  const openFn = ownerType === "demo" ? `openInSongmasterDemo('${esc(ownerId)}')` : `openInSongmaster('${esc(ownerId)}')`;
  return `<div class="songmaster-quick-actions ${compact ? "compact" : ""}">
    <button class="ghost songmaster-btn" title="Open local audio in SongMaster Pro" onclick="${openFn}">${ICONS.note} SongMaster</button>
    ${muscriptorButton(ownerType === "demo" ? "demo" : "reference", ownerId)}
    <span class="field-hint">Open in SongMaster, run analysis, save the song, then expand the panel below.</span>
  </div>`;
}

function songmasterDuration(data) {
  const sectionMax = Math.max(0, ...(data.sections || []).map(s => Number(s.end_sec) || 0));
  const chordMax = Math.max(0, ...(data.chords || []).map(c => Number(c.end_sec) || 0));
  return Number(data.audio_length_sec || sectionMax || chordMax || 0);
}

function songmasterNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits).replace(/\.0$/, "") : "";
}

function songmasterMetaCards(data) {
  const cards = [
    data.key ? ["Key", data.key] : null,
    data.estimated_bpm ? ["BPM", songmasterNumber(data.estimated_bpm, 1)] : null,
    data.time_signature ? ["Time", data.time_signature] : null,
    data.estimated_tuning_hz ? ["Tuning", `${songmasterNumber(data.estimated_tuning_hz, 1)} Hz`] : null,
    data.estimated_cents_off ? ["Cents", songmasterNumber(data.estimated_cents_off, 2)] : null,
  ].filter(Boolean);
  return `<div class="songmaster-metrics">${cards.map(([label, value]) => `<span><strong>${esc(value)}</strong>${esc(label)}</span>`).join("")}</div>`;
}

function songmasterTheoryNote(row, key) {
  if (!row.roman) return "Roman analysis unavailable";
  const distinct = [...new Set(row.roman.split(/\s+/).filter(Boolean))];
  if (distinct.includes("V") || distinct.includes("V7")) return `В ${key || "key"} слышен dominant pull: ${row.roman}`;
  if (distinct.some(x => x.includes("bVII") || x.includes("bVI"))) return `Modal / borrowed-color motion: ${row.roman}`;
  return `Functional map in ${key || "key"}: ${row.roman}`;
}

function songmasterProgressionRows(data) {
  const rows = (data.section_progressions || []).filter(row => row.m2tm);
  if (!rows.length) return `<p class="field-hint">SongMaster нашел аккорды, но не удалось собрать секционные прогрессии.</p>`;
  return `<div class="songmaster-progression-list">${rows.map((row, index) => `
    <article class="songmaster-progression-card">
      <label class="songmaster-progress-head">
        <input type="checkbox" value="${esc(row.m2tm_timed || row.m2tm)}" data-songmaster-progression>
        <span><strong>${esc(row.label || `Section ${index + 1}`)}</strong><small>${formatSeconds(row.start_sec)} – ${formatSeconds(row.end_sec)} · ${row.chord_count} chords</small></span>
      </label>
      <div class="m2tm-lines">
        <label>Plain<code>${esc(row.m2tm)}</code></label>
        ${row.m2tm_timed ? `<label>Timed<code>${esc(row.m2tm_timed)}</code></label>` : ""}
      </div>
      ${row.roman ? `<p class="roman-line">${esc(row.roman)}</p>` : ""}
      <p class="field-hint">${esc(songmasterTheoryNote(row, data.key))}</p>
      <div class="songmaster-card-actions">
        <button class="text-btn" onclick="copyM2TMProgression('${esc(row.m2tm)}')">Copy plain</button>
        ${row.m2tm_timed ? `<button class="text-btn" onclick="copyM2TMProgression('${esc(row.m2tm_timed)}')">Copy timed</button>` : ""}
      </div>
    </article>`).join("")}</div>`;
}

function songmasterCandidateRows(data) {
  const rows = data.progression_candidates || [];
  if (!rows.length) return "";
  return `<div class="songmaster-candidates">
    <h4>Повторяющиеся обороты</h4>
    ${rows.map(row => `<label class="songmaster-candidate">
      <input type="checkbox" value="${esc(row.m2tm)}" data-songmaster-progression>
      <span><strong>${esc(row.m2tm)}</strong><small>${esc(row.roman || "")}${row.count ? ` · ${row.count}×` : ""}</small></span>
    </label>`).join("")}
  </div>`;
}

async function copyM2TMProgression(value) {
  const text = String(value || "").replace(/[→,\(\)]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast("M2TM progression copied");
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast("M2TM progression copied");
  }
}

function copySelectedM2TM(button) {
  const root = button.closest(".songmaster-body");
  const selected = [...root.querySelectorAll("[data-songmaster-progression]:checked")].map(input => input.value);
  if (!selected.length) {
    toast("Выберите одну или несколько прогрессий");
    return;
  }
  copyM2TMProgression(selected.join(" "));
}

function initSongmasterPanels(root) {
  (root || document).querySelectorAll(".songmaster-panel").forEach(panel => {
    if (panel.dataset.bound) return;
    panel.dataset.bound = "1";
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      loadSongmasterData(panel.dataset.ownerType, panel.dataset.ownerId);
    });
  });
  initPtmPanels(root);
}

async function loadSongmasterData(ownerType, ownerId) {
  const container = document.getElementById(`songmaster-${ownerType}-${ownerId}`);
  if (!container) return;
  container.innerHTML = `<p class="field-hint">Ищу проект SongMaster…</p>`;
  try {
    const path = ownerType === "demo" ? `/demos/${ownerId}/songmaster/data` : `/references/${ownerId}/songmaster/data`;
    const data = await api(path);
    renderSongmasterData(container, ownerType, ownerId, data);
  } catch (error) {
    container.innerHTML = `<p class="field-hint">Ошибка: ${esc(error.message)}</p>`;
  }
}

function renderSongmasterData(container, ownerType, ownerId, data) {
  if (!data.found) {
    container.innerHTML = `<p class="field-hint">В SongMaster пока нет проекта для этого файла. Откройте трек кнопкой выше, дождитесь анализа и сохраните проект (File → Save Song) — данные появятся здесь.</p>`;
    return;
  }
  const duration = songmasterDuration(data);
  const structure = (data.sections || []).length
    ? renderSectionMap(data.sections, duration, { zoom: 1, minWidth: 1100, large: true, ruler: true, sceneLabels: true })
    : "";
  const stemsNote = data.stems?.length
    ? `<button class="ghost" onclick="importSongmasterStems('${esc(ownerType)}','${esc(ownerId)}', this)">Прикрепить ${data.stems.length} стем${data.stems.length === 1 ? "" : "а"} из SongMaster</button>`
    : `<p class="field-hint">Стемы в SongMaster для этого трека не найдены (Stems → Separate Stems, затем сохраните).</p>`;
  container.innerHTML = `
    <div class="songmaster-meta">
      <strong>${esc(data.song_name || "")}</strong>
      ${data.artist ? `<span class="songmaster-key">${esc(data.artist)}</span>` : ""}
    </div>
    ${songmasterMetaCards(data)}
    ${structure ? `<h4>Structure</h4>${structure}` : ""}
    <div class="songmaster-copy-row">
      <button class="ghost" onclick="copySelectedM2TM(this)">Copy selected for M2TM</button>
      <span class="field-hint">Формат: одна строка. Timed добавляет :q/:h/:w/:e и dotted/triplet по ближайшей длительности.</span>
    </div>
    ${songmasterCandidateRows(data)}
    <h4>Прогрессии по секциям</h4>
    ${songmasterProgressionRows(data)}
    <div class="songmaster-actions">${stemsNote}</div>
  `;
}

async function importSongmasterStems(ownerType, ownerId, button) {
  button.disabled = true;
  const prev = button.textContent;
  button.textContent = "Прикрепляю…";
  try {
    const path = ownerType === "demo" ? `/demos/${ownerId}/songmaster/import-stems` : `/references/${ownerId}/songmaster/import-stems`;
    await api(path, { method: "POST" });
    toast("Стемы прикреплены");
    loadStemsInto(ownerType, ownerId);
    const stemsPanel = document.querySelector(`.stems-panel[data-owner-id="${CSS.escape(ownerId)}"]`);
    if (stemsPanel) stemsPanel.open = true;
    button.textContent = "Готово";
  } catch (error) {
    toast(error.message);
    button.disabled = false;
    button.textContent = prev;
  }
}

function renderWorkList(demo, field, title, emptyText, addPlaceholder) {
  const items = serializeWorkItems(demo[field] || []);
  const rows = items.map((item, index) => {
    const done = item.status === "done";
    const rejected = item.status === "rejected";
    return `<li class="work-item ${done ? "done" : ""} ${rejected ? "rejected" : ""}" data-field="${esc(field)}" data-index="${index}">
      <button class="work-check" title="Готово" aria-pressed="${done ? "true" : "false"}" onclick="toggleDemoWorkItem(this,'${demo.id}','${field}',${index})">${done ? ICONS.check : ""}</button>
      <input value="${esc(item.text)}" onchange="editDemoWorkItem('${demo.id}','${field}',${index},this.value)" aria-label="${esc(title)} item">
      <button class="icon-mini reject ${rejected ? "active" : ""}" title="Не подходит / отложить" aria-pressed="${rejected ? "true" : "false"}" onclick="rejectDemoWorkItem(this,'${demo.id}','${field}',${index})">${ICONS.skip}</button>
      <button class="icon-mini danger" title="Удалить" onclick="deleteDemoWorkItem('${demo.id}','${field}',${index})">${ICONS.trash}</button>
    </li>`;
  }).join("");
  return `<section class="panel work-panel">
    <div class="section-head compact"><h2>${esc(title)}</h2><span class="muted">${items.length}</span></div>
    <ul class="work-list">${rows || `<li class="empty-inline">${esc(emptyText)}</li>`}</ul>
    <form class="inline-add" onsubmit="addDemoWorkItem(event,'${demo.id}','${field}')">
      <input name="text" placeholder="${esc(addPlaceholder)}">
      <button class="ghost">Add</button>
    </form>
  </section>`;
}

function renderDemoPlan(demo) {
  const saved = demo.arrangement_sections || [];
  const sections = demoPlanSections(demo);
  const hasAnalysisPlan = !!((demo.audio_analysis?.song_sections || demo.audio_analysis?.sections || []).length);
  const displayRows = sections.map(section => `<div class="timeline-row">
        <strong>${esc(section.time)}</strong>
        <span>${esc(section.name)}</span>
        <span>${esc(section.goal)}${section.notes ? `<br><small>${esc(section.notes)}</small>` : ""}</span>
      </div>`).join("");
  const editRows = saved.map((section, index) => `<div class="plan-edit-row">
        <input value="${esc(section.time || "")}" onchange="editDemoPlanCell('${demo.id}',${index},'time',this.value)" aria-label="time">
        <input value="${esc(section.name || "")}" onchange="editDemoPlanCell('${demo.id}',${index},'name',this.value)" aria-label="section">
        <input value="${esc(section.goal || "")}" onchange="editDemoPlanCell('${demo.id}',${index},'goal',this.value)" aria-label="goal">
        <button class="icon-mini danger" title="Удалить строку" onclick="deleteDemoPlanRow('${demo.id}',${index})">${ICONS.trash}</button>
      </div>`).join("");
  const canSave = !saved.length && sections.length;
  return `<section class="panel work-panel plan-panel">
    <div class="section-head compact">
      <div><h2>План формы</h2>${canSave ? `<p class="field-hint">Собран из анализа аудио. Можно сохранить как ручной план.</p>` : ""}</div>
      <div class="compact-actions">
        ${hasAnalysisPlan ? `<button class="text-btn" onclick="replaceDemoPlanFromAnalysis('${demo.id}')">Из анализа</button>` : ""}
        ${canSave ? `<button class="text-btn" onclick="saveDemoPlanFromAnalysis('${demo.id}')">Сохранить план</button>` : ""}
      </div>
    </div>
    <div class="timeline compact-timeline">${displayRows || empty("Прикрепите аудио и запустите анализ, чтобы собрать план")}</div>
    <details class="plan-edit-details">
      <summary>Редактировать план</summary>
      <div class="plan-edit-list">${editRows || `<div class="empty-inline">Сначала сохраните план или замените из анализа</div>`}</div>
      ${saved.length ? `<form class="inline-add plan-add" onsubmit="addDemoPlanRow(event,'${demo.id}')"><input name="time" placeholder="1:24"><input name="name" placeholder="DROP"><input name="goal" placeholder="Что происходит"><button class="ghost">Add</button></form>` : ""}
    </details>
  </section>`;
}

function renderDemoReferences(demo) {
  const spotifyRefs = (demo.references || []).filter(r => r.track.source === "spotify");
  const rows = spotifyRefs.map(r => `<div class="demo-ref-row">
    ${r.track.cover_url ? `<img src="${esc(r.track.cover_url)}" alt="">` : `<span class="compare-cover-fallback"></span>`}
    <span class="category">${esc(r.purpose)}</span>
    <p><strong>${esc(r.track.artist)}</strong><br>${esc(r.track.title)}</p>
    <div class="demo-ref-row-actions">
      <button class="icon-mini" title="Открыть референс" onclick="openDemoReference('${demo.id}','${r.track.id}')">${ICONS.open}</button>
      <button class="icon-mini danger" title="Убрать из демо" onclick="removeReferenceFromDemo('${demo.id}','${r.track.id}','overview')">${ICONS.trash}</button>
    </div>
  </div>`).join("");
  return `<section class="panel work-panel demo-ref-panel">
    <div class="section-head compact"><h2>Spotify референсы</h2><button class="text-btn" onclick="showAddToDemo('${demo.id}')">+ Добавить</button></div>
    <div id="demo-references">${rows || empty("Spotify-референсы пока не привязаны")}</div>
    <div id="add-to-demo"></div>
  </section>`;
}

function demoReferenceMarkers(demo) {
  const tag = `demo:${demo.id}`;
  return (demo.references || []).flatMap(link =>
    (link.track.markers || [])
      .filter(marker => (marker.tags || []).includes(tag))
      .map(marker => ({ ...marker, track: link.track, purpose: link.purpose }))
  ).sort((a, b) => (a.track.title || "").localeCompare(b.track.title || "") || a.time_sec - b.time_sec);
}

function renderDemoReferenceNotes(demo) {
  const markers = demoReferenceMarkers(demo);
  const rows = markers.map(marker => `<div class="demo-ref-note">
    <div class="demo-ref-note-controls">
      <button class="ws-play-btn tiny" onclick="playDemoRefSnippet('${marker.track.id}',${marker.time_sec || 0})">&#9654;</button>
      <button class="ws-stop-btn tiny" title="Stop" onclick="stopDemoRefSnippet()">${ICONS.stop}</button>
    </div>
    <div><strong>${esc(marker.track.title)}</strong><small>${esc(marker.time_label)} · ${esc(marker.section_type || "NOTE")}</small></div>
    <p>${esc(marker.title || marker.notes || "Заметка")}</p>
    <div class="demo-ref-row-actions">
      <button class="icon-mini" title="Открыть референс" onclick="openDemoReference('${demo.id}','${marker.track.id}')">${ICONS.open}</button>
      <button class="icon-mini danger" title="Удалить пометку" onclick="deleteDemoReferenceNote('${demo.id}','${marker.id}','overview')">${ICONS.trash}</button>
    </div>
  </div>`).join("");
  return `<section class="panel work-panel demo-ref-notes">
    <div class="section-head compact"><h2>Пометки из рефов</h2><span class="muted">${markers.length}</span></div>
    ${rows || empty("Пока нет пометок на таймкодах. Откройте вкладку Референсы и добавьте заметку к генерации.")}
  </section>`;
}

function openDemoReference(demoId, trackId) {
  lastOpenDemoReferenceTrackId = trackId;
  demoRefDetailTrackId = trackId;
  openDemoDetail(demoId, "references");
}

function demoTrackMarkers(demoId, track = {}) {
  const demoTag = `demo:${demoId}`;
  return (track.markers || [])
    .filter(marker => (marker.tags || []).includes(demoTag))
    .sort((a, b) => (Number(a.time_sec) || 0) - (Number(b.time_sec) || 0));
}

function demoMarkerSummary(markers = []) {
  if (!markers.length) return "0 пометок";
  const times = markers.slice(0, 3).map(marker => marker.time_label || formatSeconds(marker.time_sec)).join(", ");
  return `${markers.length} пометок · ${times}${markers.length > 3 ? "…" : ""}`;
}

function renderDemoWaveMarkers(markers = [], duration = 0, trackId = "") {
  if (!markers.length || !duration) return "";
  return `<div class="demo-wave-markers" aria-label="Demo reference notes">${markers.map(marker => {
    const sec = Number(marker.time_sec) || 0;
    const left = Math.max(0, Math.min(100, (sec / duration) * 100));
    const label = marker.title || marker.notes || "Пометка";
    const time = marker.time_label || formatSeconds(sec);
    return `<button type="button" class="demo-wave-marker" style="left:${left}%" title="${esc(`${time} · ${label}`)}" data-marker-id="${esc(marker.id)}" data-time-sec="${sec}" onclick="demoWaveMarkerClick(this,'${trackId}')"><span>${esc(time)}</span></button>`;
  }).join("")}</div>`;
}

function demoWaveMarkerClick(pin, trackId) {
  playCompareSection(trackId, Number(pin.dataset.timeSec) || 0);
}

function renderDemoTrackMarkerList(demoId, markers = []) {
  if (!markers.length) return "";
  return `<div class="demo-track-marker-list">${markers.map(marker => `<div class="demo-track-marker-row">
    <strong>${esc(marker.time_label || formatSeconds(marker.time_sec))}</strong>
    <span>${esc(marker.title || marker.notes || "Заметка")}</span>
    <button class="icon-mini danger" title="Удалить пометку" onclick="deleteDemoReferenceNote('${demoId}','${marker.id}','references')">${ICONS.trash}</button>
  </div>`).join("")}</div>`;
}

let demoRefDetailTrackId = "";

function refNoteSectionLabel(track, timeSec) {
  const analysis = track.audio_analysis || {};
  const sections = analysis.song_sections?.length ? analysis.song_sections : (analysis.sections || []);
  const hit = sections.find(s => timeSec >= (Number(s.start_sec) || 0) && timeSec < (Number(s.end_sec) || 0));
  return hit ? String(hit.label || "") : "";
}

function refTileVisual(track) {
  if (track.cover_url) return `<img src="${esc(track.cover_url)}" alt="" loading="lazy">`;
  const palettes = [
    ["#d7ff43", "#6f55e8"], ["#22c55e", "#2196f3"], ["#ff8a00", "#f85d9a"],
    ["#60a5fa", "#c084fc"], ["#f4d35e", "#2bd48f"], ["#ef476f", "#ffd166"],
  ];
  const p = palettes[hashString(track.id || track.title || "x") % palettes.length];
  const angle = 120 + (hashString(track.title || "") % 70);
  return `<div class="ref-tile-gradient" style="background:linear-gradient(${angle}deg, ${p[0]}, ${p[1]})"><span>${esc((track.source || "RC").toUpperCase())}</span></div>`;
}

function notesPopoverHtml(markers) {
  const sorted = [...markers].sort((a, b) => (a.time_sec || 0) - (b.time_sec || 0));
  const shown = sorted.slice(0, 5);
  const items = shown.map(m => {
    const text = m.title || m.notes || "Заметка";
    const short = text.length > 56 ? `${text.slice(0, 56)}…` : text;
    return `<li><strong>${esc(m.time_label || formatSeconds(m.time_sec))}</strong><span>${esc(short)}</span></li>`;
  }).join("");
  const more = sorted.length > shown.length ? `<li class="ref-notes-pop-more">+${sorted.length - shown.length} ещё</li>` : "";
  return `<ul>${items}${more}</ul>`;
}

window._refTileNotesMap = window._refTileNotesMap || {};

function initRefTileNotesPopovers(root) {
  root.querySelectorAll(".ref-tile-notes").forEach(badge => {
    if (badge.dataset.popBound) return;
    badge.dataset.popBound = "1";
    let popEl = null;
    const show = () => {
      const markers = window._refTileNotesMap[badge.dataset.trackId];
      if (!markers || !markers.length) return;
      popEl = document.createElement("div");
      popEl.className = "ref-tile-notes-pop";
      popEl.innerHTML = notesPopoverHtml(markers);
      document.body.appendChild(popEl);
      const rect = badge.getBoundingClientRect();
      const popRect = popEl.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.right - popRect.width, window.innerWidth - popRect.width - 8));
      let top = rect.top - popRect.height - 8;
      if (top < 8) top = rect.bottom + 8;
      popEl.style.left = `${left}px`;
      popEl.style.top = `${top}px`;
    };
    const hide = () => { popEl?.remove(); popEl = null; };
    badge.addEventListener("mouseenter", show);
    badge.addEventListener("mouseleave", hide);
    badge.addEventListener("focus", show);
    badge.addEventListener("blur", hide);
  });
}

// ── Grid hover-to-play preview: one shared <audio>, Suno-style bottom bar ───
// The dial on each tile plays the FULL track (not a short clip) and never
// navigates — clicking anywhere else on the tile still opens the detail page.

window._gridPreviewTracks = window._gridPreviewTracks || [];
window._gridPreviewIndex = window._gridPreviewIndex ?? -1;
window._gridPreviewPlaying = window._gridPreviewPlaying || false;

function gridPreviewEnsureAudio() {
  if (!window._gridPreviewAudio) {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = getSavedWaveVolume();
    audio.addEventListener("timeupdate", gridPreviewOnTimeUpdate);
    audio.addEventListener("ended", gridPreviewNext);
    window._gridPreviewAudio = audio;
  }
  return window._gridPreviewAudio;
}

function gridPreviewTrackIndex(trackId) {
  return window._gridPreviewTracks.findIndex(t => t.trackId === trackId);
}

function gridPreviewToggle(trackId) {
  const idx = gridPreviewTrackIndex(trackId);
  if (idx === -1) return;
  if (window._gridPreviewIndex === idx) {
    window._gridPreviewPlaying ? gridPreviewPause() : gridPreviewResume();
  } else {
    gridPreviewPlay(idx);
  }
}

function gridPreviewPlay(idx, offsetSec = 0) {
  const track = window._gridPreviewTracks[idx];
  if (!track) return;
  const audio = gridPreviewEnsureAudio();
  const prevIdx = window._gridPreviewIndex;
  const absoluteUrl = new URL(track.url, window.location.origin).href;
  if (audio.src !== absoluteUrl) audio.src = track.url;
  window._gridPreviewIndex = idx;
  audio.currentTime = offsetSec;
  audio.play().catch(() => toast("Не удалось запустить превью"));
  window._gridPreviewPlaying = true;
  if (prevIdx !== idx) gridPreviewSetRing(prevIdx, 0);
  gridPreviewUpdateTileState();
  gridPreviewOpenBar(track);
}

function gridPreviewPause() {
  window._gridPreviewAudio?.pause();
  window._gridPreviewPlaying = false;
  gridPreviewUpdateTileState();
}

function gridPreviewResume() {
  if (window._gridPreviewIndex < 0) return;
  window._gridPreviewAudio?.play().catch(() => {});
  window._gridPreviewPlaying = true;
  gridPreviewUpdateTileState();
}

function gridPreviewNext() {
  if (!window._gridPreviewTracks.length) return;
  gridPreviewPlay((window._gridPreviewIndex + 1) % window._gridPreviewTracks.length, 0);
}

function gridPreviewPrev() {
  if (!window._gridPreviewTracks.length) return;
  gridPreviewPlay((window._gridPreviewIndex - 1 + window._gridPreviewTracks.length) % window._gridPreviewTracks.length, 0);
}

function gridPreviewClose() {
  window._gridPreviewAudio?.pause();
  const idx = window._gridPreviewIndex;
  window._gridPreviewPlaying = false;
  window._gridPreviewIndex = -1;
  gridPreviewSetRing(idx, 0);
  document.getElementById("grid-player-bar")?.classList.remove("visible");
  gridPreviewUpdateTileState();
}

function gridPreviewSeekTo(seconds) {
  if (window._gridPreviewIndex < 0 || !window._gridPreviewAudio) return;
  const track = window._gridPreviewTracks[window._gridPreviewIndex];
  const duration = window._gridPreviewAudio.duration || track?.duration || 0;
  const t = Math.max(0, Math.min(duration, seconds));
  window._gridPreviewAudio.currentTime = t;
  gridPreviewSetRing(window._gridPreviewIndex, duration ? t / duration : 0);
  gridPreviewUpdateScrubUI(duration ? t / duration : 0, t);
}

function gridPreviewSetRing(idx, progress) {
  if (idx < 0) return;
  const track = window._gridPreviewTracks[idx];
  if (!track) return;
  const ring = document.querySelector(`.dial[data-track-id="${CSS.escape(track.trackId)}"] [data-role="ring"]`);
  if (ring) ring.style.strokeDashoffset = String(2 * Math.PI * 27 * (1 - progress));
}

function gridPreviewUpdateTileState() {
  document.querySelectorAll(".ref-tile").forEach(tile => {
    const dial = tile.querySelector(".dial");
    const idx = dial ? gridPreviewTrackIndex(dial.dataset.trackId) : -1;
    tile.classList.toggle("playing", idx !== -1 && idx === window._gridPreviewIndex && window._gridPreviewPlaying);
  });
  document.getElementById("grid-player-bar")?.classList.toggle("gp-playing", window._gridPreviewPlaying);
}

function gridPreviewOnTimeUpdate() {
  const audio = window._gridPreviewAudio;
  if (!audio || window._gridPreviewIndex < 0) return;
  const track = window._gridPreviewTracks[window._gridPreviewIndex];
  const duration = audio.duration || track?.duration || 0;
  const progress = duration ? audio.currentTime / duration : 0;
  gridPreviewSetRing(window._gridPreviewIndex, progress);
  gridPreviewUpdateScrubUI(progress, audio.currentTime);
}

function gridPreviewUpdateScrubUI(progress, elapsed) {
  const fill = document.getElementById("gp-scrub-fill");
  const knob = document.getElementById("gp-scrub-knob");
  const now = document.getElementById("gp-time-now");
  if (fill) fill.style.width = `${progress * 100}%`;
  if (knob) knob.style.left = `${progress * 100}%`;
  if (now) now.textContent = formatSeconds(elapsed);
}

function gridPreviewOpenBar(track) {
  document.getElementById("gp-title").textContent = track.title;
  document.getElementById("gp-artist").textContent = track.artist;
  document.getElementById("gp-cover").innerHTML = track.coverHtml || "";
  document.getElementById("gp-time-total").textContent = formatSeconds(track.duration || window._gridPreviewAudio?.duration || 0);
  document.getElementById("grid-player-bar")?.classList.add("visible");
}

function gridPreviewAngleToProgress(clientX, clientY, rect) {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const angle = Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI;
  let deg = angle + 90;
  if (deg < 0) deg += 360;
  return deg / 360;
}

function initGridPreviewPlayer(root) {
  const grid = root.querySelector(".ref-tile-grid");
  if (!grid || grid.dataset.previewBound) return;
  grid.dataset.previewBound = "1";

  // Note: the dial's own inline onclick (not delegation) handles play/pause —
  // it must call stopPropagation() on itself, since by the time a delegated
  // listener up here on the grid would run, bubbling has already passed
  // through .ref-tile's own onclick="openDemoRefDetail(...)" further down.
  let justDragged = false;
  // A click always follows pointerdown+pointerup on the same element, even
  // after a drag — swallow that one synthetic click so seeking doesn't also
  // toggle play/pause.
  grid.addEventListener("click", event => {
    if (justDragged && event.target.closest("[data-role='dial']")) {
      event.stopPropagation();
      justDragged = false;
    }
  }, true);

  grid.addEventListener("pointerdown", event => {
    const dial = event.target.closest("[data-role='dial']");
    if (!dial) return;
    const trackId = dial.dataset.trackId;
    const idx = gridPreviewTrackIndex(trackId);
    if (idx !== window._gridPreviewIndex) return; // only scrub the active tile's ring
    event.preventDefault();
    event.stopPropagation();
    const rect = dial.getBoundingClientRect();
    const track = window._gridPreviewTracks[idx];
    const duration = window._gridPreviewAudio?.duration || track?.duration || 0;
    let moved = false;
    const onMove = ev => { moved = true; gridPreviewSeekTo(gridPreviewAngleToProgress(ev.clientX, ev.clientY, rect) * duration); };
    const onUp = () => {
      if (moved) justDragged = true;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

function initGridPlayerBar() {
  const bar = document.getElementById("grid-player-bar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";
  document.getElementById("gp-play-pause").addEventListener("click", () => window._gridPreviewPlaying ? gridPreviewPause() : gridPreviewResume());
  document.getElementById("gp-next").addEventListener("click", gridPreviewNext);
  document.getElementById("gp-prev").addEventListener("click", gridPreviewPrev);
  document.getElementById("gp-close").addEventListener("click", gridPreviewClose);
  document.getElementById("gp-vol").addEventListener("input", event => {
    const v = Math.max(0, Math.min(1, Number(event.target.value) || 0));
    localStorage.setItem(WS_VOLUME_LS_KEY, String(v));
    if (window._gridPreviewAudio) window._gridPreviewAudio.volume = v;
  });
  const track = document.getElementById("gp-scrub-track");
  const seekFromEvent = event => {
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const duration = window._gridPreviewAudio?.duration || window._gridPreviewTracks[window._gridPreviewIndex]?.duration || 0;
    gridPreviewSeekTo(pct * duration);
  };
  track.addEventListener("pointerdown", event => {
    seekFromEvent(event);
    const onMove = ev => seekFromEvent(ev);
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

function renderDemoReferenceWorkspace(demo) {
  const link = demoRefDetailTrackId ? (demo.references || []).find(l => l.track.id === demoRefDetailTrackId) : null;
  if (link) return renderDemoRefDetail(demo, link);
  demoRefDetailTrackId = "";
  return renderDemoRefGrid(demo);
}

function renderDemoRefGrid(demo) {
  const refs = [...(demo.references || [])].sort((a, b) => {
    if (!!a.hidden !== !!b.hidden) return a.hidden ? 1 : -1;
    if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
    return `${a.track.artist} ${a.track.title}`.localeCompare(`${b.track.artist} ${b.track.title}`);
  });
  window._gridPreviewTracks = [];
  const tiles = refs.map(link => {
    const track = link.track;
    const isLocal = track.source !== "spotify";
    const markers = demoTrackMarkers(demo.id, track);
    if (markers.length) window._refTileNotesMap[track.id] = markers;
    const duration = Number(track.audio_analysis?.duration_sec || track.audio_duration_sec || (track.duration_ms || 0) / 1000 || 0);
    const analyzed = track.audio_status === "analyzed";
    const canPreview = !!track.audio_path;
    const stemsCount = Number(track.stems_count || 0);
    if (canPreview) {
      window._gridPreviewTracks.push({
        trackId: track.id, title: track.title || "Без названия", artist: track.artist || "",
        url: `/api/references/${track.id}/audio-file`, duration, coverHtml: refTileVisual(track),
      });
    }
    const secondaryAction = isLocal
      ? `<button class="ref-tile-hide" title="${link.hidden ? "Показать" : "Скрыть (можно вернуть)"}" onclick="event.stopPropagation(); toggleDemoRefFlag('${demo.id}','${track.id}','hidden',${!link.hidden})">${link.hidden ? ICONS.eyeOff : ICONS.eye}</button>`
      : `<button class="ref-tile-remove" title="Отвязать от демо" aria-label="Отвязать от демо" onclick="event.stopPropagation(); removeReferenceFromDemo('${demo.id}','${track.id}','references')">${ICONS.trash}</button>`;
    return `<article class="ref-tile ${link.hidden ? "ref-tile-hidden" : ""}" tabindex="0" role="button" aria-label="${esc(`${track.artist} — ${track.title}`)}"
      onclick="openDemoRefDetail('${demo.id}','${track.id}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDemoRefDetail('${demo.id}','${track.id}')}">
      <div class="ref-tile-cover">
        ${refTileVisual(track)}
        <span class="ref-tile-source">${esc(track.source || "local")}</span>
        <div class="ref-tile-top-actions">
          <button class="ref-tile-fav ${link.favorite ? "active" : ""}" title="${link.favorite ? "Убрать из избранного" : "В избранное"}" onclick="event.stopPropagation(); toggleDemoRefFlag('${demo.id}','${track.id}','favorite',${!link.favorite})">${ICONS.heart}</button>
          ${secondaryAction}
        </div>
        ${stemsCount ? `<span class="ref-tile-stems" title="${stemsCount} стем${stemsCount === 1 ? "" : "ов"}">${ICONS.stems}${stemsCount}<small>stems</small></span>` : ""}
        ${markers.length ? `<span class="ref-tile-notes" tabindex="0" data-track-id="${esc(track.id)}" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()">${markers.length} <small>notes</small></span>` : ""}
        ${canPreview ? `<div class="ref-tile-preview">
          <div class="dial" data-role="dial" data-track-id="${esc(track.id)}" tabindex="0" role="button" aria-label="Play preview"
            onclick="event.stopPropagation(); gridPreviewToggle('${esc(track.id)}')"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();gridPreviewToggle('${esc(track.id)}')}">
            <svg class="ring" viewBox="0 0 62 62">
              <circle class="ring-track" cx="31" cy="31" r="27"></circle>
              <circle class="ring-progress" data-role="ring" cx="31" cy="31" r="27" stroke-dasharray="${2*Math.PI*27}" stroke-dashoffset="${2*Math.PI*27}"></circle>
            </svg>
            <div class="center-btn"><span class="icon-play">${ICONS.play}</span><span class="icon-pause">${ICONS.pause}</span></div>
          </div>
        </div>` : ""}
      </div>
      <div class="ref-tile-body">
        <strong>${esc(track.title || "Без названия")}</strong>
        <small>${esc(track.artist || "")}</small>
        <div class="ref-tile-meta">
          <span>${duration ? formatSeconds(duration) : "—"}</span>
          <span class="ref-tile-status ${analyzed ? "ok" : ""}" title="${analyzed ? "Анализ готов" : "Нет анализа"}"></span>
        </div>
      </div>
    </article>`;
  }).join("");
  return `<section class="panel ref-grid-head">
    <div class="section-head compact">
      <div><p class="eyebrow">REFERENCES</p><h2>Референсы демо <span class="muted">${refs.length}</span></h2></div>
      <div class="compact-actions">
        <button class="ghost" onclick="showAddToDemo('${demo.id}')">Привязать из библиотеки</button>
        <button class="primary" onclick="openAddReference()">+ Upload Suno / Local</button>
      </div>
    </div>
    <div id="add-to-demo"></div>
  </section>
  <div class="ref-tile-grid">${tiles || ""}</div>
  ${tiles ? "" : empty("Привяжите или загрузите референсы к демо")}`;
}

function renderRefNoteRow(demoId, trackId, marker) {
  const sec = Number(marker.time_sec) || 0;
  const typeLabel = marker.section_type && marker.section_type !== "NOTE" ? marker.section_type : "";
  return `<div class="ref-note-row" data-marker-id="${esc(marker.id)}" data-time-sec="${sec}">
    <button class="ref-note-time" title="Слушать с этого места" onclick="playCompareSection('${trackId}', ${sec})">${esc(marker.time_label || formatSeconds(sec))}</button>
    ${typeLabel ? `<span class="ref-note-type">${esc(typeLabel)}</span>` : ""}
    <input class="ref-note-text-input" value="${esc(marker.title || marker.notes || "")}" placeholder="Заметка" onchange="editRefNoteText('${esc(marker.id)}', this.value, this)">
    <button class="icon-mini danger sm" title="Удалить" onclick="quickDeleteRefNote('${demoId}','${esc(marker.id)}',this)">${ICONS.trash}</button>
  </div>`;
}

async function editRefNoteText(markerId, value, inputEl) {
  const text = value.trim() || "Заметка";
  if (inputEl) inputEl.value = text;
  try {
    await api(`/markers/${markerId}`, { method: "PATCH", body: JSON.stringify({ title: text }) });
    toast("Заметка обновлена");
  } catch (error) {
    toast(error.message);
    inputEl?.focus();
  }
}

async function editReferenceField(trackId, field, value, inputEl) {
  try {
    await api(`/references/${trackId}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
    toast("Сохранено");
    (currentDemoCache?.references || []).forEach(link => {
      if (link.track.id === trackId) link.track[field] = value;
    });
  } catch (error) {
    toast(error.message);
    inputEl?.focus();
  }
}

function renderDemoRefDetail(demo, link) {
  const track = link.track;
  const isLocal = track.source !== "spotify";
  const analysis = track.audio_analysis || {};
  const duration = Number(analysis.duration_sec || track.audio_duration_sec || 0);
  const markers = demoTrackMarkers(demo.id, track);
  const song = analysis.song_sections?.length ? renderSectionMap(analysis.song_sections, duration, { zoom: 1, minWidth: 980, large: true, trackId: track.id, ruler: true, sceneLabels: true }) : "";
  const energy = analysis.sections?.length ? renderSectionMap(analysis.sections, duration, { zoom: 1, minWidth: 980, large: true, trackId: track.id, ruler: true, sceneLabels: true }) : "";
  const notesRows = [...markers].sort((a, b) => (a.time_sec || 0) - (b.time_sec || 0)).map(m => renderRefNoteRow(demo.id, track.id, m)).join("");
  const secondaryAction = isLocal
    ? `<button class="icon-mini" title="${link.hidden ? "Показать" : "Скрыть (можно вернуть)"}" onclick="toggleDemoRefFlag('${demo.id}','${track.id}','hidden',${!link.hidden})">${link.hidden ? ICONS.eyeOff : ICONS.eye}</button>`
    : `<button class="icon-mini danger" title="Отвязать от демо" onclick="removeReferenceFromDemo('${demo.id}','${track.id}')">${ICONS.trash}</button>`;
  return `<div class="ref-detail" data-track-id="${esc(track.id)}">
    <div class="ref-detail-top">
      <button class="ghost" onclick="closeDemoRefDetail('${demo.id}')">← Референсы</button>
      <div class="compact-actions">
        ${analysis.sections?.length ? `<button class="ghost ableton-btn ableton-btn-sm" onclick="openAbletonPushDialog('${track.id}')">&#9654; Ableton</button>` : ""}
        ${track.audio_path ? `<button class="ghost songmaster-btn" title="Открыть трек в SongMaster Pro (локально)" onclick="openInSongmaster('${track.id}')">${ICONS.note} SongMaster</button>` : ""}
        ${track.audio_path ? muscriptorButton("reference", track.id) : ""}
        <button class="icon-mini ref-tile-fav-detail ${link.favorite ? "active" : ""}" title="${link.favorite ? "Убрать из избранного" : "В избранное"}" onclick="toggleDemoRefFlag('${demo.id}','${track.id}','favorite',${!link.favorite})">${ICONS.heart}</button>
        <button class="icon-mini" title="Открыть в библиотеке" onclick="openTrack('${track.id}')">${ICONS.open}</button>
        ${secondaryAction}
      </div>
    </div>
    <section class="panel ref-detail-head">
      <div class="ref-detail-cover">${refTileVisual(track)}</div>
      <div class="ref-detail-title">
        ${isLocal
          ? `<input class="ref-detail-title-input" value="${esc(track.title || "")}" placeholder="Без названия" onchange="editReferenceField('${track.id}','title',this.value,this)">`
          : `<h2>${esc(track.title || "Без названия")}</h2>`}
        <p>${esc(track.artist || "")}</p>
        <div class="ref-detail-meta">
          <span>${esc(track.source || "local")}</span>
          <span>${duration ? formatSeconds(duration) : "—"}</span>
          <span>${esc(link.purpose || "")}</span>
          <span class="${track.audio_status === "analyzed" ? "ok" : ""}">${esc(track.audio_status || "missing")}</span>
        </div>
      </div>
    </section>
    <section class="panel ref-detail-player">
      ${renderComparePlayer({ ...track, duration_sec: duration, sections: analysis.sections || [], demoMarkers: markers }, 1, 980)}
      <p class="ref-note-hint">Правый клик по волне — быстрая заметка на таймкоде. Shift + перетаскивание метки — переместить её. Иконка ${ICONS.folder} у плеера — открыть папку с файлом в Проводнике, оттуда можно перетащить в Ableton.</p>
      ${song ? `<p class="map-caption">Song form</p>${song}` : ""}
      ${energy ? `<p class="map-caption">Energy structure</p>${energy}` : (duration ? "" : `<div class="empty">Нет анализа. Откройте reference и нажмите Analyze.</div>`)}
      ${analysis.micro_sections?.length ? `<details class="compare-curves-panel micro-detail-panel"><summary>Energy detail</summary>${renderSectionMap(analysis.micro_sections, duration, { zoom: 1, minWidth: 980, large: true, trackId: track.id, ruler: true, sceneLabels: true })}</details>` : ""}
      ${analysis.bar_features?.length ? `<details class="compare-curves-panel"><summary>Spectral overview</summary>${renderSpectralChart(analysis.bar_features, (analysis.sections || []).concat(analysis.song_sections || []), track.id + "-ref", duration)}</details>` : ""}
      ${stemsSectionHtml("reference", track.id)}
      ${midiSectionHtml("reference", track.id)}
      ${track.audio_path ? songmasterSectionHtml("reference", track.id) : ""}
    </section>
    <section class="panel ref-notes-panel">
      <div class="section-head compact"><h2>Заметки</h2><span class="muted" id="ref-note-count">${markers.length}</span></div>
      <div id="ref-notes-list">${notesRows || `<div class="empty-inline" id="ref-notes-empty">Пока пусто. ПКМ по волне во время прослушивания — заметка добавится без остановки плеера.</div>`}</div>
    </section>
  </div>`;
}

function openDemoRefDetail(demoId, trackId) {
  demoRefDetailTrackId = trackId;
  openDemoDetail(demoId, "references");
}

function closeDemoRefDetail(demoId) {
  demoRefDetailTrackId = "";
  openDemoDetail(demoId, "references");
}

function trackCard(track) {
  const bg = track.cover_url ? `style="background-image:url('${esc(track.cover_url)}')"` : "";
  const isAlbumReference = track.url && track.url.includes("/album/");
  const sourceLabel = track.source === "spotify" ? (isAlbumReference ? "альбом" : "трек") : (track.source || "generated");
  const spotiSaverUrl = buildSpotiSaverTrackUrl(track.url);
  return `<article class="track-card">
    <div class="cover ${track.cover_url ? "" : "no-image generated-cover"} source-${esc(track.source || "other")}" ${bg}><div class="cover-badges"><span class="status">${statusName[track.status] || track.status}</span><span class="source-type">${esc(sourceLabel)}</span></div><span class="cover-fallback-text">${esc((track.source || "RC").toUpperCase())}</span></div>
    <div class="track-body">
      <h3>${esc(track.title || "Без названия")}</h3><p>${esc(track.artist || "Неизвестный артист")}</p>
      ${tags(track.tags)}
      <div class="track-actions">
        <button class="open-card" onclick="openTrack('${track.id}')">Изучить</button>
        ${track.url ? `<button class="spotify mini-action" title="Открыть ${isAlbumReference ? "альбом" : "трек"} в Spotify" onclick="window.open('${esc(track.url)}','_blank')">${isAlbumReference ? "LP" : "♪"}</button>` : ""}
        ${spotiSaverUrl ? `<button class="download mini-action" title="Download via SpotiSaver" onclick="window.open('${esc(spotiSaverUrl)}','_blank')">↓</button>` : ""}
        <button class="tunebat mini-action" title="Search this track on TuneBat for BPM, key and audio features" onclick="window.open(buildTuneBatSearchUrl('${esc(track.artist)}','${esc(track.title)}'),'_blank')">BPM</button>
      </div>
    </div>
  </article>`;
}

async function loadDashboard() {
  const data = await api("/dashboard");
  document.querySelector("#recent-grid").innerHTML = data.recent.slice(0, 4).map(trackCard).join("") || empty("Пока нет референсов");
  document.querySelector("#new-ideas").innerHTML = data.ideas.slice(0, 5).map(idea => `
    <div class="idea-item"><span class="category">${esc(idea.category)}</span><p>${esc(idea.text)}</p><span>→</span></div>`).join("") || empty("Новых идей нет");
}

let activeTagFilter = "";
const SERVICE_TAGS = new Set(["spotify", "track"]);

function referenceTagCounts(tracks) {
  const counts = new Map();
  for (const track of tracks) {
    for (const tag of track.tags || []) {
      if (SERVICE_TAGS.has(tag) || tag.startsWith("album:") || tag.startsWith("demo:")) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderTagChipRow(tracks) {
  const row = document.querySelector("#tag-chip-row");
  if (!row) return;
  const tags = referenceTagCounts(tracks).slice(0, 40);
  if (!tags.length) { row.innerHTML = ""; return; }
  row.innerHTML = tags.map(([tag, count]) =>
    `<button type="button" class="tag-chip ${activeTagFilter === tag ? "active" : ""}" onclick="toggleTagFilter('${esc(tag).replace(/'/g, "\\'")}')">${esc(tag)} <small>${count}</small></button>`
  ).join("");
}

function toggleTagFilter(tag) {
  activeTagFilter = activeTagFilter === tag ? "" : tag;
  loadReferences();
}

async function loadReferences() {
  const q = document.querySelector("#search")?.value || "";
  const source = document.querySelector("#source-filter")?.value || "";
  const tag = activeTagFilter;
  const data = await api(`/references?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}&tag=${encodeURIComponent(tag)}`);
  document.querySelector("#references-grid").innerHTML = data.map(trackCard).join("") || empty("Ничего не найдено");
  const all = await api("/references");
  const sourcePool = source ? all.filter(t => t.source === source) : all;
  renderTagChipRow(sourcePool);
  document.querySelector("#reference-filter-state").innerHTML =
    `<strong>Найдено ${data.length} из ${all.length}</strong>${q ? `<span class="filter-chip">поиск: ${esc(q)}</span>` : ""}${(q || tag) ? "<span>Фильтры активны</span>" : "<span>Показана вся библиотека: треки и альбомные референсы</span>"}`;
}

function resetReferenceFilters() {
  document.querySelector("#search").value = "";
  document.querySelector("#source-filter").value = "spotify";
  activeTagFilter = "";
  loadReferences();
}

async function refreshReferenceMetadata(button) {
  const prev = button.textContent;
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    const result = await api("/references/refresh-metadata", { method: "POST" });
    toast(`Metadata обновлена: ${result.updated}${result.errors?.length ? `, ошибок: ${result.errors.length}` : ""}`);
    loadDashboard();
    loadReferences();
  } catch (error) {
    renderLocalUploadPreview(files, false);
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = prev;
  }
}

async function loadIdeas() {
  const status = document.querySelector("#idea-status").value;
  const category = document.querySelector("#idea-category").value;
  const data = await api(`/ideas?status=${status}&category=${category}`);
  document.querySelector("#ideas-board").innerHTML = data.map(idea => `
    <article class="idea-note">
      <span class="category">${esc(idea.category)}</span>
      <p>${esc(idea.text)}</p>
      <select onchange="setIdeaStatus('${idea.id}', this.value)">
        ${["new","tried","useful","rejected","applied"].map(s => `<option ${s === idea.status ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </article>`).join("") || empty("Идей с такими фильтрами нет");
}

async function setIdeaStatus(id, status) {
  await api(`/ideas/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  toast(`Статус: ${status}`);
}

async function loadDemo() {
  const demos = await api("/demos");
  const el = document.querySelector("#demo-content");
  if (!demos.length) {
    currentDemoId = null;
    el.innerHTML = `<div class="empty"><h2>Здесь будут ваши песни</h2><p>Создайте первую демку и собирайте для неё референсы, план и идеи.</p><button class="primary" onclick="openAddDemo()">+ Новая песня</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="demo-list-grid">
      ${demos.map(d => {
        const visual = demoVisual(d);
        return `
        <div class="demo-card" onclick="openDemoDetail('${d.id}')">
          <div class="demo-card-art" style="${visual.style}"><span>${esc(visual.initials)}</span></div>
          <p class="eyebrow">${d.bpm} BPM · ${esc(d.style || "Стиль не указан")}</p>
          <h2>${esc(d.demo_name)}</h2>
          <p class="demo-card-goal">${esc(d.main_goal || "")}</p>
          <div class="demo-card-meta"><span>${esc(demoDurationLabel(d))}</span><span>${esc(d.audio_status || "missing")}</span></div>
        </div>`;
      }).join("")}
    </div>`;
}

async function openDemoDetail(demoId, activeTab = "overview") {
  currentDemoId = demoId;
  const demo = await api(`/demos/${demoId}`);
  currentDemoCache = demo;
  const deepCached = _demoDeepCacheGet(demoId);
  const durationLabel = demoDurationLabel(demo);
  const visual = demoVisual(demo);
  document.querySelector("#demo-content").innerHTML = `
    <div class="demo-detail">
      <div class="demo-detail-back"><button class="ghost" onclick="loadDemo()">← Все демо</button></div>
      <section class="demo-header" style="${visual.style}">
        <div class="demo-header-row">
          <div><p class="eyebrow">YOUR SONG</p><h1>${esc(demo.demo_name)}</h1></div>
          <div class="demo-hero-art"><span>${esc(visual.initials)}</span></div>
          <div class="demo-header-actions">
            <button class="ghost light" onclick="event.stopPropagation(); exportDemoHandoff('${demo.id}')">Экспорт архива</button>
            <span class="audio-status ${esc(demo.audio_status || "missing")}">${esc(demo.audio_status || "missing")}</span>
          </div>
        </div>
        <div class="demo-meta"><span>${demo.bpm} BPM</span><span>${esc(demo.style || "Стиль не указан")}</span><span>${esc(durationLabel)}</span><span>${esc(demo.audio_filename || "audio not attached")}</span></div>
      </section>

      <nav class="track-tabs demo-tabs">
        <button class="track-tab ${activeTab === "overview" ? "active" : ""}" onclick="switchDemoTab(this,'overview')">Обзор</button>
        <button class="track-tab ${activeTab === "references" ? "active" : ""}" onclick="switchDemoTab(this,'references')">Референсы</button>
        <button class="track-tab ${activeTab === "analysis" ? "active" : ""}" onclick="switchDemoTab(this,'analysis')">Анализ</button>
      </nav>

      <div class="demo-tab-panel ${activeTab !== "overview" ? "hidden" : ""}" data-panel="overview">
        <details class="panel demo-editor">
          <summary>Настройки песни</summary>
          <form onsubmit="updateDemoDetail(event,'${demo.id}')">
            <div class="form-row"><label>Название<input name="demo_name" value="${esc(demo.demo_name)}" required></label><label>BPM<input name="bpm" type="number" min="20" max="300" value="${demo.bpm}"></label></div>
            <label>Стиль<input name="style" value="${esc(demo.style)}"></label>
            <label>Свободные заметки<textarea name="notes">${esc(demo.notes)}</textarea></label>
            <div class="dialog-actions"><button type="button" class="danger-text" onclick="deleteDemo('${demo.id}','${esc(demo.demo_name)}')">Удалить</button><button class="primary">Сохранить изменения</button></div>
          </form>
        </details>
        <div class="demo-workspace-grid">
          <div class="demo-workspace-col">
            ${renderWorkList(demo, "problems", "Проблемы", "Добавьте первую задачу", "Что мешает треку?")}
            ${renderWorkList(demo, "ideas_to_try", "Идеи попробовать", "Добавьте первую идею", "Что попробовать?")}
          </div>
          <div class="demo-workspace-col">
            ${renderDemoPlan(demo)}
            ${renderDemoReferences(demo)}
          </div>
        </div>
        ${renderDemoReferenceNotes(demo)}
      </div>

      <div class="demo-tab-panel ${activeTab !== "analysis" ? "hidden" : ""}" data-panel="analysis">
        ${renderDemoAnalysisPanel(demo, deepCached)}
      </div>
      <div class="demo-tab-panel ${activeTab !== "references" ? "hidden" : ""}" data-panel="references">
        ${renderDemoReferenceWorkspace(demo)}
      </div>
    </div>`;
  if (activeTab === "analysis") {
    requestAnimationFrame(() => {
      initDemoPlayer(demoId);
      const canvas = document.querySelector("#demo-content .spectral-canvas");
      if (canvas) initSpectralChart(canvas.id);
      if (deepCached) setTimeout(() => initDeepListenPlayer(demoId, `/api/demos/${demoId}/audio-file`), 100);
      initStemsPanels(document.querySelector("#demo-content"));
      initMidiPanels(document.querySelector("#demo-content"));
      initSongmasterPanels(document.querySelector("#demo-content"));
    });
  } else if (activeTab === "references") {
    setTimeout(() => initVisibleDemoReferencePlayers(demoId), 0);
  }
}

async function updateDemoDetail(event, demoId) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.bpm = Number(data.bpm);
  await api(`/demos/${demoId}`, { method: "PATCH", body: JSON.stringify(data) });
  toast("Песня обновлена");
  openDemoDetail(demoId);
}

function setWorkItemVisual(button, status) {
  const row = button?.closest(".work-item");
  if (!row) return;
  const check = row.querySelector(".work-check");
  const reject = row.querySelector(".icon-mini.reject");
  row.classList.toggle("done", status === "done");
  row.classList.toggle("rejected", status === "rejected");
  if (check) {
    check.innerHTML = status === "done" ? "✓" : "";
    check.setAttribute("aria-pressed", status === "done" ? "true" : "false");
  }
  if (reject) {
    reject.classList.toggle("active", status === "rejected");
    reject.setAttribute("aria-pressed", status === "rejected" ? "true" : "false");
  }
}

async function patchDemoWorkItems(demoId, field, updater, options = {}) {
  const demo = currentDemoCache?.id === demoId ? currentDemoCache : await api(`/demos/${demoId}`);
  const items = serializeWorkItems(demo[field] || []);
  const next = updater(items).filter(item => item.text);
  currentDemoCache = { ...demo, [field]: next };
  try {
    await api(`/demos/${demoId}`, { method: "PATCH", body: JSON.stringify({ [field]: next }) });
    if (options.refresh !== false) openDemoDetail(demoId, "overview");
  } catch (error) {
    currentDemoCache = demo;
    if (options.button && options.previousStatus) setWorkItemVisual(options.button, options.previousStatus);
    toast(error.message);
  } finally {
    if (options.button) options.button.disabled = false;
  }
}

async function addDemoWorkItem(event, demoId, field) {
  event.preventDefault();
  const input = event.target.querySelector("[name=text]");
  const text = input.value.trim();
  if (!text) return;
  await patchDemoWorkItems(demoId, field, items => [...items, { text, status: "open" }]);
}

async function editDemoWorkItem(demoId, field, index, text) {
  await patchDemoWorkItems(demoId, field, items => items.map((item, i) => i === index ? { ...item, text } : item));
}

async function toggleDemoWorkItem(button, demoId, field, index) {
  const items = serializeWorkItems((currentDemoCache || {})[field] || []);
  const previousStatus = items[index]?.status || "open";
  const nextStatus = previousStatus === "done" ? "open" : "done";
  button.disabled = true;
  setWorkItemVisual(button, nextStatus);
  await patchDemoWorkItems(demoId, field, items => items.map((item, i) => i === index ? { ...item, status: nextStatus } : item), { refresh: false, button, previousStatus });
}

async function rejectDemoWorkItem(button, demoId, field, index) {
  const items = serializeWorkItems((currentDemoCache || {})[field] || []);
  const previousStatus = items[index]?.status || "open";
  const nextStatus = previousStatus === "rejected" ? "open" : "rejected";
  button.disabled = true;
  setWorkItemVisual(button, nextStatus);
  await patchDemoWorkItems(demoId, field, items => items.map((item, i) => i === index ? { ...item, status: nextStatus } : item), { refresh: false, button, previousStatus });
}

async function deleteDemoWorkItem(demoId, field, index) {
  await patchDemoWorkItems(demoId, field, items => items.filter((_, i) => i !== index));
}

async function saveDemoPlanFromAnalysis(demoId) {
  const demo = await api(`/demos/${demoId}`);
  const sections = demoAnalysisPlanSections(demo).map(section => ({
    time: section.time,
    name: section.name,
    goal: section.goal,
    notes: section.notes || "",
  }));
  await api(`/demos/${demoId}`, { method: "PATCH", body: JSON.stringify({ arrangement_sections: sections }) });
  toast("План формы сохранён");
  openDemoDetail(demoId, "overview");
}

async function replaceDemoPlanFromAnalysis(demoId) {
  if (!confirm("Заменить текущий план секциями из анализа?")) return;
  await saveDemoPlanFromAnalysis(demoId);
}

async function patchDemoPlan(demoId, updater) {
  const demo = await api(`/demos/${demoId}`);
  const rows = (demo.arrangement_sections || []).map(row => ({
    time: row.time || "",
    name: row.name || "",
    goal: row.goal || "",
    notes: row.notes || "",
  }));
  const next = updater(rows).filter(row => row.time || row.name || row.goal || row.notes);
  await api(`/demos/${demoId}`, { method: "PATCH", body: JSON.stringify({ arrangement_sections: next }) });
  openDemoDetail(demoId, "overview");
}

async function editDemoPlanCell(demoId, index, key, value) {
  await patchDemoPlan(demoId, rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
}

async function deleteDemoPlanRow(demoId, index) {
  await patchDemoPlan(demoId, rows => rows.filter((_, i) => i !== index));
}

async function addDemoPlanRow(event, demoId) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  await patchDemoPlan(demoId, rows => [...rows, { ...data, notes: "" }]);
}

function switchDemoTab(btn, tabName) {
  const detail = btn.closest(".demo-detail");
  detail.querySelectorAll(".track-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  detail.querySelectorAll(".demo-tab-panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== tabName));
  if (tabName === "analysis") {
    const demoId = currentDemoId;
    requestAnimationFrame(() => {
      initDemoPlayer(demoId);
      const canvas = document.querySelector("#demo-content .spectral-canvas");
      if (canvas) initSpectralChart(canvas.id);
      if (document.getElementById(`dl-ws-${demoId}`)) initDeepListenPlayer(demoId, `/api/demos/${demoId}/audio-file`);
    });
  } else if (tabName === "references") {
    setTimeout(() => initVisibleDemoReferencePlayers(currentDemoId), 0);
  }
}

function initVisibleDemoReferencePlayers(demoId) {
  const detail = document.querySelector(".demo-detail");
  if (!detail) return;
  const refDetail = detail.querySelector(".ref-detail");
  if (!refDetail) {
    initRefTileNotesPopovers(detail);
    initGridPreviewPlayer(detail);
    initGridPlayerBar();
  }
  if (!window.WaveSurfer) return;
  if (refDetail) {
    const trackId = refDetail.dataset.trackId;
    if (trackId) {
      initAllWaveSurfers([{ id: trackId }]);
      attachWaveQuickNote(demoId, trackId);
      refDetail.querySelectorAll(".compare-curves-panel:not(.stems-panel):not(.songmaster-panel):not(.midi-panel)").forEach(panel => {
        panel.addEventListener("toggle", () => {
          if (!panel.open) return;
          const container = panel.querySelector("[id^='sc-']");
          if (container) initSpectralChart(container.id);
        });
      });
      initStemsPanels(refDetail);
      initMidiPanels(refDetail);
      initSongmasterPanels(refDetail);
    }
    return;
  }
  const tracks = [];
  detail.querySelectorAll(".demo-ref-structure[open] [id^='ws-']").forEach(el => {
    const id = el.id.replace(/^ws-/, "");
    if (id) tracks.push({ id });
  });
  if (tracks.length) initAllWaveSurfers(tracks);
}

function attachWaveQuickNote(demoId, trackId) {
  const shell = document.querySelector(".ref-detail .ws-wave-shell");
  if (!shell || shell.dataset.quickNoteBound) return;
  shell.dataset.quickNoteBound = "1";
  shell.addEventListener("contextmenu", event => {
    if (event.target.closest(".demo-wave-marker")) return;
    event.preventDefault();
    const rect = shell.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const ws = window._waveSurfers?.[trackId];
    const link = (currentDemoCache?.references || []).find(l => l.track.id === trackId);
    const duration = ws?.getDuration() || Number(link?.track.audio_analysis?.duration_sec || link?.track.audio_duration_sec || 0);
    if (!duration) { toast("Аудио ещё не загрузилось"); return; }
    openQuickNote(demoId, trackId, pct * duration, event.clientX, event.clientY);
  });
  attachMarkerDragSupport(shell, demoId, trackId);
}

function attachMarkerDragSupport(shell, demoId, trackId) {
  shell.addEventListener("mousedown", event => {
    const pin = event.target.closest(".demo-wave-marker");
    if (!pin || !event.shiftKey) return;
    event.preventDefault();
    const ws = window._waveSurfers?.[trackId];
    const duration = ws?.getDuration() || 0;
    if (!duration) return;
    pin.classList.add("dragging");
    const rect = shell.getBoundingClientRect();
    let draggedSec = Number(pin.style.left) / 100 * duration;
    const onMove = moveEvent => {
      const pct = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      draggedSec = pct * duration;
      pin.style.left = `${pct * 100}%`;
      const timeLabel = formatSeconds(draggedSec);
      const span = pin.querySelector("span");
      if (span) span.textContent = timeLabel;
      pin.title = pin.title.replace(/^[0-9:]+/, timeLabel);
    };
    const onUp = async () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      pin.classList.remove("dragging");
      const markerId = pin.dataset.markerId;
      const timeLabel = formatSeconds(draggedSec);
      if (!markerId) {
        toast("Не удалось определить пометку — обновите страницу");
        return;
      }
      try {
        await api(`/markers/${markerId}`, { method: "PATCH", body: JSON.stringify({ time_label: timeLabel }) });
        pin.dataset.timeSec = String(Math.round(draggedSec));
        const link = (currentDemoCache?.references || []).find(l => l.track.id === trackId);
        const marker = link?.track.markers?.find(m => m.id === markerId);
        if (marker) { marker.time_sec = Math.round(draggedSec); marker.time_label = timeLabel; }
        const row = document.querySelector(`.ref-note-row[data-marker-id="${CSS.escape(markerId)}"]`);
        if (row) {
          row.dataset.timeSec = String(Math.round(draggedSec));
          const timeBtn = row.querySelector(".ref-note-time");
          if (timeBtn) timeBtn.textContent = timeLabel;
          const list = row.parentElement;
          const rows = [...list.querySelectorAll(".ref-note-row")].sort((a, b) => Number(a.dataset.timeSec) - Number(b.dataset.timeSec));
          rows.forEach(r => list.appendChild(r));
        }
        toast(`Пометка перемещена: ${timeLabel}`);
      } catch (error) {
        toast(error.message);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  shell.addEventListener("click", event => {
    if (event.target.closest(".demo-wave-marker") && event.shiftKey) event.stopPropagation();
  }, true);
}

function closeQuickNote() {
  document.querySelector(".quick-note-pop")?.remove();
  document.removeEventListener("pointerdown", quickNoteOutsideHandler, true);
}

function quickNoteOutsideHandler(event) {
  if (!event.target.closest(".quick-note-pop")) closeQuickNote();
}

function openQuickNote(demoId, trackId, timeSec, x, y) {
  closeQuickNote();
  const track = (currentDemoCache?.references || []).find(l => l.track.id === trackId)?.track || {};
  const sectionLabel = refNoteSectionLabel(track, timeSec);
  const pop = document.createElement("div");
  pop.className = "quick-note-pop";
  pop.innerHTML = `
    <div class="quick-note-meta"><strong>${formatSeconds(timeSec)}</strong>${sectionLabel ? `<span>${esc(sectionLabel)}</span>` : ""}</div>
    <input type="text" placeholder="Заметка… Enter — сохранить" maxlength="200" aria-label="Текст заметки">`;
  document.body.appendChild(pop);
  const rect = pop.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 12))}px`;
  pop.style.top = `${Math.max(8, Math.min(y + 10, window.innerHeight - rect.height - 12))}px`;
  const input = pop.querySelector("input");
  input.focus();
  let saving = false;
  const save = async () => {
    const text = input.value.trim();
    if (!text || saving) return;
    saving = true;
    input.disabled = true;
    try {
      await saveQuickRefNote(demoId, trackId, timeSec, sectionLabel, text);
      closeQuickNote();
    } catch (error) {
      toast(error.message);
      saving = false;
      input.disabled = false;
      input.focus();
    }
  };
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); save(); }
    if (event.key === "Escape") closeQuickNote();
  });
  setTimeout(() => document.addEventListener("pointerdown", quickNoteOutsideHandler, true), 0);
}

async function saveQuickRefNote(demoId, trackId, timeSec, sectionLabel, text) {
  const payload = {
    time_label: formatSeconds(timeSec),
    section_type: "NOTE",
    title: sectionLabel ? `${sectionLabel}: ${text}` : text,
    notes: text,
    tags: [`demo:${demoId}`, "demo-note"],
  };
  const marker = await api(`/references/${trackId}/markers`, { method: "POST", body: JSON.stringify(payload) });
  const link = (currentDemoCache?.references || []).find(l => l.track.id === trackId);
  if (link) {
    link.track.markers = link.track.markers || [];
    link.track.markers.push(marker);
  }
  const list = document.getElementById("ref-notes-list");
  if (list) {
    document.getElementById("ref-notes-empty")?.remove();
    const row = document.createElement("div");
    row.innerHTML = renderRefNoteRow(demoId, trackId, marker);
    const newRow = row.firstElementChild;
    const sec = Number(marker.time_sec) || 0;
    const after = [...list.querySelectorAll(".ref-note-row")].find(r => Number(r.dataset.timeSec) > sec);
    list.insertBefore(newRow, after || null);
    newRow.classList.add("just-added");
  }
  const count = document.getElementById("ref-note-count");
  if (count) count.textContent = String((currentDemoCache?.references || []).find(l => l.track.id === trackId)?.track.markers?.filter(m => (m.tags || []).includes(`demo:${demoId}`)).length || "");
  addWaveNotePin(demoId, trackId, marker);
  toast("Пометка добавлена");
}

function addWaveNotePin(demoId, trackId, marker) {
  const shell = document.querySelector(".ref-detail .ws-wave-shell");
  if (!shell) return;
  const ws = window._waveSurfers?.[trackId];
  const link = (currentDemoCache?.references || []).find(l => l.track.id === trackId);
  const duration = ws?.getDuration() || Number(link?.track.audio_analysis?.duration_sec || link?.track.audio_duration_sec || 0);
  if (!duration) return;
  let container = shell.querySelector(".demo-wave-markers");
  if (!container) {
    container = document.createElement("div");
    container.className = "demo-wave-markers";
    container.setAttribute("aria-label", "Demo reference notes");
    shell.appendChild(container);
  }
  const sec = Number(marker.time_sec) || 0;
  const left = Math.max(0, Math.min(100, (sec / duration) * 100));
  const time = marker.time_label || formatSeconds(sec);
  const label = marker.title || marker.notes || "Пометка";
  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "demo-wave-marker";
  pin.style.left = `${left}%`;
  pin.title = `${time} · ${label}`;
  pin.dataset.markerId = marker.id;
  pin.dataset.timeSec = String(sec);
  pin.innerHTML = `<span>${esc(time)}</span>`;
  pin.onclick = () => demoWaveMarkerClick(pin, trackId);
  container.appendChild(pin);
}

async function quickDeleteRefNote(demoId, markerId, button) {
  if (!confirm("Удалить эту пометку?")) return;
  button.disabled = true;
  try {
    await api(`/markers/${markerId}`, { method: "DELETE" });
  } catch (error) {
    button.disabled = false;
    toast(error.message);
    return;
  }
  button.closest(".ref-note-row")?.remove();
  document.querySelector(`.demo-wave-marker[data-marker-id="${CSS.escape(markerId)}"]`)?.remove();
  (currentDemoCache?.references || []).forEach(link => {
    link.track.markers = (link.track.markers || []).filter(m => m.id !== markerId);
  });
  const count = document.getElementById("ref-note-count");
  const list = document.getElementById("ref-notes-list");
  if (count && list) count.textContent = String(list.querySelectorAll(".ref-note-row").length);
  toast("Пометка удалена");
}

async function addDemoReferenceNote(event, demoId, trackId) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.notes = data.title || "";
  data.tags = [`demo:${demoId}`, "demo-note"];
  await api(`/references/${trackId}/markers`, { method: "POST", body: JSON.stringify(data) });
  lastOpenDemoReferenceTrackId = trackId;
  toast("Пометка добавлена");
  openDemoDetail(demoId, "references");
}

async function deleteDemoReferenceNote(demoId, markerId, returnTab = "overview") {
  if (!confirm("Удалить эту пометку?")) return;
  await api(`/markers/${markerId}`, { method: "DELETE" });
  toast("Пометка удалена");
  openDemoDetail(demoId, returnTab);
}

function fillDemoReferenceNoteTime(demoId, trackId, seconds, label = "") {
  openQuickNote(demoId, trackId, Number(seconds) || 0, window.innerWidth / 2, window.innerHeight / 3);
}

async function removeReferenceFromDemo(demoId, trackId, returnTab = "references") {
  if (!confirm("Отвязать этот reference от демо? Сам reference останется в библиотеке.")) return;
  await api(`/demos/${demoId}/references/${trackId}`, { method: "DELETE" });
  if (lastOpenDemoReferenceTrackId === trackId) lastOpenDemoReferenceTrackId = "";
  toast("Reference отвязан от демо");
  openDemoDetail(demoId, returnTab);
}

async function toggleDemoRefFlag(demoId, trackId, field, value, returnTab = "references") {
  try {
    await api(`/demos/${demoId}/references/${trackId}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
    openDemoDetail(demoId, returnTab);
  } catch (error) {
    toast(error.message);
  }
}

function playDemoRefSnippet(trackId, seconds = 0) {
  window._demoSnippetAudio?.pause();
  const audio = new Audio(`/api/references/${trackId}/audio-file`);
  window._demoSnippetAudio = audio;
  audio.currentTime = Math.max(0, Number(seconds) || 0);
  audio.play().catch(() => toast("Браузер заблокировал автозапуск, откройте reference и нажмите play"));
  setTimeout(() => {
    if (window._demoSnippetAudio === audio) audio.pause();
  }, 12000);
}

function stopDemoRefSnippet() {
  const audio = window._demoSnippetAudio;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function renderDemoAnalysisPanel(demo, deepCached = null) {
  const analysis = demo.audio_analysis;
  const sections = analysis?.sections || [];
  const songSections = analysis?.song_sections || [];
  const microSections = analysis?.micro_sections || [];
  const features = analysis?.bar_features || [];
  const duration = Number(analysis?.duration_sec || demo.audio_duration_sec || 0);
  const timeline = sections.length ? renderSectionMap(sections, duration, { zoom: 1.15, baseWidth: 980, sceneLabels: true, demoId: demo.id }) : "";
  const songTimeline = songSections.length ? renderSectionMap(songSections, duration, { zoom: 1.15, baseWidth: 980, sceneLabels: true, demoId: demo.id }) : "";
  const microTimeline = microSections.length ? renderSectionMap(microSections, duration, { zoom: 1.15, baseWidth: 980, sceneLabels: true, demoId: demo.id }) : "";
  const hasAudio = !!(demo.audio_path);

  return `<section class="detail-section audio-analysis-panel">
    <div class="section-head"><h2>Audio Analysis</h2><span class="audio-status ${esc(demo.audio_status || "missing")}">${esc(demo.audio_status || "missing")}</span></div>
    <form class="mini-form audio-form" onsubmit="attachDemoAudioPath(event,'${demo.id}')">
      <div class="audio-drop-zone" ondragover="handleAudioDrag(event, true)" ondragleave="handleAudioDrag(event, false)" ondrop="handleDemoAudioDrop(event,'${demo.id}')">
        ${audioPathEditorHtml({ id: `demo-audio-path-${demo.id}`, value: demo.audio_path || "" })}
        <div class="audio-path-actions">
          <button type="button" class="ghost" onclick="browseDemoAudio('${demo.id}')">Browse…</button>
          <button class="ghost">Attach audio path</button>
          <button type="button" class="primary" onclick="analyzeDemoAudio('${demo.id}', this)">Analyze</button>
          ${demo.audio_path ? `<button type="button" class="ghost songmaster-btn" title="Открыть трек в SongMaster Pro (локально)" onclick="openInSongmasterDemo('${demo.id}')">${ICONS.note} SongMaster</button>` : ""}
        </div>
        <input id="demo-audio-browse-${demo.id}" class="hidden-file-input" type="file" accept=".mp3,.wav,.aiff,.aif,.flac,audio/*" onchange="handleDemoAudioBrowse(this,'${demo.id}')">
        <p class="field-hint">Browse загрузит локальную копию. Drag-and-drop / ручной путь сохраняют абсолютный путь без копирования.</p>
      </div>
    </form>
    ${analysis?.error ? `<div class="empty">Ошибка анализа: ${esc(analysis.error)}</div>` : ""}
    ${analysis && !analysis.error ? `<div class="analysis-summary">
      <span><strong>${esc(analysis.estimated_bpm)}</strong>BPM</span>
      <span><strong>${esc(analysis.bars)}</strong>bars</span>
      <span><strong>${formatSeconds(analysis.duration_sec)}</strong>duration</span>
    </div>
    ${renderDemoPlayer(demo.id, sections)}
    ${songTimeline ? `<h3>Song form</h3>${songTimeline}` : ""}
    <h3>Energy structure</h3>${timeline}
    ${microTimeline ? `<details class="micro-detail-panel"><summary>Energy detail</summary>${microTimeline}</details>` : ""}
    ${features.length ? `<h3>Spectral overview</h3>${renderSpectralChart(features, sections.concat(songSections), demo.id, duration)}` : ""}
    ${stemsSectionHtml("demo", demo.id)}
    ${midiSectionHtml("demo", demo.id)}
    ${demo.audio_path ? songmasterSectionHtml("demo", demo.id) : ""}
    <table class="sections-table"><thead><tr><th>Label</th><th>Time</th><th>Bars</th><th>Energy</th></tr></thead><tbody>
      ${sections.map(s => `<tr><td>${esc(s.label)}</td><td>${formatSeconds(s.start_sec)} – ${formatSeconds(s.end_sec)}</td><td>${esc(s.start_bar)}–${esc(s.end_bar)}</td><td>${Number(s.energy).toFixed(2)}</td></tr>`).join("")}
    </tbody></table>` : ""}
  </section>
  <section class="detail-section audio-analysis-panel" style="margin-top:24px">
    <div class="section-head"><h2>Deep Listen</h2></div>
    <div id="demo-deep-listen-${demo.id}">
      ${deepCached
        ? renderDemoDeepResult(demo.id, deepCached)
        : hasAudio
          ? `<div class="dl-run-row"><button class="primary" onclick="loadDemoDeepListen('${demo.id}')">▶ Run Deep Listen</button><p class="field-hint">Занимает ~10–30 сек. Результат кэшируется до закрытия вкладки.</p></div>`
          : `<div class="empty">Прикрепите аудиофайл выше, затем запустите Deep Listen.</div>`}
    </div>
  </section>`;
}

function renderDemoPlayer(demoId, sections = []) {
  const chips = sections.map(s =>
    `<button type="button" style="${sectionChipStyle(s.label)}" onclick="demoPLayerSeek('${demoId}',${Number(s.start_sec)||0})">${esc(s.label)} <small>${formatSeconds(s.start_sec)}</small></button>`
  ).join("");
  return `<div class="compare-player" style="margin:16px 0">
    <div class="ws-player">
      <div class="ws-controls">
        <button class="ws-play-btn" id="demo-play-${demoId}" onclick="demoPLayerToggle('${demoId}')">&#9654;</button>
        <span class="ws-time" id="demo-time-${demoId}">0:00 / --</span>
        <label class="ws-volume" title="Volume">
          <span>Vol</span>
          <input type="range" min="0" max="1" step="0.01" value="${getSavedWaveVolume()}" oninput="demoPlayerVolume('${demoId}',this.value)">
        </label>
        <button type="button" class="icon-mini" title="Открыть папку с файлом" onclick="revealAudioInFolder('demo','${demoId}', this)">${ICONS.folder}</button>
        ${muscriptorButton("demo", demoId, true)}
      </div>
      <div id="demo-ws-${demoId}" class="ws-wave"></div>
    </div>
    ${chips ? `<div class="section-jump-row">${chips}</div>` : ""}
  </div>`;
}

function initDemoPlayer(demoId, cacheBust = "") {
  if (!window.WaveSurfer) return;
  const container = document.getElementById(`demo-ws-${demoId}`);
  if (!container) return;
  window._demoPlayers = window._demoPlayers || {};
  if (window._demoPlayers[demoId]) { try { window._demoPlayers[demoId].destroy(); } catch(_) {} }
  const t = cacheBust || Date.now();
  const ws = WaveSurfer.create({
    container,
    url: `/api/demos/${demoId}/audio-file?t=${t}`,
    waveColor: "#7F77DD",
    progressColor: "#22C55E",
    height: 64, barWidth: 3, barGap: 1, barRadius: 2, interact: true,
  });
  window._demoPlayers[demoId] = ws;
  ws.setVolume(getSavedWaveVolume());
  ws.on("timeupdate", time => {
    const el = document.getElementById(`demo-time-${demoId}`);
    if (el) el.textContent = `${formatSeconds(time)} / ${formatSeconds(ws.getDuration()||0)}`;
  });
  ws.on("play",   () => { const b = document.getElementById(`demo-play-${demoId}`); if (b) b.innerHTML = "&#9646;&thinsp;&#9646;"; });
  ws.on("pause",  () => { const b = document.getElementById(`demo-play-${demoId}`); if (b) b.innerHTML = "&#9654;"; });
  ws.on("finish", () => { const b = document.getElementById(`demo-play-${demoId}`); if (b) b.innerHTML = "&#9654;"; });
}

function demoPLayerToggle(demoId) { window._demoPlayers?.[demoId]?.playPause(); }
function demoPlayerVolume(demoId, val) {
  const v = Math.max(0, Math.min(1, Number(val)||0));
  localStorage.setItem(WS_VOLUME_LS_KEY, String(v));
  window._demoPlayers?.[demoId]?.setVolume(v);
}
function demoPLayerSeek(demoId, sec) {
  const ws = window._demoPlayers?.[demoId];
  if (ws) ws.seekTo(sec / (ws.getDuration()||1));
}

async function attachDemoAudioPath(event, demoId) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  if (!isUsableLocalAudioPath(data.audio_path || "")) { warnAboutHiddenAudioPath(); return; }
  try {
    await api(`/demos/${demoId}/audio-path`, { method: "POST", body: JSON.stringify(data) });
    toast("Audio path прикреплён");
    openDemoDetail(demoId, "analysis");
  } catch (error) { toast(error.message); }
}

function browseDemoAudio(demoId) {
  document.querySelector(`#demo-audio-browse-${CSS.escape(demoId)}`)?.click();
}

async function handleDemoAudioBrowse(input, demoId) {
  const file = input.files?.[0];
  if (!file) return;
  const value = file.path || input.value || file.name || "";
  const pathInput = document.querySelector(`#demo-audio-path-${CSS.escape(demoId)}`);
  if (pathInput) pathInput.value = value;
  if (file.path && isUsableLocalAudioPath(file.path)) {
    try {
      await api(`/demos/${demoId}/audio-path`, { method: "POST", body: JSON.stringify({ audio_path: file.path }) });
      toast("Audio path прикреплён");
      openDemoDetail(demoId, "analysis");
    } catch (error) { toast(error.message); }
    return;
  }
  const data = new FormData();
  data.append("file", file);
  try {
    await apiUpload(`/demos/${demoId}/audio-upload`, data);
    toast("Audio file загружен и прикреплён");
    openDemoDetail(demoId, "analysis");
  } catch (error) { toast(error.message); }
  finally { input.value = ""; }
}

function handleDemoAudioDrop(event, demoId) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  const value = audioPathFromDrop(event);
  const pathInput = document.querySelector(`#demo-audio-path-${CSS.escape(demoId)}`);
  if (pathInput) pathInput.value = value;
  if (!isUsableLocalAudioPath(value)) { warnAboutHiddenAudioPath(); return; }
  api(`/demos/${demoId}/audio-path`, { method: "POST", body: JSON.stringify({ audio_path: value }) })
    .then(() => { toast("Audio path прикреплён"); openDemoDetail(demoId, "analysis"); })
    .catch(e => toast(e.message));
}

async function analyzeDemoAudio(demoId, button) {
  button.disabled = true;
  const prev = button.textContent;
  button.textContent = "Analyzing…";
  try {
    await api(`/demos/${demoId}/analyze-audio`, { method: "POST" });
    toast("Аудио проанализировано");
    openDemoDetail(demoId, "analysis");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = prev; }
}

function _demoDeepCacheKey(demoId) { return `dl_cache_${demoId}`; }
function _demoDeepCacheGet(demoId) {
  window._demoDeepCache = window._demoDeepCache || {};
  if (window._demoDeepCache[demoId]) return window._demoDeepCache[demoId];
  try { const v = localStorage.getItem(_demoDeepCacheKey(demoId)); if (v) { const p = JSON.parse(v); window._demoDeepCache[demoId] = p; return p; } } catch(_) {}
  return null;
}
function _demoDeepCacheSet(demoId, data) {
  window._demoDeepCache = window._demoDeepCache || {};
  window._demoDeepCache[demoId] = data;
  try { localStorage.setItem(_demoDeepCacheKey(demoId), JSON.stringify(data)); } catch(_) {}
}

async function loadDemoDeepListen(demoId, forceRefresh = false) {
  const container = document.querySelector(`#demo-deep-listen-${CSS.escape(demoId)}`);
  if (!container) return;
  const cached = _demoDeepCacheGet(demoId);
  if (cached && !forceRefresh) {
    container.innerHTML = renderDemoDeepResult(demoId, cached);
    setTimeout(() => initDeepListenPlayer(demoId, `/api/demos/${demoId}/audio-file`), 50);
    return;
  }
  container.innerHTML = `<div class="dl-analyzing"><span class="pulse"></span> Анализирую…</div>`;
  try {
    const res = await api(`/demos/${demoId}/deep-analysis`);
    _demoDeepCacheSet(demoId, res.analysis);
    container.innerHTML = renderDemoDeepResult(demoId, res.analysis);
    setTimeout(() => initDeepListenPlayer(demoId, `/api/demos/${demoId}/audio-file`), 50);
  } catch (error) {
    container.innerHTML = `<div class="empty">Ошибка: ${esc(error.message)}</div>`;
  }
}

function renderDemoDeepResult(demoId, a) {
  return `<div style="text-align:right;margin-bottom:8px"><button class="ghost" onclick="loadDemoDeepListen('${demoId}',true)">↺ Re-analyze</button></div>` + renderDeepListenFull(demoId, a);
}

function openAddDemo() {
  document.querySelector("#add-demo-dialog").showModal();
}

async function updateDemo(event, demoId) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.bpm = Number(data.bpm);
  data.problems = data.problems.split("\n").map(x => x.trim()).filter(Boolean);
  data.ideas_to_try = data.ideas_to_try.split("\n").map(x => x.trim()).filter(Boolean);
  await api(`/demos/${demoId}`, { method: "PATCH", body: JSON.stringify(data) });
  toast("Песня обновлена");
  openDemoDetail(demoId);
}

async function deleteDemo(demoId, name) {
  if (!confirm(`Удалить демо «${name}»?`)) return;
  await api(`/demos/${demoId}`, { method: "DELETE" });
  currentDemoId = null;
  toast("Демо удалено");
  loadDemo();
  loadDashboard();
}

async function showAddToDemo(demoId) {
  const tracks = await api("/references?source=spotify");
  document.querySelector("#add-to-demo").innerHTML = `<form class="mini-form demo-ref-picker" onsubmit="addSelectedToDemo(event,'${demoId}')">
    <div class="form-row">
      <label>Зачем<select name="purpose">${["arrangement","hook","groove","transition","automation","mix","sound design"].map(x => `<option>${x}</option>`).join("")}</select></label>
      <label>Фильтр<input type="search" placeholder="artist / title" oninput="filterDemoReferencePicker(this.value)"></label>
    </div>
    <div class="demo-ref-pick-grid">
      ${tracks.map(t => `<label class="demo-ref-pick">
        <input type="checkbox" name="track_id" value="${t.id}">
        ${t.cover_url ? `<img src="${esc(t.cover_url)}" alt="">` : `<span class="compare-cover-fallback"></span>`}
        <span><strong>${esc(t.title)}</strong><small>${esc(t.artist)}${t.duration_ms ? ` · ${formatSeconds(t.duration_ms / 1000)}` : ""}</small></span>
      </label>`).join("") || empty("Spotify-референсы не найдены. Локальные генерации смотрите во вкладке «Референсы».")}
    </div>
    <div class="dialog-actions"><button type="button" class="ghost" onclick="document.querySelector('#add-to-demo').innerHTML=''">Закрыть</button><button class="primary">Привязать выбранные</button></div>
  </form>`;
}

async function addToDemo(event, demoId) {
  event.preventDefault();
  const form = new FormData(event.target);
  await api(`/demos/${demoId}/references`, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
  toast("Референс привязан");
  openDemoDetail(demoId);
}

function filterDemoReferencePicker(query = "") {
  const q = query.trim().toLowerCase();
  document.querySelectorAll(".demo-ref-pick").forEach(card => {
    card.hidden = q && !card.textContent.toLowerCase().includes(q);
  });
}

async function addSelectedToDemo(event, demoId) {
  event.preventDefault();
  const form = event.target;
  const purpose = form.querySelector("[name=purpose]").value;
  const ids = [...form.querySelectorAll("[name=track_id]:checked")].map(input => input.value);
  if (!ids.length) { toast("Выберите хотя бы один референс"); return; }
  await Promise.all(ids.map(track_id => api(`/demos/${demoId}/references`, { method: "POST", body: JSON.stringify({ track_id, purpose }) })));
  toast(`Привязано: ${ids.length}`);
  openDemoDetail(demoId);
}

async function openTrack(id) {
  const track = await api(`/references/${id}`);
  window._openTrackCache = window._openTrackCache || {};
  window._openTrackCache[id] = track;
  const spotiSaverUrl = buildSpotiSaverTrackUrl(track.url);
  const dialog = document.querySelector("#track-dialog");
  const hasAudio = !!(track.audio_path);
  document.querySelector("#track-detail").innerHTML = `
    <div class="dialog-head"><div><p class="eyebrow">${esc(track.source)} · ${formatDuration(track.duration_ms)}</p><h2>${esc(track.artist)} — ${esc(track.title)}</h2></div><button class="icon-btn" onclick="this.closest('dialog').close()">×</button></div>
    <div class="detail-top">
      ${track.cover_url ? `<img class="detail-cover" src="${esc(track.cover_url)}" alt="">` : `<div class="detail-cover"></div>`}
      <div><p>${track.album_url ? `<a class="album-link" href="${esc(track.album_url)}" target="_blank" rel="noreferrer">${esc(track.album)} ↗</a>` : esc(track.album)}</p>${tags(track.tags)}<p style="margin-top:15px">${esc(track.general_notes || "Добавьте заметку: что здесь классного и что хочется применить?")}</p>
      <div class="track-actions detail-actions">${track.url ? `<button class="spotify" title="Open in Spotify" onclick="window.open('${esc(track.url)}','_blank')">Spotify ↗</button>` : ""}${track.album_url && track.album_url !== track.url ? `<button class="spotify" title="Open album" onclick="window.open('${esc(track.album_url)}','_blank')">Album ↗</button>` : ""}${spotiSaverUrl ? `<button class="download" title="Download via SpotiSaver" onclick="window.open('${esc(spotiSaverUrl)}','_blank')">Download ↗</button>` : ""}<button class="tunebat" title="Search this track on TuneBat for BPM, key and audio features" onclick="window.open(buildTuneBatSearchUrl('${esc(track.artist)}','${esc(track.title)}'),'_blank')">BPM ↗</button><button class="open-card" title="Export Markdown" onclick="exportTrack('${track.id}')">MD</button></div></div>
    </div>
    <nav class="track-tabs">
      <button class="track-tab active" data-tab="analysis" onclick="switchTrackTab(this,'analysis')">Analysis</button>
      <button class="track-tab" data-tab="deep" onclick="switchTrackTab(this,'deep')">Deep Listen</button>
      <button class="track-tab" data-tab="notes" onclick="switchTrackTab(this,'notes')">Notes</button>
    </nav>
    <div class="track-tab-panel" data-panel="analysis">
      ${renderAudioAnalysisPanel(track)}
    </div>
    <div class="track-tab-panel hidden" data-panel="deep">
      <div id="deep-listen-${id}" class="deep-listen-panel">
        ${hasAudio ? `<div class="dl-run-row"><button class="primary" onclick="loadDeepListen('${id}')">▶ Run Deep Listen</button><p class="field-hint">Занимает ~10–30 сек. Результат кэшируется до закрытия вкладки.</p></div>` : `<div class="empty">Прикрепите аудиофайл во вкладке Analysis, затем вернитесь сюда.</div>`}
      </div>
    </div>
    <div class="track-tab-panel hidden" data-panel="notes">
      <section class="detail-section"><div class="section-head"><h2>Маркеры</h2></div>
        <div>${track.markers.map(m => `<div class="marker"><strong>${m.time_label}</strong><span class="category">${m.section_type}</span><div><b>${esc(m.title)}</b><br><small>${esc(m.notes)}</small></div><button class="text-btn" onclick="convertMarker('${m.id}','${track.id}')">В идею</button></div>`).join("") || empty("Добавьте первый важный момент")}</div>
        <form class="mini-form" onsubmit="addMarker(event,'${track.id}')">
          <div class="form-row"><label>Тайминг<input name="time_label" required placeholder="2:10"></label><label>Тип<select name="section_type">${["INTRO","KICK_IN","LAYER_IN","BREAK","BUILD","DROP","PIT","PEAK","OUTRO","HOOK","TRANSITION","AUTOMATION","MIX_MOMENT"].map(x=>`<option>${x}</option>`).join("")}</select></label></div>
          <label>Название<input name="title" required placeholder="Пространство раскрывается"></label><label>Заметка<textarea name="notes"></textarea></label><label>Теги<input name="tags"></label>
          <button class="primary">Добавить marker</button>
        </form>
      </section>
      <section class="detail-section"><div class="section-head"><h2>Идеи / Takeaways</h2></div>
        <div>${track.ideas.map(i => `<div class="idea-item"><span class="category">${i.category}</span><p>${esc(i.text)}</p><span>${i.status}</span></div>`).join("") || empty("Пока нет идей")}</div>
        <form class="mini-form" onsubmit="addIdea(event,'${track.id}')">
          <div class="form-row"><label>Категория<select name="category">${["arrangement","drums","bass","hook","transition","automation","mix","sound_design"].map(x=>`<option>${x}</option>`).join("")}</select></label><label>Статус<select name="status"><option>new</option><option>tried</option><option>useful</option><option>rejected</option><option>applied</option></select></label></div>
          <label>Идея<textarea name="text" required></textarea></label><button class="primary">Добавить идею</button>
        </form>
      </section>
    </div>`;
  const detailRoot = document.querySelector("#track-detail");
  initMidiPanels(detailRoot);
  initSongmasterPanels(detailRoot);
  dialog.showModal();
  requestAnimationFrame(() => initSpectralChart(`sc-${id}`));
}

function switchTrackTab(btn, tabName) {
  const dialog = btn.closest("#track-detail");
  dialog.querySelectorAll(".track-tab").forEach(t => t.classList.remove("active"));
  dialog.querySelectorAll(".track-tab-panel").forEach(p => p.classList.add("hidden"));
  btn.classList.add("active");
  dialog.querySelector(`[data-panel="${tabName}"]`).classList.remove("hidden");
  if (tabName === "analysis") {
    const uid = btn.closest("[data-panel]")?.previousElementSibling?.querySelector("canvas")?.id
      || dialog.querySelector(".spectral-canvas")?.id;
    if (uid) requestAnimationFrame(() => initSpectralChart(uid));
  }
}

async function loadDeepListen(trackId, forceRefresh = false) {
  const container = document.getElementById(`deep-listen-${trackId}`);
  if (!container) return;
  const cached = _refDeepCacheGet(trackId);
  if (!forceRefresh && cached?.analysis) {
    container.innerHTML = renderDeepListen(trackId, cached.analysis);
    requestAnimationFrame(() => initDeepListenPlayer(trackId));
    return;
  }
  container.innerHTML = `<div class="empty">Анализирую… <span class="pulse"></span></div>`;
  try {
    const track = window._openTrackCache?.[trackId] || null;
    const { analysis } = await api(`/references/${trackId}/deep-analysis`);
    _refDeepCacheSet(trackId, track, analysis);
    container.innerHTML = renderDeepListen(trackId, analysis);
    requestAnimationFrame(() => initDeepListenPlayer(trackId));
  } catch (e) {
    container.innerHTML = `<div class="empty">Ошибка: ${esc(e.message || String(e))}</div>`;
  }
}

function renderDeepListen(trackId, a) {
  if (!a) return `<div class="empty">Нет данных</div>`;
  return renderDeepListenFull(trackId, a);
}

async function addMarker(event, trackId) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.tags = data.tags.split(",").map(x=>x.trim()).filter(Boolean);
  await api(`/references/${trackId}/markers`, { method: "POST", body: JSON.stringify(data) }); toast("Marker добавлен"); openTrack(trackId);
}
async function addIdea(event, trackId) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
  await api(`/references/${trackId}/ideas`, { method: "POST", body: JSON.stringify(data) }); toast("Идея добавлена"); openTrack(trackId);
}
async function convertMarker(markerId, trackId) {
  await api(`/markers/${markerId}/convert-to-idea`, { method: "POST" }); toast("Marker превращен в идею"); openTrack(trackId);
}
async function exportTrack(id) { const data = await api(`/export/reference/${id}`, {method:"POST"}); toast(`Сохранено: ${data.path}`); }
async function exportDemo(id) { const data = await api(`/export/demo/${id}`, {method:"POST"}); toast(`Сохранено: ${data.path}`); }
async function exportDemoHandoff(id) {
  const data = await api(`/export/demo/${id}/handoff-archive`, {method:"POST"});
  toast(`Архив демки сохранён: ${data.path}`);
}
function formatDuration(ms) { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
function empty(text) { return `<div class="empty">${text}</div>`; }
async function openAddReference() {
  const dialog = document.querySelector("#add-reference-dialog");
  dialog.showModal();
  switchAddReferenceMode("spotify");
  try {
    const demos = await api("/demos");
    const select = document.querySelector("#local-ref-demo-select");
    if (select) {
      const shouldPreselectDemo = document.querySelector("#demo-view")?.classList.contains("active");
      select.innerHTML = `<option value="">No demo link</option>` + demos.map(demo => `<option value="${demo.id}" ${shouldPreselectDemo && demo.id === currentDemoId ? "selected" : ""}>${esc(demo.demo_name)}</option>`).join("");
    }
  } catch (_) {}
}
function switchAddReferenceMode(mode) {
  document.querySelectorAll("[data-ref-mode]").forEach(button => button.classList.toggle("active", button.dataset.refMode === mode));
  document.querySelectorAll("#add-reference-dialog .ref-mode-panel").forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== mode));
}
function filterByTag(tag) { showView("references"); activeTagFilter = tag; loadReferences(); }

function renderLocalUploadPreview(files = [], analyzing = false) {
  const list = [...files];
  const container = document.querySelector("#local-upload-preview");
  if (!container) return;
  if (!list.length) {
    container.innerHTML = "";
    return;
  }
  const isZip = list.some(file => /\.zip$/i.test(file.name));
  const skeletonCount = isZip ? 8 : Math.min(8, list.length);
  const rows = isZip
    ? Array.from({ length: skeletonCount }, (_, index) => `<div class="upload-skeleton-row"><span></span><p>audio from archive ${index + 1}</p><i></i></div>`).join("")
    : list.slice(0, 12).map(file => `<div class="upload-preview-row"><span>${esc(file.name.split(".").pop().toUpperCase())}</span><p>${esc(file.name)}</p><small>${Math.max(1, Math.round(file.size / 1024 / 1024))} MB</small></div>`).join("");
  container.innerHTML = `<div class="upload-preview ${analyzing ? "busy" : ""}">
    <div class="upload-preview-head"><strong>${isZip ? "Архив выбран" : `Файлов: ${list.length}`}</strong><small>${analyzing ? "Загружаю, распаковываю и анализирую..." : "Будут созданы локальные references"}</small></div>
    ${rows}
  </div>`;
}

function renderAudioChart(features = [], series = []) {
  if (!features.length) return empty("Нет bar-level данных для графика");
  const width = 920;
  const height = 140;
  const pointsFor = (key) => features.map((bar, index) => {
    const x = features.length === 1 ? 0 : (index / (features.length - 1)) * width;
    const y = height - (Number(bar[key]) || 0) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return `<svg class="analysis-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <line x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}"></line>
    ${series.map(item => `<polyline points="${pointsFor(item.key)}" stroke="${item.color}"></polyline>`).join("")}
  </svg>
  <div class="chart-legend">${series.map(item => `<span><i style="background:${item.color}"></i>${esc(item.label)}</span>`).join("")}</div>`;
}

function renderSpectralChart(features = [], sections = [], trackId = "", duration = 0) {
  if (!features.length) return "";
  const uid = `sc-${trackId || Math.random().toString(36).slice(2)}`;
  window._spectralData = window._spectralData || {};
  window._spectralData[uid] = { features, sections, duration };
  return `<div class="spectral-chart-wrap"><canvas id="${uid}" class="spectral-canvas"></canvas><div class="spectral-tooltip" id="${uid}-tip"></div></div>`;
}

function initSpectralChart(uid) {
  if (!window._spectralData?.[uid]) return;
  const canvas = document.getElementById(uid);
  if (!canvas) return;

  const w = canvas.parentElement.getBoundingClientRect().width;
  if (w < 10) {
    const ro = new ResizeObserver(entries => {
      if (entries[0].contentRect.width >= 10) { ro.disconnect(); initSpectralChart(uid); }
    });
    ro.observe(canvas.parentElement);
    return;
  }

  const { features, sections, duration } = window._spectralData[uid];
  const trackId = uid.replace(/^sc-/, "").replace(/-cmp$/, "");
  const DPR = window.devicePixelRatio || 1;
  const W = Math.floor(w), H = 200;
  const PAD = { t: 8, r: 8, b: 22, l: 8 };
  const CW = W - PAD.l - PAD.r, CH = H - PAD.t - PAD.b;
  const TOP = CH * 0.55, BOT_Y = PAD.t + TOP, BOT_H = CH - TOP;

  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);

  const n = features.length;
  const get = key => features.map(b => Number(b[key]) || 0);
  const xAt = i => PAD.l + (i / (n - 1)) * CW;
  const yTop = (v, h) => PAD.t + h * (1 - v);   // energy zone: v in [0,1] → y in [PAD.t, PAD.t+h]
  const yBot = (v, h) => BOT_Y + h * (1 - v);   // bands zone: v in [0,1] → y in [BOT_Y, BOT_Y+BOT_H]

  const energy  = get("energy");
  const novelty = get("novelty");
  const low     = get("low");
  const mid     = get("mid");
  const high    = get("high");

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // Grid lines (horizontal)
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(v => {
    const y = yTop(v, TOP);
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + CW, y); ctx.stroke();
    const y2 = yBot(v, BOT_H);
    ctx.beginPath(); ctx.moveTo(PAD.l, y2); ctx.lineTo(PAD.l + CW, y2); ctx.stroke();
  });

  // Zone divider
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.l, BOT_Y); ctx.lineTo(PAD.l + CW, BOT_Y); ctx.stroke();
  ctx.setLineDash([]);

  // Section boundaries
  sections.forEach(s => {
    const sec = Number(s.start_sec);
    if (!sec) return;
    const x = PAD.l + (sec / (duration || features[n-1].time_sec)) * CW;
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + CH); ctx.stroke();
    ctx.setLineDash([]);
  });

  // Energy fill
  ctx.fillStyle = "rgba(111,85,232,0.10)";
  ctx.beginPath();
  ctx.moveTo(xAt(0), PAD.t + TOP);
  energy.forEach((v, i) => ctx.lineTo(xAt(i), yTop(v, TOP)));
  ctx.lineTo(xAt(n-1), PAD.t + TOP);
  ctx.closePath(); ctx.fill();

  // Draw line helper
  const drawLine = (vals, yFn, h, color, lw = 1.8, dash = []) => {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    vals.forEach((v, i) => i === 0 ? ctx.moveTo(xAt(i), yFn(v, h)) : ctx.lineTo(xAt(i), yFn(v, h)));
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawLine(novelty, yTop, TOP,   "#b8c800", 1.5, [5, 4]);
  drawLine(energy,  yTop, TOP,   "#6f55e8", 2);
  drawLine(low,     yBot, BOT_H, "#888",    1.5);
  drawLine(mid,     yBot, BOT_H, "#2196f3", 2);
  drawLine(high,    yBot, BOT_H, "#ff8a00", 1.5);

  // X-axis time labels
  ctx.fillStyle = "#aaa"; ctx.font = "10px Poppins,sans-serif"; ctx.textAlign = "center";
  const totalSec = duration || features[n-1].time_sec;
  const step = totalSec <= 90 ? 15 : totalSec <= 180 ? 30 : 60;
  for (let t = 0; t <= totalSec; t += step) {
    const x = PAD.l + (t / totalSec) * CW;
    const m = Math.floor(t / 60), s = t % 60;
    ctx.fillText(`${m}:${s.toString().padStart(2,"0")}`, x, H - 5);
  }

  // Zone labels
  ctx.textAlign = "left"; ctx.fillStyle = "#bbb"; ctx.font = "9px Poppins,sans-serif";
  ctx.fillText("energy · novelty", PAD.l + 2, PAD.t + 10);
  ctx.fillText("low · mid · high", PAD.l + 2, BOT_Y + 11);

  // Hover interaction
  const tip = document.getElementById(`${uid}-tip`);
  canvas._spectralCleanup?.();
  const onMove = e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD.l;
    const pct = Math.max(0, Math.min(1, mx / CW));
    const idx = Math.round(pct * (n - 1));
    const bar = features[idx];
    if (!bar || !tip) return;
    const m = Math.floor(bar.time_sec / 60), s = Math.floor(bar.time_sec % 60);
    tip.innerHTML = `<b>${m}:${s.toString().padStart(2,"0")}</b> &nbsp; E <b>${bar.energy?.toFixed(2)}</b> N <b>${bar.novelty?.toFixed(2)}</b> &nbsp; L <b>${bar.low?.toFixed(2)}</b> M <b>${bar.mid?.toFixed(2)}</b> H <b>${bar.high?.toFixed(2)}</b>`;
    tip.style.display = "block";

    // Redraw with cursor line
    ctx.clearRect(0, 0, W, H);
    canvas.dispatchEvent(new Event("_redraw"));
    const cx = xAt(idx);
    ctx.strokeStyle = "rgba(80,80,80,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cx, PAD.t); ctx.lineTo(cx, PAD.t + CH); ctx.stroke();
    [
      [energy[idx],  yTop, TOP,   "#6f55e8"],
      [novelty[idx], yTop, TOP,   "#b8c800"],
      [low[idx],     yBot, BOT_H, "#888"],
      [mid[idx],     yBot, BOT_H, "#2196f3"],
      [high[idx],    yBot, BOT_H, "#ff8a00"],
    ].forEach(([v, fn, h, c]) => {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.arc(cx, fn(v, h), 4, 0, Math.PI * 2); ctx.fill();
    });
  };
  const onLeave = () => {
    if (tip) tip.style.display = "none";
    drawFrame();
  };
  const onClick = e => {
    const rect = canvas.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - PAD.l) / CW));
    const t = pct * totalSec;
    const ws = window._wavesurfers?.[trackId];
    if (ws && ws.getDuration()) ws.seekTo(Math.min(1, t / ws.getDuration()));
  };
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas.addEventListener("click", onClick);
  canvas._spectralCleanup = () => {
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mouseleave", onLeave);
    canvas.removeEventListener("click", onClick);
  };

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    [0.25, 0.5, 0.75].forEach(v => {
      ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, yTop(v, TOP)); ctx.lineTo(PAD.l + CW, yTop(v, TOP)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD.l, yBot(v, BOT_H)); ctx.lineTo(PAD.l + CW, yBot(v, BOT_H)); ctx.stroke();
    });
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(PAD.l, BOT_Y); ctx.lineTo(PAD.l + CW, BOT_Y); ctx.stroke();
    ctx.setLineDash([]);
    sections.forEach(s => {
      const sec = Number(s.start_sec); if (!sec) return;
      const x = PAD.l + (sec / totalSec) * CW;
      ctx.strokeStyle = "rgba(100,100,100,0.2)"; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + CH); ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.fillStyle = "rgba(111,85,232,0.10)";
    ctx.beginPath(); ctx.moveTo(xAt(0), PAD.t + TOP);
    energy.forEach((v, i) => ctx.lineTo(xAt(i), yTop(v, TOP)));
    ctx.lineTo(xAt(n-1), PAD.t + TOP); ctx.closePath(); ctx.fill();
    drawLine(novelty, yTop, TOP,   "#b8c800", 1.5, [5,4]);
    drawLine(energy,  yTop, TOP,   "#6f55e8", 2);
    drawLine(low,     yBot, BOT_H, "#888",    1.5);
    drawLine(mid,     yBot, BOT_H, "#2196f3", 2);
    drawLine(high,    yBot, BOT_H, "#ff8a00", 1.5);
    ctx.fillStyle = "#aaa"; ctx.font = "10px Poppins,sans-serif"; ctx.textAlign = "center";
    for (let t = 0; t <= totalSec; t += step) {
      const x = PAD.l + (t / totalSec) * CW;
      const m = Math.floor(t / 60), s = t % 60;
      ctx.fillText(`${m}:${s.toString().padStart(2,"0")}`, x, H - 5);
    }
    ctx.textAlign = "left"; ctx.fillStyle = "#bbb"; ctx.font = "9px Poppins,sans-serif";
    ctx.fillText("energy · novelty", PAD.l + 2, PAD.t + 10);
    ctx.fillText("low · mid · high", PAD.l + 2, BOT_Y + 11);
  }
  canvas.addEventListener("_redraw", drawFrame);
}

window._wavesurfers = window._wavesurfers || {};

function sectionClass(label = "") {
  return esc(label).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

const SECTION_COLORS = {
  "Intro": "#4a4a5a",
  "Outro": "#4a4a5a",
  "Instrumental": "#3a5a7a",
  "Hook": "#378ADD",
  "Hook Lift": "#1D9E75",
  "Drop": "#c8e600",
  "Drop A": "#c8e600",
  "Drop B": "#b0d400",
  "Drop C": "#98be00",
  "Drop D": "#80a800",
  "Build": "#D85A30",
  "Build Lift": "#BA7517",
  "Break": "#8B4513",
  "Transition": "#EF9F27",
  "Pit": "#1a1a1a",
  "Verse": "#7F77DD",
  "Verse A": "#7F77DD",
  "Verse B": "#9188e0",
  "Verse C": "#a49ae3",
  "Verse D": "#b7ace6",
  "Chorus": "#D4537E",
  "Chorus Lift": "#e07aa0",
  "Pre-Chorus": "#BA7517",
  "Bridge": "#c75fa3",
};
const SECTION_DARK_TEXT = new Set(["Drop", "Drop A", "Drop B", "Drop C", "Drop D", "Transition"]);

function sectionColor(label = "") {
  return SECTION_COLORS[String(label).trim()] || "#636363";
}

function sectionChipStyle(label = "") {
  const bg = sectionColor(label);
  const isDark = SECTION_DARK_TEXT.has(String(label).trim());
  return `background:${bg}22;color:${bg};border-color:${bg}55`;
}

function sectionShortLabel(label = "") {
  const clean = String(label).trim();
  const known = {
    Intro: "I",
    Instrumental: "In",
    Verse: "V",
    "Verse A": "VA",
    "Verse B": "VB",
    "Verse C": "VC",
    "Verse D": "VD",
    Chorus: "C",
    "Chorus Lift": "CL",
    "Pre-Chorus": "PC",
    Bridge: "Br",
    Build: "B",
    "Build Lift": "BL",
    Hook: "H",
    "Hook Lift": "HL",
    Break: "Bk",
    Transition: "T",
    Pit: "P",
    Drop: "D",
    Outro: "O",
  };
  if (known[clean]) return known[clean];
  return clean.split(/\s+/).map(part => part[0]).join("").slice(0, 3).toUpperCase() || "?";
}

// 12-color palette spread across the hue wheel — same indices used in Ableton bridge
const SCENE_PALETTE = [
  "#4C88FF", "#FF5A5A", "#1FBF8A", "#FF8C00",
  "#AA66FF", "#D4B800", "#FF4DB8", "#00BCD4",
  "#FF6B35", "#7CB342", "#E040FB", "#26C6DA",
];

const SCENE_TYPE_PREFIX = {
  "Intro": "I", "Outro": "O", "Instrumental": "In",
  "Hook": "H", "Hook Lift": "HL",
  "Drop": "D", "Drop A": "D", "Drop B": "D", "Drop C": "D", "Drop D": "D",
  "Build": "B", "Build Lift": "BL",
  "Break": "Br", "Transition": "T", "Pit": "P",
  "Verse": "V", "Verse A": "V", "Verse B": "V", "Verse C": "V", "Verse D": "V",
  "Chorus": "C", "Chorus Lift": "CL", "Pre-Chorus": "PC", "Bridge": "Bg",
};

function buildSceneLabels(sections) {
  const prefixes = sections.map(s => {
    const l = String(s.label || "").trim();
    return SCENE_TYPE_PREFIX[l] || l.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  });
  const counts = {};
  prefixes.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
  const idx = {};
  return prefixes.map(p => {
    if (counts[p] === 1) return p;
    idx[p] = (idx[p] || 0) + 1;
    return p + idx[p];
  });
}

const DIM_STEPS = [1, 0.82, 0.66, 0.52];

function renderSectionMap(sections = [], duration = 0, options = {}) {
  if (!sections.length) return empty("Аудио ещё не анализировалось");
  const zoom = Number(options.zoom || 1);
  const minWidth = Number(options.minWidth || Math.round(Number(options.baseWidth || 1100) * zoom));
  const jsString = (value) => JSON.stringify(String(value ?? "")).replace(/'/g, "\\x27").replace(/</g, "\\x3C");
  const clickAttr = (section) => {
    const sec = Number(section.start_sec) || 0;
    if (options.noteDemoId && options.noteTrackId) {
      const demoId = jsString(options.noteDemoId);
      const trackId = jsString(options.noteTrackId);
      const label = jsString(section.label || "");
      const seek = options.trackId ? `playCompareSection(${jsString(options.trackId)}, ${sec});` : "";
      return `onclick='fillDemoReferenceNoteTime(${demoId}, ${trackId}, ${sec}, ${label}); ${seek}'`;
    }
    if (options.demoId) return `onclick="demoPLayerSeek('${options.demoId}', ${sec})"`;
    if (options.trackId) return `onclick="playCompareSection('${options.trackId}', ${sec})"`;
    return "";
  };
  const sceneLabels = options.sceneLabels ? buildSceneLabels(sections) : null;
  const labels = sections.map((section, index) => {
    const left = duration ? (Number(section.start_sec) / duration) * 100 : 0;
    const width = duration ? Math.max(1.4, ((Number(section.end_sec) - Number(section.start_sec)) / duration) * 100) : 10;
    const displayLabel = sceneLabels ? sceneLabels[index] : section.label;
    const shortLabel = sceneLabels ? displayLabel : sectionShortLabel(section.label);
    const labelClass = width < 7 ? "tiny" : width < 13 ? "compact" : "";
    const title = `${section.label} ${formatSeconds(section.start_sec)} – ${formatSeconds(section.end_sec)}`;
    return `<div class="section-tick ${labelClass} ${(options.trackId || options.demoId) ? "clickable" : ""}" ${clickAttr(section)} title="${esc(sceneLabels ? `${displayLabel}: ${title}` : title)}" style="left:${left}%;width:${width}%">
      <strong><span class="full-label">${esc(displayLabel)}</span><span class="short-label">${esc(shortLabel)}</span></strong>
      <small>${formatSeconds(section.start_sec)} – ${formatSeconds(section.end_sec)}</small>
    </div>`;
  }).join("");
  return `<div class="section-map-scroll ${options.large ? "large" : ""}">
    <div class="section-map" style="min-width:${minWidth}px">
      ${options.ruler ? `<div class="section-ruler"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>` : ""}
      <div class="section-track">
        ${(() => { const counts = {}; return sections.map((section, idx) => {
          const left = duration ? (Number(section.start_sec) / duration) * 100 : 0;
          const width = duration ? Math.max(1.4, ((Number(section.end_sec) - Number(section.start_sec)) / duration) * 100) : 10;
          if (sceneLabels) {
            const bg = SCENE_PALETTE[idx % SCENE_PALETTE.length];
            return `<div class="section-segment ${(options.trackId || options.demoId) ? "clickable" : ""}" ${clickAttr(section)} title="${esc(section.label)} ${formatSeconds(section.start_sec)} – ${formatSeconds(section.end_sec)}" style="left:${left}%;width:${width}%;background:${bg}"></div>`;
          }
          const key = section.label;
          counts[key] = (counts[key] || 0) + 1;
          const dimClass = counts[key] % 2 === 0 ? "dim" : "";
          return `<div class="section-segment ${sectionClass(section.label)} ${dimClass} ${(options.trackId || options.demoId) ? "clickable" : ""}" ${clickAttr(section)} title="${esc(section.label)} ${formatSeconds(section.start_sec)} – ${formatSeconds(section.end_sec)}" style="left:${left}%;width:${width}%"></div>`;
        }).join(""); })()}
      </div>
      <div class="section-labels">${labels}</div>
    </div>
  </div>`;
}

function renderAudioAnalysisPanel(track) {
  const analysis = track.audio_analysis;
  const sections = analysis?.sections || [];
  const songSections = analysis?.song_sections || [];
  const microSections = analysis?.micro_sections || [];
  const features = analysis?.bar_features || [];
  const duration = Number(analysis?.duration_sec || track.audio_duration_sec || 0);
  const timeline = renderSectionMap(sections, duration, { zoom: 1.15, baseWidth: 980, sceneLabels: true });
  const songTimeline = songSections.length ? renderSectionMap(songSections, duration, { zoom: 1.15, baseWidth: 980, sceneLabels: true }) : "";
  const microTimeline = microSections.length ? renderSectionMap(microSections, duration, { zoom: 1.15, baseWidth: 980, sceneLabels: true }) : "";

  return `<section class="detail-section audio-analysis-panel">
    <div class="section-head"><h2>Audio Analysis</h2><span class="audio-status ${esc(track.audio_status || "missing")}">${esc(track.audio_status || "missing")}</span></div>
    <form class="mini-form audio-form" onsubmit="attachAudioPath(event,'${track.id}')">
      <div class="audio-drop-zone" ondragover="handleAudioDrag(event, true)" ondragleave="handleAudioDrag(event, false)" ondrop="handleAudioDrop(event, '${track.id}')">
        ${audioPathEditorHtml({ id: audioInputId(track.id), value: track.audio_path || "", placeholder: "C:\\Users\\smallochko\\Downloads\\track.mp3" })}
        <div class="audio-path-actions">
          <button type="button" class="ghost" onclick="browseAudioPath('${track.id}')">Browse…</button>
          <button class="ghost">Attach audio path</button>
          <button type="button" class="primary" onclick="analyzeAudio('${track.id}', this)">Analyze</button>
        </div>
        <input id="audio-browse-${track.id}" class="hidden-file-input" type="file" accept=".mp3,.wav,.aiff,.aif,.flac,audio/*" onchange="handleAudioBrowse(this, '${track.id}')">
        <p class="field-hint">Browse загрузит локальную копию в приложение. Drag-and-drop / ручной путь сохраняют абсолютный путь без копирования.</p>
      </div>
    </form>
    ${analysis?.error ? `<div class="empty">Ошибка анализа: ${esc(analysis.error)}</div>` : ""}
    ${track.audio_path ? `${songmasterQuickActions("reference", track.id)}${songmasterSectionHtml("reference", track.id)}` : ""}
    ${midiSectionHtml("reference", track.id)}
    ${analysis && !analysis.error ? `<div class="analysis-summary">
      <span><strong>${esc(analysis.estimated_bpm)}</strong>BPM</span>
      <span><strong>${esc(analysis.bars)}</strong>bars</span>
      <span><strong>${formatSeconds(analysis.duration_sec)}</strong>duration</span>
      <span><strong>${esc(analysis.summary?.drop_count ?? 0)}</strong>drops</span>
      <span><strong>${esc(analysis.label_profile || "song")}</strong>profile</span>
    </div>
    <div class="analysis-actions">
      <button class="ghost" onclick="openTrackInCompare('${track.id}')">Open in Compare</button>
      <button class="ghost" onclick="exportAbletonGuide('${track.id}')">Export Ableton guide</button>
      <button class="ghost ableton-btn" onclick="openAbletonPushDialog('${track.id}')">&#9654; Send to Ableton</button>
    </div>
    ${songTimeline ? `<h3>Song form</h3>${songTimeline}` : ""}
    <h3>Energy structure</h3>
    ${timeline}
    ${microTimeline ? `<details class="micro-detail-panel"><summary>Energy detail</summary>${microTimeline}</details>` : ""}
    ${features.length ? `<h3>Spectral overview</h3>${renderSpectralChart(features, sections.concat(songSections), track.id, duration)}` : ""}
    <div class="section-head"><h3>Detected sections</h3><button class="text-btn" onclick="createMarkersFromAnalysis('${track.id}')">Create markers from analysis</button></div>
    <table class="sections-table"><thead><tr><th>Label</th><th>Time</th><th>Bars</th><th>Energy</th><th>Novelty</th><th>Confidence</th></tr></thead><tbody>
      ${sections.map(section => `<tr><td>${esc(section.label)}</td><td>${formatSeconds(section.start_sec)} – ${formatSeconds(section.end_sec)}</td><td>${esc(section.start_bar)}–${esc(section.end_bar)}</td><td>${Number(section.energy).toFixed(2)}</td><td>${Number(section.novelty).toFixed(2)}</td><td>${Number(section.confidence).toFixed(2)}</td></tr>`).join("")}
    </tbody></table>
    <ul class="analysis-notes">${(analysis.summary?.arrangement_notes || []).map(note => `<li>${esc(note)}</li>`).join("")}</ul>` : timeline}
  </section>`;
}

function audioInputId(trackId) {
  return `audio-path-${trackId}`;
}

function setAudioPath(trackId, value) {
  const input = document.querySelector(`#${CSS.escape(audioInputId(trackId))}`);
  if (!input || !value) return false;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function isUsableLocalAudioPath(value = "") {
  return /^[a-zA-Z]:\\/.test(value) && !value.toLowerCase().includes("\\fakepath\\");
}

function warnAboutHiddenAudioPath() {
  toast("Браузер скрыл полный путь. Используйте Browse для загрузки копии файла или вставьте полный путь C:\\... вручную.");
}

function audioPathFromDrop(event) {
  const uri = event.dataTransfer?.getData("text/uri-list")?.split("\n").find(line => line && !line.startsWith("#"));
  const text = event.dataTransfer?.getData("text/plain")?.trim();
  const file = event.dataTransfer?.files?.[0];
  if (uri?.startsWith("file:///")) return decodeURIComponent(uri.replace("file:///", "")).replaceAll("/", "\\");
  if (text) return text.replace(/^file:\/\/\//, "").replaceAll("/", "\\");
  return file?.path || file?.name || "";
}

function handleAudioDrag(event, active) {
  event.preventDefault();
  event.currentTarget.classList.toggle("drag-over", active);
}

function handleAudioDrop(event, trackId) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  const value = audioPathFromDrop(event);
  if (!setAudioPath(trackId, value)) {
    toast("Не удалось получить путь. Скопируйте путь к файлу и вставьте его в поле.");
    return;
  }
  if (!isUsableLocalAudioPath(value)) {
    warnAboutHiddenAudioPath();
    return;
  }
  attachAudioPathById(trackId);
}

function browseAudioPath(trackId) {
  document.querySelector(`#audio-browse-${CSS.escape(trackId)}`)?.click();
}

async function handleAudioBrowse(input, trackId) {
  const file = input.files?.[0];
  if (!file) return;
  const value = file.path || input.value || file.name || "";
  setAudioPath(trackId, value);
  if (file.path && isUsableLocalAudioPath(file.path)) {
    attachAudioPathById(trackId);
    return;
  }
  const data = new FormData();
  data.append("file", file);
  try {
    await apiUpload(`/references/${trackId}/audio-upload`, data);
    toast("Audio file загружен и прикреплён");
    openTrack(trackId);
  } catch (error) {
    toast(error.message);
  } finally {
    input.value = "";
  }
}

function formatSeconds(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function attachAudioPath(event, trackId) {
  event.preventDefault();
  await attachAudioPathById(trackId, event.target);
}

async function attachAudioPathById(trackId, form = null) {
  const targetForm = form || document.querySelector(`#${CSS.escape(audioInputId(trackId))}`)?.closest("form");
  if (!targetForm) return;
  const data = Object.fromEntries(new FormData(targetForm));
  if (!isUsableLocalAudioPath(data.audio_path || "")) {
    warnAboutHiddenAudioPath();
    return;
  }
  try {
    await api(`/references/${trackId}/audio-path`, { method: "POST", body: JSON.stringify(data) });
    toast("Audio path прикреплён");
    openTrack(trackId);
  } catch (error) {
    toast(error.message);
  }
}

async function analyzeAudio(trackId, button) {
  const input = document.querySelector(`#${CSS.escape(audioInputId(trackId))}`);
  if (input && input.value && !isUsableLocalAudioPath(input.value)) {
    warnAboutHiddenAudioPath();
    return;
  }
  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = "Analyzing…";
  try {
    await api(`/references/${trackId}/analyze-audio`, { method: "POST" });
    toast("Аудио проанализировано");
    openTrack(trackId);
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
}

async function createMarkersFromAnalysis(trackId) {
  const markers = await api(`/references/${trackId}/audio-analysis/markers`, { method: "POST" });
  toast(`Создано markers: ${markers.length}`);
  openTrack(trackId);
}

function openTrackInCompare(trackId) {
  const dialog = document.querySelector("#track-dialog");
  if (dialog?.open) dialog.close();
  showView("compare", { skipAutoLoad: true });
  loadCompare(trackId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openAbletonPushDialog(trackId) {
  const dialog = document.querySelector("#ableton-push-dialog");
  const form = document.querySelector("#ableton-push-form");
  if (!dialog || !form) return;

  window._openTrackCache = window._openTrackCache || {};
  let track = window._openTrackCache[trackId];
  if (!track) {
    try {
      track = await api(`/references/${trackId}`);
      window._openTrackCache[trackId] = track;
    } catch (_) { track = null; }
  }
  const analysis = track?.audio_analysis;
  const bpmInput = form.querySelector("[name=target_bpm]");
  const durInput = form.querySelector("[name=target_duration]");
  const keepBpm = form.querySelector("[name=keep_bpm]");
  const keepDur = form.querySelector("[name=keep_duration]");
  const includeAudioInput = form.querySelector("[name=include_audio]");
  const fromAbletonBtn = form.querySelector(".ableton-tempo-btn");

  const refBpm = Number(analysis?.estimated_bpm || 120).toFixed(2);
  const refDurSec = Math.round(analysis?.duration_sec || 0);
  const refDurStr = `${Math.floor(refDurSec / 60)}:${String(refDurSec % 60).padStart(2, "0")}`;

  // Always start with track's own BPM and duration, and audio export off
  bpmInput.value = refBpm;
  durInput.value = refDurStr;
  includeAudioInput.checked = false;
  restoreAbletonFormState(form);

  const applyKeepBpm = () => {
    bpmInput.disabled = keepBpm.checked;
    if (keepBpm.checked) bpmInput.value = refBpm;
  };
  const applyKeepDur = () => {
    durInput.disabled = keepDur.checked;
    if (keepDur.checked) durInput.value = refDurStr;
  };
  applyKeepBpm();
  applyKeepDur();

  keepBpm.onchange = applyKeepBpm;
  keepDur.onchange = applyKeepDur;

  if (fromAbletonBtn) {
    fromAbletonBtn.onclick = async () => {
      fromAbletonBtn.textContent = "…";
      fromAbletonBtn.disabled = true;
      try {
        const data = await api("/ableton/tempo");
        bpmInput.value = Number(data.tempo).toFixed(2);
        keepBpm.checked = false;
        bpmInput.disabled = false;
      } catch (err) {
        toast(`Не удалось получить BPM: ${err.message}`);
      } finally {
        fromAbletonBtn.textContent = "← Ableton";
        fromAbletonBtn.disabled = false;
      }
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button.primary");
    btn.textContent = "Pushing…";
    btn.disabled = true;
    try {
      saveAbletonFormState(form);
      const includeAudio = form.querySelector("[name=include_audio]").checked;
      const payload = {
        structure: form.querySelector("[name=structure]").value,
        target_bpm: keepBpm.checked ? null : parseFloat(bpmInput.value),
        target_duration_sec: keepDur.checked ? null : parseDurationInput(durInput.value),
        include_audio: includeAudio,
      };
      btn.textContent = includeAudio ? "Нарезаю аудио…" : "Pushing…";
      const data = await api(`/references/${trackId}/ableton-push-guide`, { method: "POST", body: JSON.stringify(payload) });
      dialog.close();
      const audioNote = data.audio_folder ? " · папка с аудио открыта в Проводнике" : "";
      const failedNote = data.sections_failed ? ` · не удалось создать: ${data.sections_failed}` : "";
      const warnNote = data.warnings?.length ? " · есть предупреждения (см. консоль)" : "";
      toast(`✓ Ableton: «${data.track}» создан (${data.sections} секций${failedNote}${warnNote}${audioNote})`);
      if (data.sections_failed) console.warn("Ableton clip errors:", data.clip_errors);
      if (data.warnings?.length) console.warn("Ableton warnings:", data.warnings);
    } catch (err) {
      toast(`Ошибка: ${err.message}`);
    } finally {
      btn.textContent = "▶ Push to Ableton";
      btn.disabled = false;
    }
  };

  dialog.showModal();
}

async function fixAbletonWarp(btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    const data = await api("/ableton/fix-warp", { method: "POST" });
    toast(`✓ Warp выключен на ${data.fixed} клипах`);
  } catch (err) {
    toast(`Ошибка: ${err.message}`);
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function exportAbletonGuide(trackId) {
  try {
    const data = await api(`/export/reference/${trackId}/ableton-guide`, { method: "POST" });
    toast(`Guide exported: ${data.json_path}`);
  } catch (error) {
    toast(error.message);
  }
}

async function loadCompare(preselectId = "") {
  const tracks = await api("/references");
  const source = preselectId ? "" : (document.querySelector("#compare-source-filter")?.value ?? "spotify");
  const analyzed = tracks.filter(track => track.audio_status === "analyzed" && (!source || track.source === source));
  const selected = new Set(preselectId ? [preselectId] : analyzed.slice(0, Math.min(2, analyzed.length)).map(track => track.id));
  document.querySelector("#compare-reference-list").innerHTML = `<details class="compare-picker-details">
    <summary>Выбор треков <span>${selected.size || 0} selected · ${analyzed.length} analyzed</span></summary>
    <div class="compare-reference-list-inner">${analyzed.map(track => `
    <label class="compare-pick">
      <input type="checkbox" value="${track.id}" ${selected.has(track.id) ? "checked" : ""} onchange="limitCompareSelection(this); updateComparePickerCount()">
      ${track.cover_url ? `<img src="${esc(track.cover_url)}" alt="">` : `<span class="compare-cover-fallback"></span>`}
      <span><strong>${esc(track.artist)} — ${esc(track.title)}</strong><small>${formatSeconds(track.audio_duration_sec)} · ${esc(track.audio_filename || "analyzed")}</small></span>
    </label>`).join("") || empty(source === "spotify" ? "Нет проанализированных Spotify-референсов. Переключите source на All/Suno, если нужно." : "Сначала проанализируйте хотя бы один референс")}</div>
  </details>`;
  if (selected.size >= 1) runReferenceCompare();
}

function limitCompareSelection(input) {
  const checked = [...document.querySelectorAll("#compare-reference-list input:checked")];
  if (checked.length > 12) {
    input.checked = false;
    toast("Можно сравнить максимум 12 референсов");
  }
}

function updateComparePickerCount() {
  const details = document.querySelector(".compare-picker-details summary span");
  if (!details) return;
  const checked = document.querySelectorAll("#compare-reference-list input:checked").length;
  const total = document.querySelectorAll("#compare-reference-list input").length;
  details.textContent = `${checked} selected · ${total} analyzed`;
}

async function runReferenceCompare() {
  const ids = [...document.querySelectorAll("#compare-reference-list input:checked")].map(input => input.value);
  if (ids.length < 1 || ids.length > 12) {
    toast("Выберите 1–12 analyzed references");
    return;
  }
  const query = ids.map(id => `ids=${encodeURIComponent(id)}`).join("&");
  const data = await api(`/references/audio-analysis/compare?${query}`);
  renderCompareWorkspace(data);
}

function compareViewportWidth() {
  const workspace = document.querySelector("#compare-workspace");
  return Math.max(900, Math.round((workspace?.clientWidth || window.innerWidth || 1200) - 50));
}

function compareWidth(zoom = compareZoom) {
  return Math.max(compareViewportWidth(), Math.round(compareBaseWidth * Number(zoom || 1)));
}

function renderCompareWorkspace(data) {
  if (!data) return;
  const slider = document.querySelector("#compare-zoom");
  if (slider) compareZoom = Number(slider.value || compareZoom);
  const zoom = compareZoom;
  const width = compareWidth(zoom);
  const rows = data.tracks.map(track => `
    <article class="compare-track-row">
      <div class="compare-track-title">
        <div>
          <strong>${esc(track.artist)} — ${esc(track.title)}</strong>
          <small>${formatSeconds(track.duration_sec)} · ${esc(track.estimated_bpm)} BPM · ${track.sections.length} sections · ${esc(track.label_profile || "song")} profile</small>
        </div>
        <div class="compact-actions">
          <button class="text-btn" onclick="exportAbletonGuide('${track.id}')">Export guide</button>
          <button class="ghost ableton-btn" onclick="openAbletonPushDialog('${track.id}')">&#9654; Send to Ableton</button>
          ${track.has_audio ? `<button class="ghost songmaster-btn" onclick="openInSongmaster('${track.id}')">${ICONS.note} SongMaster</button>` : ""}
          ${track.has_audio ? muscriptorButton("reference", track.id) : ""}
        </div>
      </div>
      ${track.song_sections?.length ? `<p class="map-caption">Song form</p>${renderSectionMap(track.song_sections, track.duration_sec, { zoom, minWidth: width, large: true, trackId: track.id, ruler: true, sceneLabels: true })}<p class="map-caption">Energy structure</p>` : ""}
      ${renderSectionMap(track.sections, track.duration_sec, { zoom, minWidth: width, large: true, trackId: track.id, ruler: true, sceneLabels: true })}
      ${renderComparePlayer(track, zoom, width)}
      ${track.micro_sections?.length ? `<details class="compare-curves-panel micro-detail-panel"><summary>Energy detail</summary>${renderSectionMap(track.micro_sections, track.duration_sec, { zoom, minWidth: width, large: true, trackId: track.id, ruler: true, sceneLabels: true })}</details>` : ""}
      ${track.bar_features?.length ? `<details class="compare-curves-panel"><summary>Spectral overview</summary>${renderSpectralChart(track.bar_features, (track.sections||[]).concat(track.song_sections||[]), track.id + "-cmp", track.duration_sec)}</details>` : ""}
      ${stemsSectionHtml("reference", track.id)}
      ${midiSectionHtml("reference", track.id)}
      ${track.has_audio ? songmasterSectionHtml("reference", track.id) : ""}
    </article>`).join("");
  document.querySelector("#compare-workspace").innerHTML = `
    <section class="compare-workspace panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">NORMALIZED 0–100%</p>
          <h2>Structure Map</h2>
        </div>
        <label class="zoom-control">Zoom <small>slider only for now</small>
          <input id="compare-zoom" type="range" min="0.75" max="3.4" step="0.05" value="${zoom}" oninput="setCompareZoom(this.value)">
        </label>
      </div>
      <div class="compare-metrics">${renderCompareMetrics(data)}</div>
      ${rows}
    </section>`;
  window.lastCompareData = data;
  requestAnimationFrame(() => {
    initAllWaveSurfers(data.tracks);
    // Init spectral charts when their <details> are opened
    document.querySelectorAll(".compare-curves-panel:not(.stems-panel):not(.songmaster-panel)").forEach(details => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const container = details.querySelector("[id^='sc-']");
        if (container) initSpectralChart(container.id);
      }, { once: false });
    });
    initStemsPanels(document.querySelector("#compare-workspace"));
    initMidiPanels(document.querySelector("#compare-workspace"));
    initSongmasterPanels(document.querySelector("#compare-workspace"));
  });
}

function setCompareZoom(value) {
  compareZoom = Math.max(0.75, Math.min(3.4, Number(value) || 0.75));
  if (compareZoomFrame) cancelAnimationFrame(compareZoomFrame);
  compareZoomFrame = requestAnimationFrame(() => {
    compareZoomFrame = 0;
    renderCompareWorkspace(window.lastCompareData);
  });
}

function renderCompareMetrics(data) {
  const intro = data.comparison.intro_lengths_sec.map(item => `<span><strong>${formatSeconds(item.intro_sec)}</strong>${esc(item.title)} intro</span>`).join("");
  const drops = data.comparison.drop_positions_pct.map(item => `<span><strong>${item.positions.map(value => `${Math.round(value)}%`).join(", ") || "—"}</strong>${esc(item.title)} drops</span>`).join("");
  const pits = data.comparison.pit_counts.map(item => `<span><strong>${item.pit_count}</strong>${esc(item.title)} pits</span>`).join("");
  return `${intro}${drops}${pits}`;
}

function renderComparePlayer(track, zoom = compareZoom, width = compareWidth(zoom)) {
  const sections = track.sections || [];
  const chipLabels = buildSceneLabels(sections);
  const chips = sections.map((section, index) =>
    `<button type="button" title="${esc(`${chipLabels[index]}: ${section.label}`)}" style="${sectionChipStyle(section.label)}" onclick="playCompareSection('${track.id}', ${Number(section.start_sec) || 0})">${esc(chipLabels[index])} <small>${formatSeconds(section.start_sec)}</small></button>`
  ).join("");
  const duration = Number(track.duration_sec || track.audio_duration_sec || 0);
  const demoMarkers = renderDemoWaveMarkers(track.demoMarkers || [], duration, track.id);
  return `<div class="compare-player">
    <div class="ws-player">
      <div class="ws-controls">
        <button class="ws-play-btn" id="ws-play-${track.id}" onclick="wsPlayPause('${track.id}')">&#9654;</button>
        <button class="ws-stop-btn" title="Stop" onclick="wsStop('${track.id}')">■</button>
        <span class="ws-time" id="ws-time-${track.id}">0:00 / ${formatSeconds(duration)}</span>
        <label class="ws-volume" title="Volume">
          <span>Vol</span>
          <input type="range" min="0" max="1" step="0.01" value="${getSavedWaveVolume()}" oninput="wsSetVolume('${track.id}', this.value)">
        </label>
        <button type="button" class="icon-mini" title="Открыть папку с файлом" onclick="revealAudioInFolder('reference','${track.id}', this)">${ICONS.folder}</button>
      </div>
      <div class="ws-wave-shell">
        <div id="ws-${track.id}" class="ws-wave"></div>
        ${demoMarkers}
      </div>
    </div>
    <div class="section-jump-row">${chips}</div>
  </div>`;
}

function wsPlayPause(trackId) {
  const ws = window._waveSurfers?.[trackId];
  if (ws) ws.playPause();
}

function wsStop(trackId) {
  const ws = window._waveSurfers?.[trackId];
  if (!ws) return;
  ws.pause();
  ws.seekTo(0);
  const btn = document.querySelector(`#ws-play-${trackId}`);
  if (btn) btn.innerHTML = "&#9654;";
}

function getSavedWaveVolume() {
  const value = Number(localStorage.getItem(WS_VOLUME_LS_KEY));
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.85;
}

function wsSetVolume(trackId, value) {
  const volume = Math.max(0, Math.min(1, Number(value) || 0));
  localStorage.setItem(WS_VOLUME_LS_KEY, String(volume));
  const ws = window._waveSurfers?.[trackId];
  if (ws) ws.setVolume(volume);
}

function initAllWaveSurfers(tracks) {
  if (!window.WaveSurfer) return;
  window._waveSurfers = window._waveSurfers || {};
  for (const track of tracks) {
    const container = document.querySelector(`#ws-${track.id}`);
    if (!container) continue;
    if (window._waveSurfers[track.id]) {
      try { window._waveSurfers[track.id].destroy(); } catch (_) {}
    }
    const ws = WaveSurfer.create({
      container,
      url: `/api/references/${track.id}/audio-file`,
      waveColor: "#7F77DD",
      progressColor: "#22C55E",
      height: 64,
      barWidth: 3,
      barGap: 1,
      barRadius: 2,
      interact: true,
    });
    window._wavesurfers = window._wavesurfers || {};
    window._wavesurfers[track.id] = ws;
    ws.setVolume(getSavedWaveVolume());
    ws.on("timeupdate", (time) => {
      const dur = ws.getDuration() || track.duration_sec || 1;
      const el = document.querySelector(`#ws-time-${track.id}`);
      if (el) el.textContent = `${formatSeconds(time)} / ${formatSeconds(dur)}`;
    });
    ws.on("play", () => {
      const btn = document.querySelector(`#ws-play-${track.id}`);
      if (btn) btn.innerHTML = "&#9646;&thinsp;&#9646;";
    });
    ws.on("pause", () => {
      const btn = document.querySelector(`#ws-play-${track.id}`);
      if (btn) btn.innerHTML = "&#9654;";
    });
    ws.on("finish", () => {
      const btn = document.querySelector(`#ws-play-${track.id}`);
      if (btn) btn.innerHTML = "&#9654;";
    });
    window._waveSurfers[track.id] = ws;
  }
}

function waveformPeaks(features = [], targetCount = 160) {
  if (!features.length) return Array.from({ length: targetCount }, () => 0.15);
  const values = features.map(item => Math.max(Number(item.energy) || 0, Number(item.onset) || 0, Number(item.novelty) || 0));
  const result = [];
  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor((index / targetCount) * values.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / targetCount) * values.length));
    result.push(Math.max(...values.slice(start, end)));
  }
  return result;
}

function seekCompareWave(event, trackId, duration) {
  const audio = document.querySelector(`#audio-${CSS.escape(trackId)}`);
  const wrap = event.currentTarget;
  if (!audio || !duration) return;
  const rect = wrap.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audio.currentTime = pct * duration;
  syncComparePlayhead(trackId);
}

function playCompareSection(trackId, seconds) {
  const ws = window._waveSurfers?.[trackId];
  if (ws) {
    const dur = ws.getDuration() || 1;
    ws.seekTo(Math.max(0, Math.min(1, (Number(seconds) || 0) / dur)));
    ws.play();
    return;
  }
  const audio = document.querySelector(`#audio-${CSS.escape(trackId)}`);
  if (!audio) return;
  audio.currentTime = Math.max(0, Number(seconds) || 0);
  audio.play().catch(() => toast("Нажмите play в аудио-плеере, браузер заблокировал автозапуск"));
}

function syncComparePlayhead(trackId) {
  const audio = document.querySelector(`#audio-${CSS.escape(trackId)}`);
  const playhead = document.querySelector(`#playhead-${CSS.escape(trackId)}`);
  if (!audio || !playhead || !audio.duration) return;
  playhead.style.left = `${Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100))}%`;
}

function renderNormalizedCurve(features = [], key, color, zoom = 1, width = compareWidth(zoom)) {
  if (!features.length) return "";
  const height = 54;
  const points = features.map(feature => {
    const x = (Number(feature.position_pct || 0) / 100) * width;
    const y = height - (Number(feature[key]) || 0) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return `<svg class="compare-curve" viewBox="0 0 ${width} ${height}" style="min-width:${width}px;width:${width}px" preserveAspectRatio="none">
    <polyline points="${points}" stroke="${color}"></polyline>
  </svg>`;
}

document.querySelector("#add-reference-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true; button.textContent = "Получаю metadata…";
  const data = Object.fromEntries(new FormData(event.target)); data.tags = data.tags.split(",").map(x=>x.trim()).filter(Boolean);
  try {
    const track = await api("/references/import/spotify", { method: "POST", body: JSON.stringify(data) });
    event.target.closest("dialog").close(); event.target.reset(); toast("Референс добавлен"); loadDashboard(); loadReferences(); openTrack(track.id);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = "Получить metadata и сохранить"; }
});

document.querySelector("#add-local-reference-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  const button = event.submitter;
  const data = new FormData();
  const files = form.querySelector("[name=file]").files;
  if (!files.length) { toast("Выберите аудио или zip"); return; }
  renderLocalUploadPreview(files, true);
  [...files].forEach(file => data.append("file", file));
  for (const [key, value] of new FormData(form).entries()) {
    if (key !== "file") data.append(key, value);
  }
  if (!form.querySelector("[name=analyze]").checked) data.set("analyze", "false");
  button.disabled = true;
  const prev = button.textContent;
  button.textContent = "Uploading…";
  try {
    const result = await apiUpload("/references/import/local-audio", data);
    const created = result.created || [result];
    form.closest("dialog").close();
    form.reset();
    form.querySelector("[name=artist]").value = "Suno";
    form.querySelector("[name=tags]").value = "suno, generated, candidate";
    renderLocalUploadPreview([]);
    toast(`Импортировано: ${created.length}`);
    loadDashboard();
    loadReferences();
    if (created[0]?.id) openTrack(created[0].id);
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = prev;
  }
});

document.querySelector("#add-demo-form").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.bpm = Number(data.bpm);
  const demo = await api("/demos", { method: "POST", body: JSON.stringify(data) });
  currentDemoId = demo.id;
  event.target.reset();
  event.target.querySelector("[name=bpm]").value = 120;
  event.target.closest("dialog").close();
  toast("Новая песня создана");
  showView("demo");
  loadDashboard();
});

const titles = { dashboard: "Сегодня в фокусе", references: "Библиотека референсов", compare: "Сравнение референсов", ideas: "Банк идей", demo: "Мои демо и песни", lab: "Лаборатория эскизов", "deep-listen": "Deep Listen" };
function showView(name, options = {}) {
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("active", x.id === `${name}-view`));
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.view === name));
  document.querySelector("#page-title").textContent = titles[name];
  const action = document.querySelector("#global-action");
  if (name === "demo") {
    action.style.display = "";
    action.textContent = "+ Новая песня";
    action.onclick = openAddDemo;
  } else if (name === "lab") {
    action.style.display = "";
    action.textContent = "+ Новый эскиз";
    action.onclick = createLabSketch;
  } else if (name === "compare" || name === "deep-listen") {
    action.style.display = "none";
    action.onclick = null;
  } else {
    action.style.display = "";
    action.textContent = "+ Добавить референс";
    action.onclick = openAddReference;
  }
  if (name === "references") loadReferences();
  if (name === "compare" && !options.skipAutoLoad) loadCompare();
  if (name === "ideas") loadIdeas();
  if (name === "demo") loadDemo();
  if (name === "lab") loadLab();
  if (name === "deep-listen") loadDeepListenPage();
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
      <div id="lab-scale-strip" class="lab-scale-strip">${labScaleHtml(advice)}</div>
      <div id="lab-drawer-scrim" class="lab-drawer-scrim" hidden onclick="closeLabDrawers()"></div>
      <aside id="lab-voices-drawer" class="lab-drawer" hidden aria-hidden="true" aria-label="Голоса и микшер">
        <div class="lab-drawer-head"><strong>Голоса, выход и микшер</strong><button type="button" class="lab-drawer-close" onclick="closeLabDrawers()" aria-label="Закрыть">×</button></div>
        <div id="lab-voices-bar" class="lab-voices-bar">${labVoicesBarHtml(advice)}</div>
      </aside>
      <div id="lab-analysis">${labAnalysisHtml(advice)}</div>
      <details class="panel lab-text-inputs"><summary>Ввод текстом и заметки</summary>
        <label class="lab-main-field">Аккорды <small>через пробел или тире</small><textarea id="lab-chords" rows="2" placeholder="Bbmaj13/D Am/E C Dm" onchange="persistLabChordText()">${esc(sketch.chord_input)}</textarea></label>
        <label class="lab-main-field">Мелодия <small>нота:длительность, например D4:1 F4:.5 A4:.5</small><textarea id="lab-melody" rows="2" oninput="queueLabFieldSave()">${esc(melodyNotesToText(sketch.melody))}</textarea></label>
        <label class="lab-main-field">Заметка<textarea id="lab-notes" rows="2" oninput="queueLabFieldSave()">${esc(sketch.notes)}</textarea></label>
      </details>
      <section><div class="section-head"><div><p class="eyebrow">TRY IT NOW</p><h2>Три контрастных действия</h2></div></div><div class="lab-actions">${actions}</div></section>
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
  if (!advice.chords?.length) return `<section class="lab-analysis-empty"><strong>Анализ появится после ввода аккордов</strong><span>Выбранная тональность останется авторским контекстом.</span></section>`;
  return `<section class="lab-analysis-panel"><div class="lab-analysis-head"><div><p class="eyebrow">HARMONY ANALYSIS</p><h3>Что слышно в материале</h3></div><span class="lab-analysis-status ${analysis.matches_declared ? "match" : "mismatch"}">${esc(status)}</span></div><div class="lab-analysis-grid"><article><small>ВЫБРАНО</small><strong>${esc(analysis.declared || advice.key.label)}</strong><span>${esc(advice.key.characteristic)}</span></article><article><small>РАСПОЗНАНО ПО АККОРДАМ</small><strong>${inferred ? `${esc(inferred.label)} · ${Math.round(inferred.score * 100)}%` : "Недостаточно материала"}</strong><span>${inferred ? esc(inferred.evidence) : "Добавьте хотя бы два аккорда"}</span>${alternatives ? `<details><summary>Другие гипотезы</summary>${alternatives}</details>` : ""}</article><article><small>КРАСКИ ЦИФЕРБЛАТА</small><div class="lab-color-list">${colors || `<span class="field-hint">Пары пока не распознаны</span>`}</div></article></div>${transitions ? `<details class="lab-transition-details"><summary>Переходы по циферблату · ${advice.transitions.length}</summary><ul>${transitions}</ul></details>` : ""}</section>`;
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
      <span class="lab-row-track" data-midi="${row.midi}" onpointerdown="labRowPointerDown(event,${row.midi})">${notes}</span></div>`;
  }).join("");

  // The chord block is the control: drag to move, drag the edge to resize,
  // click to hear it. No buttons to squeeze into a one-beat card.
  const lane = (advice.chords || []).map((chord, index) => [chord, index])
    .filter(([chord]) => inSystem(chord.start))
    .map(([chord, index]) => `<article class="lab-lane-chord ${index === window.labSelectedChordIndex ? "selected" : ""} ${chord.diatonic === false ? "is-outside" : ""}" style="--start:${chord.start - offset};--len:${chord.beats};--deg:${labChromaColor(chord.chroma)}" data-chord="${index}" onpointerdown="labChordPointerDown(event,${index})" title="${esc(chord.symbol)} · ${esc(chord.degree)} · ${chord.beats} доли — тяните, чтобы двигать; за края — растянуть">
      <b class="lab-chord-grip lab-chord-grip-left"></b>
      <span class="lab-lane-name"><b>${esc(chord.degree)}</b><strong>${esc(chord.symbol)}</strong></span>
      <b class="lab-chord-grip lab-chord-grip-right"></b></article>`).join("");

  const loop = window.labLoop;
  const from = loop ? Math.max(loop.from, offset) : 0;
  const to = loop ? Math.min(loop.to, offset + span) : 0;
  const loopBand = loop && to > from
    ? `<i class="lab-loop" style="--from:${from - offset};--len:${to - from}" title="Луп ${loop.from}–${loop.to} доли"><b onpointerdown="event.stopPropagation();clearLabLoop()" title="Убрать луп">×</b></i>`
    : "";

  return `<div class="lab-score lab-system" data-offset="${offset}" style="--beats:${span};--bar:${beatsPerBar};--beat:${labBeatWidth()}px;--snap:${window.labSnapBeats || 0.5}">
      <div class="lab-score-inner">
        <i class="lab-playhead" data-playhead="${systemIndex}" style="--pos:0" hidden></i>
        <i class="lab-marquee" data-marquee="${systemIndex}" hidden></i>
        <div class="lab-ruler"><span class="lab-row-label">луп</span><span class="lab-row-track" onpointerdown="labLoopPointerDown(event)" title="Протяните по линейке, чтобы задать луп">${bars}${loopBand}</span></div>
        <div class="lab-rows">${rows || `<p class="field-hint">Сетка появится после выбора лада</p>`}</div>
        <div class="lab-lane-row"><span class="lab-row-label">Гармония</span><span class="lab-row-track" onpointerdown="labLaneBackgroundDown(event)" ondblclick="labLaneDblClick(event)" title="Двойной клик — палитра аккордов">${lane}</span></div>
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
  ["m11", "m11"], ["13", "13"], ["sus2", "sus2"], ["sus4", "sus4"], ["add9", "add9"],
  ["7(b9)", "7♭9"], ["7(#9)", "7♯9"], ["m7(b5)", "ø"], ["dim7", "°7"], ["maj7(#11)", "△♯11"],
];

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
  window.labPair = { index, active: "b", a: chord.symbol, b: bSym, mood: null, aMidi: [], bMidi: [] };
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

function setLabPairActive(side) { if (window.labPair) { window.labPair.active = side; labRenderPairDial(); } }
function setLabPairRoot(root, minor) {
  const p = window.labPair; if (!p) return;
  p[p.active] = minor ? root + "m" : root;
  labRenderPairDial(); refreshLabPair();
}
function setLabPairQual(qual) {
  const p = window.labPair; if (!p) return;
  p[p.active] = pairSplit(p[p.active]).root + qual;
  labRenderPairDial(); refreshLabPair();
}

async function refreshLabPair() {
  const p = window.labPair; if (!p) return;
  try {
    const res = await api("/pair-mood", { method: "POST", body: JSON.stringify({ a: p.a, b: p.b }) });
    if (!window.labPair) return;
    p.mood = res.mood; p.aMidi = res.a?.midi || []; p.bMidi = res.b?.midi || [];
    labRenderPairMood();
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
  const aMaj = q => !isMin(q); // treat dim/aug/sus as sitting on the major seat
  const cells = PAIR_FIFTHS.map((maj, i) => {
    const rel = pairRelMinor(maj);
    const majPc = PAIR_PC[maj]; const minPc = PAIR_PC[rel.slice(0, -1)];
    const majA = aPc === majPc && aMaj(aRoot.qual), minA = aPc === minPc && isMin(aRoot.qual);
    const majB = bPc === majPc && aMaj(bRoot.qual), minB = bPc === minPc && isMin(bRoot.qual);
    return `<div class="lab-pair-cell" style="--angle:${i * 30}deg;--counter:${-i * 30}deg">
      <button type="button" class="lab-pair-maj ${majA ? "is-a" : ""} ${majB ? "is-b" : ""}" onclick="setLabPairRoot('${maj}',false)">${maj}</button>
      <button type="button" class="lab-pair-min ${minA ? "is-a" : ""} ${minB ? "is-b" : ""}" onclick="setLabPairRoot('${rel.slice(0, -1)}',true)">${rel}</button>
    </div>`;
  }).join("");
  return `<div class="lab-pair-wheel">${cells}<div class="lab-pair-center"><b id="lab-pair-clock">—</b><small>А → B</small></div></div>`;
}

function labChordChipRow(side) {
  const p = window.labPair;
  const cur = pairSplit(p[side]).qual;
  return `<div class="lab-pair-quals">${PAIR_QUALS.map(([q, label]) =>
    `<button type="button" class="${cur === q ? "active" : ""}" onclick="setLabPairActive('${side}');setLabPairQual('${q}')">${label}</button>`).join("")}</div>`;
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
          <div id="lab-pair-mood" class="lab-pair-mood"></div>
          <div class="lab-pair-actions">
            <button type="button" class="lab-tool-btn" onclick="playLabPair()">▶ Сыграть пару</button>
            <button type="button" class="lab-tool-btn lab-pair-insert" onclick="insertLabPairAfter()">Вставить B после A</button>
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
      selectLabChord(index);
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
  deselectLabChord(event);
}

/** Drag across the ruler to mark a loop; playback then repeats that span. */
function labLoopPointerDown(event) {
  if (event.target.closest(".lab-loop b")) return;
  event.preventDefault();
  const track = event.currentTarget;
  const from = labSnap(labTrackBeats(track, event.clientX));
  let to = from;
  const onMove = pointer => {
    to = labSnap(labTrackBeats(track, pointer.clientX));
    const band = document.querySelector(".lab-loop") || (() => {
      const node = document.createElement("i");
      node.className = "lab-loop";
      node.innerHTML = `<b onpointerdown="event.stopPropagation();clearLabLoop()" title="Убрать луп">×</b>`;
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
    window.labLoop = { from: Math.min(from, to), to: Math.min(from, to) + span };
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
    else if (key === "x") { event.preventDefault(); labCut(); }
    else if (key === "v") { event.preventDefault(); labPaste(); }
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

function labToolbarHtml(sketch) {
  return `<div class="lab-tool-group lab-tool-transport">
      <button type="button" class="lab-tool-play" onclick="labPlayScore(this)" aria-label="Проиграть эскиз">▶</button>
      <button type="button" class="lab-tool-stop" onclick="labStopScore()" aria-label="Стоп">■</button>
    </div>
    <label class="lab-tool-title"><input id="lab-title" value="${esc(sketch.title)}" oninput="queueLabFieldSave()" aria-label="Название эскиза"></label>
    ${labTonicPicker(sketch.tonic)}
    <label class="lab-meta-field"><span class="lab-field-label">Лад</span><select id="lab-mode" onchange="patchLabContext({mode:this.value})">${labModeOptions(sketch.mode)}</select></label>
    ${labBpmPicker(sketch.bpm)}
    <label class="lab-meta-field"><span class="lab-field-label">Размер</span><select id="lab-meter" onchange="patchLabContext({meter:this.value})">${LAB_METERS.map(item => `<option value="${item}" ${item === sketch.meter ? "selected" : ""}>${item}</option>`).join("")}</select></label>
    <div class="lab-tool-group lab-tool-actions">
      <span id="lab-save-state" class="lab-save-state">сохранено</span>
      ${labFocusMode() ? `<button class="ghost" onclick="window.close()">Закрыть окно</button>` : `<button class="ghost" onclick="openLabFocus()" title="Открыть редактор в отдельном окне на весь экран">⤢ Развернуть</button>`}
      <button class="ghost" onclick="deleteLabSketch()">Удалить</button>
    </div>`;
}

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
      <button type="button" class="lab-tool-btn" onclick="exportLabMidi(this)" title="Экспорт MIDI: создаёт .mid по частям и открывает папку — файлы можно перетащить в DAW">↧ MIDI</button>
    </div>
    <div class="lab-tool-group lab-tool-actions">
      ${labFocusMode() ? `<button type="button" class="lab-tool-btn" onclick="window.close()">Закрыть</button>` : `<button type="button" class="lab-tool-btn" onclick="openLabFocus()" title="Открыть редактор на весь экран">⤢</button>`}
      <button type="button" class="lab-tool-btn lab-tool-danger" onclick="deleteLabSketch()" title="Удалить эскиз">🗑</button>
    </div>
    <span id="lab-save-state" class="lab-save-state lab-visually-hidden" aria-live="polite">сохранено</span>`;
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

async function labCut() {
  const advice = window.currentLabAdvice;
  if (window.labInspector === "note" && window.labSelectedNote != null) {
    window.labClipboardNote = (advice?.melody || [])[window.labSelectedNote];
    if (!window.labClipboardNote) return;
    return labNoteEdit("delete", { index: window.labSelectedNote });
  }
  const chord = labSelectedChord(advice);
  if (!chord) return toast("Нечего вырезать: ничего не выбрано");
  window.labClipboardChord = chord.symbol;
  await labEdit("delete", "", window.labSelectedChordIndex);
}

async function labPaste() {
  if (window.labInspector === "note" && window.labClipboardNote) {
    const note = window.labClipboardNote;
    return labNoteEdit("add", { pitch: note.pitch, start: note.start, duration: note.duration, voice: note.voice });
  }
  if (!window.labClipboardChord) return toast("Буфер пуст");
  await putLabChord(window.labClipboardChord);
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

/** Selection is local first: only the suggestion palette needs the server. */
async function selectLabChord(index) {
  const wasNote = window.labInspector === "note";
  window.labInspector = "chord";
  setLabContextMode("chord");
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
  const loop = window.labLoop;
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
  const loop = window.labLoop;
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
  const loop = window.labLoop;
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
  showView("lab");
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

// ── Deep Listen page ────────────────────────────────────────────────────────

async function loadDeepListenPage() {
  const container = document.getElementById("deep-listen-content");
  if (!container) return;
  container.innerHTML = `<div class="empty">Загружаю список треков…</div>`;
  const tracks = await api("/references?per_page=200");
  const source = window.deepListenSourceFilter ?? "spotify";
  const withAudio = (tracks.items || tracks).filter(t => t.audio_path && (!source || t.source === source));
  if (!withAudio.length) {
    container.innerHTML = `<div class="dl-page-toolbar">${renderDeepListenSourceFilter(source)}</div><div class="empty">Нет треков с аудио для выбранного source. Переключите фильтр или прикрепите аудио в Референсах → Analyze.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="dl-page-toolbar">${renderDeepListenSourceFilter(source)}</div>
    <div class="dl-page-layout">
      <aside class="dl-sidebar">
        <p class="eyebrow" style="padding:0 4px 10px">ТРЕКИ С АУДИО</p>
        <div class="dl-track-list">
          ${withAudio.map(t => `
            <button class="dl-track-item" data-id="${t.id}" onclick="openDeepListenTrack('${t.id}')">
              ${t.cover_url ? `<img src="${esc(t.cover_url)}" width="36" height="36" style="border-radius:6px;flex-shrink:0">` : `<div style="width:36px;height:36px;background:var(--line);border-radius:6px;flex-shrink:0"></div>`}
              <div style="min-width:0"><div style="font-weight:700;font-size:0.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.artist)}</div><div style="font-size:0.75rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</div></div>
            </button>`).join("")}
        </div>
      </aside>
      <div class="dl-main" id="dl-main">
        <div class="empty" style="margin-top:80px">← Выберите трек слева</div>
      </div>
    </div>`;
}

function renderDeepListenSourceFilter(value = "spotify") {
  return `<label class="compact-filter">Source
    <select onchange="window.deepListenSourceFilter=this.value; loadDeepListenPage()">
      <option value="spotify" ${value === "spotify" ? "selected" : ""}>Spotify</option>
      <option value="" ${value === "" ? "selected" : ""}>All with audio</option>
      <option value="suno" ${value === "suno" ? "selected" : ""}>Suno</option>
      <option value="udio" ${value === "udio" ? "selected" : ""}>Udio</option>
      <option value="local" ${value === "local" ? "selected" : ""}>Local</option>
      <option value="my_export" ${value === "my_export" ? "selected" : ""}>My exports</option>
    </select>
  </label>`;
}

function _refDeepCacheKey(trackId) { return `dl_ref_${trackId}`; }
function _refDeepCacheGet(trackId) {
  window._deepCache = window._deepCache || {};
  if (window._deepCache[trackId]?.analysis) return window._deepCache[trackId];
  try {
    const v = localStorage.getItem(_refDeepCacheKey(trackId));
    if (v) { const p = JSON.parse(v); window._deepCache[trackId] = p; return p; }
  } catch(_) {}
  return null;
}
function _refDeepCacheSet(trackId, track, analysis) {
  window._deepCache = window._deepCache || {};
  const entry = { track, analysis };
  window._deepCache[trackId] = entry;
  try { localStorage.setItem(_refDeepCacheKey(trackId), JSON.stringify(entry)); } catch(_) {}
}

window._deepCache = window._deepCache || {};

async function openDeepListenTrack(trackId, forceRefresh = false) {
  document.querySelectorAll(".dl-track-item").forEach(b => b.classList.toggle("active", b.dataset.id === trackId));
  const main = document.getElementById("dl-main");
  if (!main) return;

  // show cached result immediately
  const cached = _refDeepCacheGet(trackId);
  if (!forceRefresh && cached?.analysis) {
    const { track, analysis } = cached;
    main.innerHTML = renderDeepListenPage(track, analysis);
    requestAnimationFrame(() => initDeepListenPlayer(trackId));
    return;
  }

  // load track meta, show preview + run button (no analysis yet)
  main.innerHTML = `<div class="empty" style="font-size:0.85rem">Загружаю…</div>`;
  try {
    const track = await api(`/references/${trackId}`);
    window._deepCache[trackId] = { track, analysis: null };
    main.innerHTML = renderDeepListenPreview(track);
  } catch (e) {
    main.innerHTML = `<div class="empty">Ошибка: ${esc(e.message || String(e))}</div>`;
  }
}

async function runDeepListenAnalysis(trackId) {
  const main = document.getElementById("dl-main");
  if (!main) return;
  const cached = window._deepCache?.[trackId];
  const track = cached?.track;
  main.innerHTML = `<div class="dl-analyzing">
    <span class="pulse"></span> Анализирую ${track ? `<strong>${esc(track.artist)} — ${esc(track.title)}</strong>` : ""}…
    <p class="field-hint" style="margin-top:8px">Займёт ~10–30 сек</p>
  </div>`;
  try {
    const deepResp = await api(`/references/${trackId}/deep-analysis`);
    _refDeepCacheSet(trackId, track, deepResp.analysis);
    main.innerHTML = renderDeepListenPage(track, deepResp.analysis);
    requestAnimationFrame(() => initDeepListenPlayer(trackId));
  } catch (e) {
    main.innerHTML = `<div class="empty">Ошибка: ${esc(e.message || String(e))}</div>`;
  }
}

function renderDeepListenPreview(track) {
  return `
    <div class="dl-preview">
      ${track.cover_url ? `<img src="${esc(track.cover_url)}" class="dl-preview-cover" alt="">` : `<div class="dl-preview-cover dl-preview-cover-empty"></div>`}
      <div class="dl-preview-info">
        <p class="eyebrow">${esc(track.source || "TRACK")}</p>
        <h2>${esc(track.artist)}</h2>
        <h3>${esc(track.title)}</h3>
        ${track.album ? `<p class="dl-label">${esc(track.album)}</p>` : ""}
      </div>
      <button class="primary dl-run-btn" onclick="runDeepListenAnalysis('${track.id}')">
        ▶ Run Deep Listen
      </button>
      <p class="field-hint" style="text-align:center;margin-top:8px">Анализирует groove, harmony, timbre, emotion и структуру паттернов</p>
    </div>`;
}

function renderDeepListenPage(track, a) {
  return `
    <div class="dl-page-header">
      <strong>${esc(track.artist)}</strong> — ${esc(track.title)}
      <span class="audio-status analyzed" style="margin-left:10px">deep-listen</span>
      <button class="ghost" style="margin-left:auto;font-size:0.78rem" onclick="openDeepListenTrack('${track.id}',true)">↺ Re-analyze</button>
    </div>
    ${a ? renderDeepListenFull(track.id, a) : `<div class="empty">Нет данных анализа</div>`}`;
}

function renderDeepPlayer(trackId) {
  const uid = `dl-ws-${trackId}`;
  return `
    <div class="ws-player dl-player" style="margin:20px 0 4px">
      <div class="ws-controls">
        <button id="dl-play-${trackId}" class="ws-play-btn" onclick="toggleDeepPlayer('${trackId}')">&#9654;</button>
        <span id="dl-time-${trackId}" class="ws-time">0:00 / --</span>
        <div class="ws-volume" style="margin-left:auto">
          <span>VOL</span>
          <input type="range" min="0" max="1" step="0.02" value="0.8"
            oninput="setDeepVolume('${trackId}',this.value)"
            style="width:90px;accent-color:#6f55e8">
        </div>
      </div>
      <div class="ws-wave"><div id="${uid}"></div></div>
    </div>`;
}

function initDeepListenPlayer(trackId, audioUrl = null) {
  if (!window.WaveSurfer) return;
  const uid = `dl-ws-${trackId}`;
  const container = document.getElementById(uid);
  if (!container) return;
  window._dlSurfers = window._dlSurfers || {};
  if (window._dlSurfers[trackId]) { try { window._dlSurfers[trackId].destroy(); } catch(_) {} }
  const ws = WaveSurfer.create({
    container,
    url: audioUrl || `/api/references/${trackId}/audio-file`,
    waveColor: "#6f55e8",
    progressColor: "#d7ff43",
    height: 64, barWidth: 3, barGap: 1, barRadius: 2,
  });
  window._dlSurfers[trackId] = ws;
  ws.setVolume(0.8);
  ws.on("timeupdate", time => {
    const el = document.getElementById(`dl-time-${trackId}`);
    if (el) el.textContent = `${formatSeconds(time)} / ${formatSeconds(ws.getDuration() || 0)}`;
  });
  ws.on("play",   () => { const b = document.getElementById(`dl-play-${trackId}`); if (b) b.innerHTML = "&#9646;&thinsp;&#9646;"; });
  ws.on("pause",  () => { const b = document.getElementById(`dl-play-${trackId}`); if (b) b.innerHTML = "&#9654;"; });
  ws.on("finish", () => { const b = document.getElementById(`dl-play-${trackId}`); if (b) b.innerHTML = "&#9654;"; });
}

function toggleDeepPlayer(trackId) {
  const ws = window._dlSurfers?.[trackId];
  if (ws) ws.playPause();
}

function setDeepVolume(trackId, val) {
  const ws = window._dlSurfers?.[trackId];
  if (ws) ws.setVolume(parseFloat(val));
}

function renderDeepListenFull(trackId, a) {
  const g = a.groove, h = a.harmony, t = a.timbre, e = a.emotion, s = a.structure;
  const pct = v => `${Math.round(v * 100)}%`;
  const bar = (v, color) => `<div class="dl-bar-wrap"><div class="dl-bar" style="width:${pct(Math.min(1, v))};background:${color}"></div><span>${pct(Math.min(1, v))}</span></div>`;

  // convert structure sections to section-map format
  const mapSections = s.sections.map(sec => ({
    label: sec.label,
    start_sec: sec.start,
    end_sec: sec.end,
  }));
  const PATTERN_PALETTE = ["#6f55e8","#d7ff43cc","#22c55e","#ff8a00","#e066ff","#2196f3","#f4a261","#7bc4a0","#c084fc","#60a5fa"];
  const labelColors = {};
  let colorIdx = 0;
  mapSections.forEach(sec => { if (!labelColors[sec.label]) labelColors[sec.label] = PATTERN_PALETTE[colorIdx++ % PATTERN_PALETTE.length]; });

  const duration = a.duration_sec;
  const structureMap = `
    <div class="section-map-scroll">
      <div class="section-map" style="min-width:900px">
        <div class="section-track">
          ${mapSections.map(sec => {
            const left = (sec.start_sec / duration) * 100;
            const width = Math.max(1.4, ((sec.end_sec - sec.start_sec) / duration) * 100);
            return `<div class="section-segment clickable" onclick="seekDeepPlayer('${trackId}', ${sec.start_sec})" title="${esc(sec.label)} ${formatSeconds(sec.start_sec)} – ${formatSeconds(sec.end_sec)}" style="left:${left}%;width:${width}%;background:${labelColors[sec.label]}"></div>`;
          }).join("")}
        </div>
        <div class="section-labels">
          ${mapSections.map(sec => {
            const left = (sec.start_sec / duration) * 100;
            const width = Math.max(1.4, ((sec.end_sec - sec.start_sec) / duration) * 100);
            const labelClass = width < 7 ? "tiny" : width < 13 ? "compact" : "";
            return `<div class="section-tick ${labelClass} clickable" onclick="seekDeepPlayer('${trackId}', ${sec.start_sec})" style="left:${left}%;width:${width}%"><strong>${esc(sec.label)}</strong><small>${formatSeconds(sec.start_sec)}</small></div>`;
          }).join("")}
        </div>
      </div>
    </div>`;

  return `
  <div class="deep-listen-grid" style="margin-top:0">
    <div class="dl-card">
      <div class="dl-card-title">Groove</div>
      <div class="dl-stat"><span>${g.tempo_bpm} BPM</span><span class="dl-label">tempo</span></div>
      <div class="dl-stat"><span class="dl-tag">${esc(g.pocket)}</span><span class="dl-label">pocket</span></div>
      <div class="dl-field">Pulse stability</div>${bar(g.pulse_stability, "var(--accent,#6f55e8)")}
      <div class="dl-field">Swing proxy</div>${bar(g.swing_proxy, "#e88")}
    </div>
    <div class="dl-card">
      <div class="dl-card-title">Harmony</div>
      <div class="dl-stat"><span class="dl-tag">${esc(h.key_estimate)}</span><span class="dl-label">key</span></div>
      <div class="dl-stat"><span class="dl-tag ${h.tension_score > 0.55 ? 'dl-tag-warn' : ''}">${esc(h.tension_description)}</span><span class="dl-label">tension</span></div>
      <div class="dl-field">Key clarity</div>${bar(h.key_clarity, "#7cb9e8")}
      <div class="dl-field">Tension</div>${bar(h.tension_score, h.tension_score > 0.55 ? "#e88" : "#a8d8a0")}
    </div>
    <div class="dl-card">
      <div class="dl-card-title">Timbre</div>
      ${t.descriptor_tags.map(tag => `<span class="dl-tag">${esc(tag)}</span> `).join("")}
      <div class="dl-field" style="margin-top:10px">Low end</div>${bar(t.low_end_ratio / 0.4, "#c9a")}
      <div class="dl-field">Air ratio</div>${bar(Math.min(1, t.air_ratio / 0.2), "#9ac")}
      <div class="dl-field">Dynamic range</div>${bar(Math.min(1, t.dynamic_range / 0.1), "#aac")}
    </div>
    <div class="dl-card dl-card-wide">
      <div class="dl-card-title">Emotion</div>
      <p class="dl-overview">${esc(e.overview)}</p>
      <div class="dl-emotion-row">
        <div><div class="dl-field">Arousal</div>${bar(e.arousal, "#f4a261")}<span class="dl-label">${esc(e.energy_word)}</span></div>
        <div><div class="dl-field">Valence</div>${bar(e.valence, "#7bc4a0")}<span class="dl-label">${esc(e.color_word)}</span></div>
        <div><div class="dl-field">Tension</div>${bar(e.tension, "#e07")}&#8203;</div>
      </div>
      <ul class="dl-reasons">${e.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    </div>
    <div class="dl-card dl-card-wide">
      <div class="dl-card-title">Structure — pattern analysis <span class="dl-label" style="font-size:0.75rem;margin-left:8px">${esc(s.structure_summary)} · ${s.section_count} sections${s.repeated_sections.length ? " · repeats: " + s.repeated_sections.join(", ") : ""}</span></div>
      ${structureMap}
      <div class="dl-pattern-legend">${Object.entries(labelColors).map(([lbl, col]) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${col};margin-right:4px;vertical-align:middle"></i>${esc(lbl)}</span>`).join("")}</div>
      <p class="field-hint" style="margin-top:8px">${esc(s.analysis_notes[0])} Click a section to seek.</p>
      ${renderDeepPlayer(trackId)}
    </div>
  </div>`;
}

function seekDeepPlayer(trackId, sec) {
  const ws = window._dlSurfers?.[trackId];
  if (ws) ws.seekTo(sec / (ws.getDuration() || 1));
}
document.querySelectorAll("[data-view], [data-view-link]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view || button.dataset.viewLink)));

if (!applyLabFocusMode()) loadDashboard();

// ── Анализ гармонии по ПТМ-26 (отдельная панель, не трогает остальные) ──

const PTM_CATS = {
  1: { c: "#5da648", t: "#2f6b22" },
  2: { c: "#2f9ed6", t: "#145f88" },
  3: { c: "#8f63d8", t: "#5a3a99" },
  4: { c: "#d97286", t: "#a03a52" },
  5: { c: "#cf4437", t: "#8f2a20" },
};
const PTM_FN_COLORS = { T: "#2f6b22", S: "#a06d1f", D: "#a03a3a" };
const PTM_CLOCK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const PTM_PLAY_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>`;
const ptmReports = {};

function ptmSectionHtml(ownerType, ownerId) {
  const containerId = `ptm-${ownerType}-${ownerId}`;
  return `<details class="compare-curves-panel ptm-panel" data-owner-type="${esc(ownerType)}" data-owner-id="${esc(ownerId)}">
    <summary>${PTM_CLOCK_ICON} Анализ гармонии (ПТМ)</summary>
    <div id="${containerId}" class="ptm-body"><p class="field-hint">Раскройте, чтобы проанализировать…</p></div>
  </details>`;
}

function initPtmPanels(root) {
  (root || document).querySelectorAll(".ptm-panel").forEach(panel => {
    if (panel.dataset.bound) return;
    panel.dataset.bound = "1";
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      loadPtmData(panel.dataset.ownerType, panel.dataset.ownerId);
    });
  });
}

async function loadPtmData(ownerType, ownerId) {
  const container = document.getElementById(`ptm-${ownerType}-${ownerId}`);
  if (!container) return;
  container.innerHTML = `<p class="field-hint">Анализирую гармонию…</p>`;
  try {
    const path = ownerType === "demo" ? `/demos/${ownerId}/ptm-analysis` : `/references/${ownerId}/ptm-analysis`;
    const report = await api(path);
    renderPtmReport(container, `${ownerType}-${ownerId}`, report);
  } catch (error) {
    container.innerHTML = `<p class="field-hint">Ошибка: ${esc(error.message)}</p>`;
  }
}

function ptmModeRu(mode) {
  return mode === "minor" ? "минор" : "мажор";
}

function ptmSourceLabel(source) {
  return source === "simple" ? "27 простых" : source === "classes" ? "14 классов"
    : source === "cine" ? "Кино" : "Доп. каталог";
}

function ptmMatchBadges(matches) {
  if (!matches?.length) return `<span class="ptm-badge ptm-badge-none">нет в каталоге ПТМ</span>`;
  return matches.map(m => {
    const source = esc(ptmSourceLabel(m.source));
    const roman = esc(m.roman || "");
    const showName = (m.source === "cine" || m.source === "extended") && m.name && m.name !== m.roman;
    const name = showName ? `<span class="ptm-badge-name">${esc(m.name)}</span>` : "";
    const count = m.count > 1 ? `<span class="ptm-badge-count">${m.count}×</span>` : "";
    const separator = `<span class="ptm-badge-sep" aria-hidden="true">·</span>`;
    return `<span class="ptm-badge ptm-badge-${esc(m.source)}" title="${esc(m.mood || "")}">
      <span class="ptm-badge-source">${source}</span>${roman ? `${separator}<span class="ptm-badge-roman">${roman}</span>` : ""}${name ? separator + name : ""}${count ? separator + count : ""}
    </span>`;
  }).join("");
}

function ptmChordChip(chord) {
  const fn = chord.function || "";
  const fnColor = PTM_FN_COLORS[fn[0]] || "#8a8677";
  const title = `${chord.original}${fn ? ` · функция ${fn}` : " · вне лада"} · ${chord.roman}`;
  return `<span class="ptm-chord" title="${esc(title)}">
    <strong>${esc(chord.name)}</strong>
    <small>${esc(chord.roman)}${fn ? ` <i style="color:${fnColor}">${esc(fn)}</i>` : ""}</small>
  </span>`;
}

function ptmTransitionBtn(key, i, tr) {
  const pair = tr.pair;
  const onclick = `ptmPlayTransition('${esc(key)}', ${i})`;
  if (tr.same_root) {
    return `<button class="ptm-tr ptm-tr-dot" title="${esc(tr.approx.join("; "))}" aria-label="Смена окраски аккорда" onclick="${onclick}">·</button>`;
  }
  const cat = pair ? PTM_CATS[pair.category] : null;
  const approxMark = tr.approx.length ? " ptm-tr-approx" : "";
  const title = pair
    ? `${pair.highlighted ? "(!) " : ""}${pair.mood} — ${tr.clock}${tr.approx.length ? "\n≈ " + tr.approx.join("; ") : ""}`
    : tr.move
      ? `${tr.move.name} — ${tr.move.mood} (${tr.clock}, доп. каталог)`
      : `Вне таблицы 46 пар — ${tr.clock}${tr.approx.length ? "\n" + tr.approx.join("; ") : ""}`;
  if (!cat) {
    if (tr.move) {
      return `<button class="ptm-tr ptm-tr-ext${approxMark}" title="${esc(title)}" onclick="${onclick}">${esc(tr.clock.slice(3))}</button>`;
    }
    return `<button class="ptm-tr ptm-tr-unknown${approxMark}" title="${esc(title)}" onclick="${onclick}">${esc(tr.clock.slice(3))}</button>`;
  }
  return `<button class="ptm-tr${approxMark}" style="--c:${cat.c};--ct:${cat.t}" title="${esc(title)}" onclick="${onclick}">${esc(tr.clock.slice(3))}</button>`;
}

function renderPtmReport(container, key, report) {
  if (report.found === false) {
    container.innerHTML = `<p class="field-hint">Нет данных SongMaster для этого файла — сначала откройте трек в SongMaster и сохраните проект.</p>`;
    return;
  }
  if (report.error) {
    container.innerHTML = `<p class="field-hint">${esc(report.error)}</p>`;
    return;
  }
  ptmReports[key] = report;
  const t = report.tonic;
  const tfg = report.tfg;

  const stats = [
    ["Тоника", `${t.name} ${ptmModeRu(t.mode)}${t.hint ? (t.agrees_with_hint ? " ✓" : ` · SM: ${t.hint}`) : ""}`],
    ["Гармония", `${tfg.verdict} · ${Math.round(tfg.diatonic_share * 100)}% диатоники`],
    tfg.final_cadence ? ["Каденция", tfg.final_cadence] : null,
    report.bpm ? ["BPM", String(Math.round(report.bpm))] : null,
  ].filter(Boolean).map(([label, value]) =>
    `<div class="ptm-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("");

  const moods = report.mood_summary.map(m => {
    const cat = PTM_CATS[m.category];
    return `<span class="ptm-pill"><i style="background:${cat.c}"></i>${esc(m.category_name)} · ${Math.round(m.share * 100)}%</span>`;
  }).join("");

  // лента по секциям SongMaster
  const groups = [];
  report.chords.forEach((chord, i) => {
    const label = chord.section || "";
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(i);
  });
  const timeline = groups.map(group => {
    const row = group.items.map(i => {
      const chip = ptmChordChip(report.chords[i]);
      const connector = i < report.chords.length - 1 && report.transitions[i]
        ? ptmTransitionBtn(key, i, report.transitions[i]) : "";
      return chip + connector;
    }).join("");
    const label = group.label ? `<span class="ptm-sec-label" title="Секция SongMaster">${esc(group.label)}</span>` : "";
    return `<div class="ptm-section">${label}<div class="ptm-rowline">${row}</div></div>`;
  }).join("");

  const loops = report.loops.map((loop, i) => {
    const variants = (loop.variants || []).length
      ? `<details class="ptm-variants"><summary>варианты · ${loop.variants.length}</summary>
          <ul>${loop.variants.map(v => `<li>
            <code>${esc(v.chords.join(" – "))}</code>
            <small>${esc(v.roman)} · ${v.count}×${v.relation ? ` · ${esc(v.relation)}` : ""}</small>
          </li>`).join("")}</ul>
        </details>`
      : "";
    return `<article class="ptm-loop">
      <div class="ptm-loop-head">
        <button class="ptm-play" aria-label="Прослушать луп" onclick="ptmPlayLoop('${esc(key)}', ${i})">${PTM_PLAY_ICON}</button>
        <strong>${esc(loop.chords.join(" – "))}</strong>
        <span class="ptm-count">${loop.count}×</span>
      </div>
      <small class="ptm-roman-line">${esc(loop.roman)}</small>
      <div class="ptm-badges">${ptmMatchBadges(loop.matches)}</div>
      ${variants}
    </article>`;
  }).join("");

  const catalogRows = report.catalog_matches.slice(0, 8).map(m =>
    `<li>${ptmMatchBadges([m])}${m.mood ? ` <small>${esc(m.mood)}</small>` : ""}</li>`).join("");

  const unknown = report.unrecognized.transitions;
  const unknownBlock = unknown.length
    ? `<details class="ptm-unknown"><summary>Нераспознанные переходы · ${unknown.length} — кандидаты на дополнение теории</summary>
        <ul>${unknown.map(u => `<li><code>${esc(u.from)} → ${esc(u.to)}</code> <small>${esc(u.clock)}${u.approx.length ? ` · ${esc(u.approx.join("; "))}` : ""}</small></li>`).join("")}</ul>
      </details>`
    : "";

  container.innerHTML = `
    <div class="ptm-meta">${stats}
      <button class="ghost ptm-stop" onclick="ptmAudio.stopAll()" aria-label="Остановить звук">■ Стоп</button>
    </div>
    <div class="ptm-moods">${moods}</div>
    <div class="ptm-timeline">${timeline}</div>
    ${report.loops.length ? `<h4 class="ptm-h">Лупы · семейства</h4><div class="ptm-loops">${loops}</div>` : ""}
    ${catalogRows ? `<h4 class="ptm-h">Совпадения с каталогом</h4><ul class="ptm-catalog">${catalogRows}</ul>` : ""}
    ${unknownBlock}
    <p class="field-hint">Клик по времени между аккордами — сыграть переход, по лупу — сыграть круг (истинные аккорды, с надстройками). ≈ пунктир — настроение пары определено по упрощённому трезвучию.</p>`;
}

function ptmBeatSec(key) {
  const bpm = ptmReports[key]?.bpm;
  if (!bpm) return 1.1;
  return Math.min(1.6, Math.max(0.45, 120 / bpm));
}

function ptmPlayTransition(key, index) {
  const report = ptmReports[key];
  if (!report) return;
  const midis = [report.chords[index].midis, report.chords[index + 1].midis];
  ptmAudio.playChords(midis, { beatSec: ptmBeatSec(key) });
}

function ptmPlayLoop(key, loopIndex) {
  const report = ptmReports[key];
  if (!report) return;
  const loop = report.loops[loopIndex];
  const midis = report.chords.slice(loop.start, loop.start + loop.chords.length).map(c => c.midis);
  ptmAudio.playChords(midis, { beatSec: ptmBeatSec(key) });
}
