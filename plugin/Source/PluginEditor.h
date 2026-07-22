#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

class HarmonyCanvasEditor final : public juce::AudioProcessorEditor,
                                  private juce::Timer
{
public:
    explicit HarmonyCanvasEditor (HarmonyCanvasProcessor&);
    void resized() override;

private:
    static juce::WebBrowserComponent::Options makeBrowserOptions (HarmonyCanvasProcessor&);
    static juce::String getLabUrl();
    static juce::File findSidecarExecutable();
    static bool isSidecarReady();
    void launchSidecar();
    void timerCallback() override;

    HarmonyCanvasProcessor& processor;
    juce::WebBrowserComponent browser;
    juce::Label startupStatus;
    juce::ChildProcess sidecarProcess;
    int startupAttempts = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (HarmonyCanvasEditor)
};
