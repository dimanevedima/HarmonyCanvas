#include "PluginEditor.h"
#include <cstdlib>

#if JUCE_WINDOWS
 #include <windows.h>
#endif

namespace
{
constexpr auto bridgeScript = R"JS(
(() => {
  const backend = () => window.__JUCE__ && window.__JUCE__.backend;
  const send = (eventId, payload) => backend()?.emitEvent(eventId, payload);
  window.harmonyCanvasSetPlaybackTimeline = payload => send('setPlaybackTimeline', payload);
  const timers = new Set();
  let playing = false;

  backend()?.addEventListener('dawTransport', state => {
    window.harmonyCanvasDawTransport = state;
    window.dispatchEvent(new CustomEvent('harmonycanvas:daw-transport', { detail: state }));
  });

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
      playTimeline(events, { onTick = null, onEnd = null, loop = false, span = 0, startAt = 0 } = {}) {
        stopAll();
        playing = true;
        const length = Math.max(span || 0, ...events.map(e => e.at + e.dur), 0.1);
        const run = (offset = 0) => {
          events.forEach(event => {
            const remaining = event.at < offset ? event.at + event.dur - offset : event.dur;
            if (remaining <= 0) return;
            const delay = Math.max(0, event.at - offset);
            event.midis.forEach(note => scheduleNote(note, delay, remaining, Math.round(127 * (event.vol || 0.5))));
          });
          const started = performance.now();
          const tick = setInterval(() => onTick?.(offset + (performance.now() - started) / 1000), 30);
          timers.add(tick);
          const endTimer = setTimeout(() => {
            clearInterval(tick); timers.delete(tick); timers.delete(endTimer);
            if (loop) run(0);
            else { playing = false; onEnd?.(); }
          }, Math.max(0.05, length - offset) * 1000);
          timers.add(endTimer);
        };
        run(Math.max(0, Math.min(length - 0.01, startAt || 0)));
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

juce::File currentPluginModule()
{
#if JUCE_WINDOWS
    HMODULE module = nullptr;
    if (GetModuleHandleExW (GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                                | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                            reinterpret_cast<LPCWSTR> (&bridgeScript),
                            &module) != 0)
    {
        wchar_t path[32768] {};
        const auto length = GetModuleFileNameW (module, path,
                                                 static_cast<DWORD> (sizeof (path) / sizeof (path[0])));
        if (length > 0)
            return juce::File (juce::String (path, static_cast<int> (length)));
    }
#endif
    return {};
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

    options = options.withEventListener ("setPlaybackTimeline", [&processor] (const juce::var& payload) {
        const auto* object = payload.getDynamicObject();
        if (object == nullptr) return;

        std::vector<HarmonyCanvasProcessor::PlaybackEvent> events;
        const auto sourceValue = object->getProperty ("events");
        if (const auto* source = sourceValue.getArray())
        {
            events.reserve (static_cast<size_t> (source->size()));
            for (const auto& item : *source)
            {
                const auto* event = item.getDynamicObject();
                if (event == nullptr) continue;
                events.push_back ({
                    clampMidi (event->getProperty ("note")),
                    static_cast<double> (event->getProperty ("start")),
                    static_cast<double> (event->getProperty ("duration")),
                    clampMidi (event->getProperty ("velocity")),
                });
            }
        }

        processor.setPlaybackTimeline (std::move (events),
                                       static_cast<double> (object->getProperty ("length")));
    });

    return options;
}

juce::String HarmonyCanvasEditor::getLabUrl (const HarmonyCanvasProcessor& processor)
{
    const auto instance = processor.getInstanceId();
    if (const auto* custom = std::getenv ("HARMONY_CANVAS_LAB_URL"))
    {
        const juce::String base (custom);
        return base + (base.containsChar ('?') ? "&" : "?") + "focus=lab&instance=" + instance;
    }

    return "http://127.0.0.1:8787/?focus=lab&instance=" + instance;
}

juce::File HarmonyCanvasEditor::findSidecarExecutable()
{
    if (const auto* custom = std::getenv ("HARMONY_CANVAS_SIDECAR"))
        return juce::File (custom);

    const auto module = currentPluginModule();
    if (module.getFullPathName().isEmpty())
        return {};

    return module.getParentDirectory()
                 .getParentDirectory()
                 .getChildFile ("Resources")
                 .getChildFile ("HarmonyCanvasSidecar.exe");
}

bool HarmonyCanvasEditor::isSidecarReady()
{
    juce::StreamingSocket socket;
    return socket.connect ("127.0.0.1", 8787, 80);
}

void HarmonyCanvasEditor::launchSidecar()
{
    if (isSidecarReady())
        return;

    const auto executable = findSidecarExecutable();
    if (! executable.existsAsFile())
    {
        startupStatus.setText ("Harmony Canvas sidecar is missing. Reinstall the plug-in.",
                               juce::dontSendNotification);
        return;
    }

    juce::StringArray arguments { executable.getFullPathName(), "--host", "127.0.0.1", "--port", "8787" };
#if JUCE_WINDOWS
    arguments.add ("--parent-pid");
    arguments.add (juce::String (static_cast<int> (GetCurrentProcessId())));
#endif
    if (! sidecarProcess.start (arguments, 0))
        startupStatus.setText ("Could not start the Harmony Canvas sidecar.", juce::dontSendNotification);
}

HarmonyCanvasEditor::HarmonyCanvasEditor (HarmonyCanvasProcessor& owner)
    : AudioProcessorEditor (&owner),
      processor (owner),
      browser (makeBrowserOptions (owner))
{
    addAndMakeVisible (browser);
    addAndMakeVisible (startupStatus);
    startupStatus.setText ("Starting Harmony Canvas…", juce::dontSendNotification);
    startupStatus.setJustificationType (juce::Justification::centred);
    startupStatus.setColour (juce::Label::backgroundColourId, juce::Colour (0xfff7f5ef));
    startupStatus.setColour (juce::Label::textColourId, juce::Colour (0xff242424));
    startupStatus.setFont (juce::FontOptions (20.0f));
    setResizable (true, true);
    setResizeLimits (900, 620, 2200, 1400);
    setSize (1500, 940);

    if (std::getenv ("HARMONY_CANVAS_LAB_URL") != nullptr)
    {
        startupStatus.setVisible (false);
        browser.goToURL (getLabUrl (processor));
        labPageRequested = true;
        startTimer (30);
    }
    else
    {
        launchSidecar();
        startTimer (30);
    }
}

void HarmonyCanvasEditor::resized()
{
    browser.setBounds (getLocalBounds());
    startupStatus.setBounds (getLocalBounds());
}

void HarmonyCanvasEditor::timerCallback()
{
    if (! labPageRequested && isSidecarReady())
    {
        browser.goToURL (getLabUrl (processor));
        startupStatus.setVisible (false);
        labPageRequested = true;
        startTimer (100);
    }

    if (! labPageRequested)
    {
        ++startupAttempts;
        if (startupAttempts == 150)
        {
            startupStatus.setText ("Harmony Canvas is taking longer than expected to start.",
                                   juce::dontSendNotification);
            startTimer (1000);
        }
        return;
    }

    const auto transport = processor.getTransportSnapshot();
    auto* object = new juce::DynamicObject();
    object->setProperty ("available", transport.available);
    object->setProperty ("bpm", transport.bpm);
    object->setProperty ("ppq", transport.ppq);
    object->setProperty ("playing", transport.playing);
    object->setProperty ("numerator", transport.numerator);
    object->setProperty ("denominator", transport.denominator);
    browser.emitEventIfBrowserIsVisible ("dawTransport", juce::var (object));
}
