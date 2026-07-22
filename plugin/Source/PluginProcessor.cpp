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

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new HarmonyCanvasProcessor();
}
