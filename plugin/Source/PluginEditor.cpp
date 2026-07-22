#include "PluginEditor.h"
#include <cstdlib>

namespace
{
constexpr auto bridgeScript = R"JS(
(() => {
  const backend = () => window.__JUCE__ && window.__JUCE__.backend;
  const send = (eventId, payload) => backend()?.emitEvent(eventId, payload);
  const timers = new Set();
  let playing = false;

  const stopAll = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    send('midiAllNotesOff', {});
    playing = false;
  };

  const scheduleNote = (note, delaySeconds, durationSeconds, velocity = 96) => {
    const onTimer = setTimeout(() => {
      send('midiNoteOn', { note, velocity });
      const offTimer = setTimeout(() => {
        send('midiNoteOff', { note });
        timers.delete(offTimer);
      }, Math.max(20, durationSeconds * 1000));
      timers.add(offTimer);
      timers.delete(onTimer);
    }, Math.max(0, delaySeconds * 1000));
    timers.add(onTimer);
  };

  const installMidiPreview = () => {
    if (!window.ptmAudio || window.__harmonyCanvasMidiInstalled) return;
    window.__harmonyCanvasMidiInstalled = true;
    window.ptmAudio = {
      isPlaying: () => playing,
      stopAll,
      playChords(midisList, { beatSec = 1.1, loop = false, onStep = null } = {}) {
        stopAll();
        playing = true;
        const run = () => {
          midisList.forEach((notes, index) => {
            const stepTimer = setTimeout(() => onStep?.(index), index * beatSec * 1000);
            timers.add(stepTimer);
            notes.forEach(note => scheduleNote(note, index * beatSec, beatSec * 0.92));
          });
          const endTimer = setTimeout(() => {
            timers.delete(endTimer);
            if (loop) run();
            else { playing = false; onStep?.(-1); }
          }, midisList.length * beatSec * 1000);
          timers.add(endTimer);
        };
        run();
      },
      playTimeline(events, { onTick = null, onEnd = null, loop = false, span = 0 } = {}) {
        stopAll();
        playing = true;
        const length = Math.max(span || 0, ...events.map(e => e.at + e.dur), 0.1);
        const run = () => {
          events.forEach(event => event.midis.forEach(note => scheduleNote(note, event.at, event.dur, Math.round(127 * (event.vol || 0.5)))));
          const started = performance.now();
          const tick = setInterval(() => onTick?.((performance.now() - started) / 1000), 30);
          timers.add(tick);
          const endTimer = setTimeout(() => {
            clearInterval(tick); timers.delete(tick); timers.delete(endTimer);
            if (loop) run();
            else { playing = false; onEnd?.(); }
          }, length * 1000);
          timers.add(endTimer);
        };
        run();
      }
    };
    document.body.classList.add('harmony-canvas-plugin');
  };

  window.addEventListener('DOMContentLoaded', () => setTimeout(installMidiPreview, 0));
  window.addEventListener('load', () => setTimeout(installMidiPreview, 0));
  const watcher = setInterval(installMidiPreview, 250);
  setTimeout(() => clearInterval(watcher), 10000);
})();
)JS";

int clampMidi (const juce::var& value)
{
    return juce::jlimit (0, 127, static_cast<int> (value));
}
}

juce::WebBrowserComponent::Options HarmonyCanvasEditor::makeBrowserOptions (HarmonyCanvasProcessor& processor)
{
    using Browser = juce::WebBrowserComponent;
    const auto userData = juce::File::getSpecialLocation (juce::File::tempDirectory)
                              .getChildFile ("HarmonyCanvas-WebView2");

    auto options = Browser::Options{}
        .withBackend (Browser::Options::Backend::webview2)
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withNativeIntegrationEnabled()
        .withUserScript (bridgeScript)
        .withWinWebView2Options (Browser::Options::WinWebView2{}
            .withUserDataFolder (userData)
            .withStatusBarDisabled()
            .withBuiltInErrorPageDisabled());

    options = options.withEventListener ("midiNoteOn", [&processor] (const juce::var& payload) {
        const auto* object = payload.getDynamicObject();
        if (object == nullptr) return;
        const auto note = clampMidi (object->getProperty ("note"));
        const auto velocity = clampMidi (object->getProperty ("velocity"));
        processor.enqueuePreviewMessage (juce::MidiMessage::noteOn (1, note, static_cast<juce::uint8> (velocity)));
    });

    options = options.withEventListener ("midiNoteOff", [&processor] (const juce::var& payload) {
        const auto* object = payload.getDynamicObject();
        if (object == nullptr) return;
        processor.enqueuePreviewMessage (juce::MidiMessage::noteOff (1, clampMidi (object->getProperty ("note"))));
    });

    options = options.withEventListener ("midiAllNotesOff", [&processor] (const juce::var&) {
        processor.enqueuePreviewMessage (juce::MidiMessage::allNotesOff (1));
    });

    return options;
}

juce::String HarmonyCanvasEditor::getLabUrl()
{
    if (const auto* custom = std::getenv ("HARMONY_CANVAS_LAB_URL"))
        return custom;

    return "http://127.0.0.1:8000/?focus=lab";
}

HarmonyCanvasEditor::HarmonyCanvasEditor (HarmonyCanvasProcessor& owner)
    : AudioProcessorEditor (&owner),
      processor (owner),
      browser (makeBrowserOptions (owner))
{
    addAndMakeVisible (browser);
    setResizable (true, true);
    setResizeLimits (900, 620, 2200, 1400);
    setSize (1500, 940);
    browser.goToURL (getLabUrl());
}

void HarmonyCanvasEditor::resized()
{
    browser.setBounds (getLocalBounds());
}
