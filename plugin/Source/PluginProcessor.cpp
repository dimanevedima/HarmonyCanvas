#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <algorithm>
#include <cmath>
#include <mutex>
#include <unordered_set>

namespace
{
std::mutex instanceRegistryMutex;
std::unordered_set<std::string> activeInstanceIds;
bool sidecarWasUsed = false;

bool claimInstanceId (const juce::String& id)
{
    const std::scoped_lock lock (instanceRegistryMutex);
    return activeInstanceIds.insert (id.toStdString()).second;
}

bool releaseInstanceId (const juce::String& id)
{
    const std::scoped_lock lock (instanceRegistryMutex);
    activeInstanceIds.erase (id.toStdString());
    return activeInstanceIds.empty() && sidecarWasUsed;
}

void noteSidecarUsed()
{
    const std::scoped_lock lock (instanceRegistryMutex);
    sidecarWasUsed = true;
}

void requestSidecarShutdown()
{
    juce::StreamingSocket socket;
    if (! socket.connect ("127.0.0.1", 8787, 150))
        return;
    const juce::String request = "POST /api/shutdown HTTP/1.1\r\n"
                                 "Host: 127.0.0.1\r\n"
                                 "Content-Length: 0\r\n"
                                 "Connection: close\r\n\r\n";
    socket.write (request.toRawUTF8(), request.getNumBytesAsUTF8());
}
}

HarmonyCanvasProcessor::HarmonyCanvasProcessor()
    : AudioProcessor (BusesProperties()
        .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      instanceId (juce::Uuid().toString())
{
    claimInstanceId (instanceId);
}

HarmonyCanvasProcessor::~HarmonyCanvasProcessor()
{
    if (releaseInstanceId (instanceId))
        requestSidecarShutdown();
}

void HarmonyCanvasProcessor::prepareToPlay (double sampleRate, int)
{
    currentSampleRate = sampleRate;
    activePlaybackNotes.clear();
    activePlaybackNotes.reserve (256);
    wasHostPlaying = false;
    previewMessages.reset (sampleRate);
}

void HarmonyCanvasProcessor::releaseResources()
{
    activePlaybackNotes.clear();
    wasHostPlaying = false;
    previewMessages.reset (44100.0);
}

bool HarmonyCanvasProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainInputChannelSet().isDisabled()
        && layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void HarmonyCanvasProcessor::processBlock (juce::AudioBuffer<float>& audio,
                                            juce::MidiBuffer& midi)
{
    audio.clear();

    bool gotPosition = false;
    if (const auto* playHead = getPlayHead())
    {
        if (const auto position = playHead->getPosition())
        {
            gotPosition = true;
            if (const auto bpm = position->getBpm())
            {
                hostBpm.store (*bpm, std::memory_order_relaxed);
                hostTransportAvailable.store (true, std::memory_order_relaxed);
            }

            if (const auto ppq = position->getPpqPosition())
                hostPpq.store (*ppq, std::memory_order_relaxed);

            if (const auto meter = position->getTimeSignature())
            {
                hostMeterNumerator.store (meter->numerator, std::memory_order_relaxed);
                hostMeterDenominator.store (meter->denominator, std::memory_order_relaxed);
            }

            hostPlaying.store (position->getIsPlaying(), std::memory_order_relaxed);
            renderHostPlayback (midi, audio.getNumSamples(), *position);
        }
    }

    if (! gotPosition)
    {
        hostTransportAvailable.store (false, std::memory_order_relaxed);
        hostPlaying.store (false, std::memory_order_relaxed);
        if (wasHostPlaying)
            stopHostPlayback (midi);
    }

    previewMessages.removeNextBlockOfMessages (midi, audio.getNumSamples());
}

juce::AudioProcessorEditor* HarmonyCanvasProcessor::createEditor()
{
    return new HarmonyCanvasEditor (*this);
}

void HarmonyCanvasProcessor::getStateInformation (juce::MemoryBlock& destination)
{
    juce::MemoryOutputStream stream (destination, false);
    stream.writeString ("harmony-canvas-state-v2");
    stream.writeString (instanceId);
}

void HarmonyCanvasProcessor::setStateInformation (const void* data, int size)
{
    if (data == nullptr || size <= 0)
        return;

    juce::MemoryInputStream stream (data, static_cast<size_t> (size), false);
    if (stream.readString() != "harmony-canvas-state-v2")
        return;

    const auto restoredId = stream.readString().trim();
    if (restoredId.isEmpty() || restoredId == instanceId)
        return;

    // A duplicated track receives the source plug-in's state while the source
    // is still alive. In that case keep the fresh constructor ID so the two
    // instances immediately diverge instead of editing the same sketch.
    if (claimInstanceId (restoredId))
    {
        releaseInstanceId (instanceId);
        instanceId = restoredId;
    }
}

void HarmonyCanvasProcessor::enqueuePreviewMessage (const juce::MidiMessage& message)
{
    previewMessages.addMessageToQueue (message);
}

void HarmonyCanvasProcessor::setPlaybackTimeline (std::vector<PlaybackEvent> events,
                                                   double lengthBeats)
{
    auto next = std::make_shared<PlaybackTimeline>();
    next->lengthBeats = std::max (0.0, lengthBeats);
    next->events.reserve (events.size());

    for (auto event : events)
    {
        event.note = juce::jlimit (0, 127, event.note);
        event.velocity = juce::jlimit (1, 127, event.velocity);
        event.channel = juce::jlimit (1, 16, event.channel);
        event.start = std::max (0.0, event.start);
        event.duration = std::max (0.001, event.duration);
        if (event.start < next->lengthBeats)
            next->events.push_back (event);
    }

    std::sort (next->events.begin(), next->events.end(), [] (const auto& a, const auto& b) {
        return a.start < b.start;
    });
    std::atomic_store_explicit (&playbackTimeline,
                                std::shared_ptr<const PlaybackTimeline> (std::move (next)),
                                std::memory_order_release);
}

void HarmonyCanvasProcessor::stopHostPlayback (juce::MidiBuffer& midi, int sampleOffset)
{
    // Send an explicit note-off on each note's own channel; parts are spread
    // across channels 1..5, so a single all-notes-off would miss most of them.
    for (const auto& active : activePlaybackNotes)
        midi.addEvent (juce::MidiMessage::noteOff (active.channel, active.note), sampleOffset);
    activePlaybackNotes.clear();
    wasHostPlaying = false;
}

void HarmonyCanvasProcessor::renderHostPlayback (juce::MidiBuffer& midi, int numSamples,
                                                  const juce::AudioPlayHead::PositionInfo& position)
{
    const auto playing = position.getIsPlaying();
    const auto bpm = position.getBpm();
    const auto ppq = position.getPpqPosition();
    if (! playing || ! bpm || ! ppq || *bpm <= 0.0 || currentSampleRate <= 0.0)
    {
        if (wasHostPlaying)
            stopHostPlayback (midi);
        return;
    }

    const double ppqPerSample = *bpm / (60.0 * currentSampleRate);
    const double blockStart = *ppq;
    const double blockEnd = blockStart + ppqPerSample * numSamples;
    const bool jumped = wasHostPlaying
        && std::abs (blockStart - lastBlockEndPpq) > std::max (0.02, ppqPerSample * numSamples * 2.0);
    const bool starting = ! wasHostPlaying || jumped;

    if (jumped)
        stopHostPlayback (midi);

    for (auto it = activePlaybackNotes.begin(); it != activePlaybackNotes.end();)
    {
        if (it->offPpq < blockEnd)
        {
            const int offset = juce::jlimit (0, numSamples - 1,
                static_cast<int> (std::round ((it->offPpq - blockStart) / ppqPerSample)));
            midi.addEvent (juce::MidiMessage::noteOff (it->channel, it->note), offset);
            it = activePlaybackNotes.erase (it);
        }
        else
        {
            ++it;
        }
    }

    const auto timeline = std::atomic_load_explicit (&playbackTimeline, std::memory_order_acquire);
    if (timeline && timeline->lengthBeats > 0.0)
    {
        const double cycle = timeline->lengthBeats;
        constexpr double epsilon = 1.0e-9;
        const auto rememberNoteOff = [&] (int note, int channel, double offPpq) {
            if (offPpq < blockEnd)
            {
                const int offset = juce::jlimit (0, numSamples - 1,
                    static_cast<int> (std::round ((offPpq - blockStart) / ppqPerSample)));
                midi.addEvent (juce::MidiMessage::noteOff (channel, note), offset);
            }
            else
            {
                activePlaybackNotes.push_back ({ note, offPpq, channel });
            }
        };
        for (const auto& event : timeline->events)
        {
            if (starting)
            {
                const double previous = event.start + std::floor ((blockStart - event.start) / cycle) * cycle;
                if (previous < blockStart - epsilon && previous + event.duration > blockStart + epsilon)
                {
                    midi.addEvent (juce::MidiMessage::noteOn (event.channel, event.note,
                                   static_cast<juce::uint8> (event.velocity)), 0);
                    rememberNoteOff (event.note, event.channel, previous + event.duration);
                }
            }

            double occurrence = event.start
                + std::ceil ((blockStart - event.start - epsilon) / cycle) * cycle;
            for (; occurrence < blockEnd - epsilon; occurrence += cycle)
            {
                if (occurrence < blockStart - epsilon)
                    continue;
                const int offset = juce::jlimit (0, numSamples - 1,
                    static_cast<int> (std::round ((occurrence - blockStart) / ppqPerSample)));
                midi.addEvent (juce::MidiMessage::noteOn (event.channel, event.note,
                               static_cast<juce::uint8> (event.velocity)), offset);
                rememberNoteOff (event.note, event.channel, occurrence + event.duration);
            }
        }
    }

    wasHostPlaying = true;
    lastBlockEndPpq = blockEnd;
}

HarmonyCanvasProcessor::TransportSnapshot HarmonyCanvasProcessor::getTransportSnapshot() const noexcept
{
    return {
        hostBpm.load (std::memory_order_relaxed),
        hostPpq.load (std::memory_order_relaxed),
        hostMeterNumerator.load (std::memory_order_relaxed),
        hostMeterDenominator.load (std::memory_order_relaxed),
        hostPlaying.load (std::memory_order_relaxed),
        hostTransportAvailable.load (std::memory_order_relaxed),
    };
}

juce::String HarmonyCanvasProcessor::getInstanceId() const
{
    return instanceId;
}

void HarmonyCanvasProcessor::markSidecarUsed()
{
    noteSidecarUsed();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new HarmonyCanvasProcessor();
}
