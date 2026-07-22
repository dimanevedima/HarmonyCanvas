#include "PluginProcessor.h"
#include "PluginEditor.h"

HarmonyCanvasProcessor::HarmonyCanvasProcessor()
    : AudioProcessor (BusesProperties()
        .withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
}

void HarmonyCanvasProcessor::prepareToPlay (double sampleRate, int)
{
    previewMessages.reset (sampleRate);
}

void HarmonyCanvasProcessor::releaseResources()
{
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

    if (const auto* playHead = getPlayHead())
    {
        if (const auto position = playHead->getPosition())
        {
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
        }
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
    stream.writeString ("harmony-canvas-state-v1");
}

void HarmonyCanvasProcessor::setStateInformation (const void*, int)
{
}

void HarmonyCanvasProcessor::enqueuePreviewMessage (const juce::MidiMessage& message)
{
    previewMessages.addMessageToQueue (message);
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

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new HarmonyCanvasProcessor();
}
