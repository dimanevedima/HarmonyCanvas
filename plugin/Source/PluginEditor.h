#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

class HarmonyCanvasEditor final : public juce::AudioProcessorEditor
{
public:
    explicit HarmonyCanvasEditor (HarmonyCanvasProcessor&);
    void resized() override;

private:
    static juce::WebBrowserComponent::Options makeBrowserOptions (HarmonyCanvasProcessor&);
    static juce::String getLabUrl();

    HarmonyCanvasProcessor& processor;
    juce::WebBrowserComponent browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (HarmonyCanvasEditor)
};
