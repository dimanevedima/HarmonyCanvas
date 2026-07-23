#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <atomic>
#include <memory>
#include <vector>

class HarmonyCanvasProcessor final : public juce::AudioProcessor
{
public:
    struct TransportSnapshot
    {
        double bpm = 120.0;
        double ppq = 0.0;
        int numerator = 4;
        int denominator = 4;
        bool playing = false;
        bool available = false;
    };

    struct PlaybackEvent
    {
        int note = 60;
        double start = 0.0;
        double duration = 0.25;
        int velocity = 96;
        int channel = 1;
    };

    HarmonyCanvasProcessor();
    ~HarmonyCanvasProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return true; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    void enqueuePreviewMessage (const juce::MidiMessage& message);
    void setPlaybackTimeline (std::vector<PlaybackEvent> events, double lengthBeats);
    void requestHostTransport (bool play);
    TransportSnapshot getTransportSnapshot() const noexcept;
    juce::String getInstanceId() const;
    void markSidecarUsed();

private:
    struct PlaybackTimeline
    {
        std::vector<PlaybackEvent> events;
        double lengthBeats = 0.0;
    };

    struct ActivePlaybackNote
    {
        int note = 60;
        double offPpq = 0.0;
        int channel = 1;
    };

    void renderHostPlayback (juce::MidiBuffer&, int numSamples,
                             const juce::AudioPlayHead::PositionInfo&);
    void stopHostPlayback (juce::MidiBuffer&, int sampleOffset = 0);

    juce::MidiMessageCollector previewMessages;
    std::shared_ptr<const PlaybackTimeline> playbackTimeline;
    std::vector<ActivePlaybackNote> activePlaybackNotes;
    double currentSampleRate = 44100.0;
    double lastBlockEndPpq = 0.0;
    bool wasHostPlaying = false;
    juce::String instanceId;
    std::atomic<double> hostBpm { 120.0 };
    std::atomic<double> hostPpq { 0.0 };
    std::atomic<int> hostMeterNumerator { 4 };
    std::atomic<int> hostMeterDenominator { 4 };
    std::atomic<bool> hostPlaying { false };
    std::atomic<bool> hostTransportAvailable { false };
    std::atomic<int> hostTransportRequest { 0 };
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (HarmonyCanvasProcessor)
};
