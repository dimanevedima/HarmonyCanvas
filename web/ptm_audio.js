// Синтезатор для проигрывания аккордов из анализа ПТМ (порт audio.js из
// theory-приложения). Реальный рояль подгружается через soundfont-player;
// если CDN недоступен — тихий фолбэк на Web Audio-синтез.
window.ptmAudio = (() => {
  let ctx = null;
  let master = null;
  let activeTimers = [];
  let activeNodes = [];
  let piano = null;
  let pianoLoading = false;
  let pianoFailed = false;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      loadPiano();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function loadPiano() {
    if (pianoLoading || pianoFailed || piano) return;
    pianoLoading = true;
    Promise.race([
      import("https://esm.sh/soundfont-player@0.10.7").then(mod =>
        mod.default.instrument(ctx, "acoustic_grand_piano", { destination: master })),
      new Promise((_, reject) => setTimeout(() => reject(new Error("piano load timeout")), 8000)),
    ])
      .then(inst => { piano = inst; })
      .catch(() => { pianoFailed = true; })
      .finally(() => { pianoLoading = false; });
  }

  const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  function playSynthNote(midi, t, dur, vol) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc2.type = "sine";
    osc.frequency.value = midiToFreq(midi);
    osc2.frequency.value = midiToFreq(midi) * 2.001;
    filt.type = "lowpass";
    filt.frequency.value = 2200;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(vol * 0.55, t + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filt); osc2.connect(filt);
    filt.connect(gain); gain.connect(master);
    osc.start(t); osc2.start(t);
    osc.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
    activeNodes.push(osc, osc2);
  }

  function playNote(midi, when, dur, vol = 0.22) {
    const c = ensureCtx();
    const t = c.currentTime + when;
    if (piano) {
      try {
        piano.play(midi, t, { duration: dur, gain: vol / 0.22 });
        return;
      } catch (e) { /* сэмпл не сыграл — синтез ниже */ }
    }
    playSynthNote(midi, t, dur, vol);
  }

  // midisList: массив массивов MIDI-нот; каждый аккорд длится beatSec секунд
  function playChords(midisList, { beatSec = 1.1, loop = false, onStep = null } = {}) {
    stopAll();
    ensureCtx();
    const schedule = () => {
      midisList.forEach((midis, i) => {
        const timer = setTimeout(() => {
          midis.forEach(m => playNote(m, 0, beatSec * 1.15, m < 48 ? 0.28 : 0.2));
          if (onStep) onStep(i);
        }, i * beatSec * 1000);
        activeTimers.push(timer);
      });
      const doneAt = midisList.length * beatSec * 1000;
      if (loop) {
        activeTimers.push(setTimeout(schedule, doneAt));
      } else if (onStep) {
        activeTimers.push(setTimeout(() => onStep(-1), doneAt));
      }
    };
    schedule();
  }

  // events: [{ midis, at, dur, vol }] в секундах — произвольная партитура,
  // в отличие от playChords, где каждый аккорд занимает ровно одну долю.
  // Позицию считаем от performance.now(), а тикаем таймером, а не rAF:
  // в фоновой вкладке rAF останавливается, и курсор бы замирал при живом звуке.
  let tickTimer = null;
  let playing = false;

  function playTimeline(events, { onTick = null, onEnd = null, loop = false, span = 0 } = {}) {
    stopAll();
    ensureCtx();
    if (!events.length) return;
    playing = true;
    const startedAt = performance.now();
    const total = span || events.reduce((end, ev) => Math.max(end, ev.at + ev.dur), 0);
    const scheduleCycle = cycle => {
      // setTimeout counts from now, not from the start of playback, so every
      // later cycle has to subtract the time already elapsed or it drifts away.
      const now = (performance.now() - startedAt) / 1000;
      events.forEach(ev => {
        const delay = cycle * total + ev.at - now;
        activeTimers.push(setTimeout(() => {
          ev.midis.forEach(m => playNote(m, 0, ev.dur, ev.vol ?? (m < 48 ? 0.28 : 0.2)));
        }, Math.max(0, delay * 1000)));
      });
    };
    scheduleCycle(0);
    let scheduled = 1;
    tickTimer = setInterval(() => {
      if (!playing) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      if (loop) {
        // Queue the next pass before the current one runs out.
        if (elapsed > (scheduled - 0.5) * total) scheduleCycle(scheduled++);
        if (onTick) onTick(elapsed % total, total);
        return;
      }
      if (onTick) onTick(elapsed, total);
      if (elapsed >= total) {
        stopAll();
        if (onEnd) onEnd();
      }
    }, 30);
  }

  function isPlaying() { return playing; }

  function stopAll() {
    playing = false;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];
    activeNodes.forEach(n => { try { n.stop(); } catch (e) { /* уже остановлен */ } });
    activeNodes = [];
    if (piano) { try { piano.stop(); } catch (e) { /* не играл */ } }
  }

  return { playChords, playTimeline, isPlaying, stopAll };
})();
