cmake_minimum_required(VERSION 3.22)

project(HarmonyCanvas VERSION 0.1.0 LANGUAGES CXX)

include(FetchContent)

FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 8.0.13
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(HarmonyCanvas
  COMPANY_NAME "Harmony Canvas"
  BUNDLE_ID "com.harmonycanvas.plugin"
  PLUGIN_MANUFACTURER_CODE Hcvs
  PLUGIN_CODE Hc01
  PRODUCT_NAME "Harmony Canvas"
  FORMATS VST3 Standalone
  IS_SYNTH TRUE
  IS_MIDI_EFFECT FALSE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT TRUE
  EDITOR_WANTS_KEYBOARD_FOCUS TRUE
  NEEDS_WEB_BROWSER TRUE
  NEEDS_WEBVIEW2 TRUE
  COPY_PLUGIN_AFTER_BUILD FALSE
)

target_sources(HarmonyCanvas PRIVATE
  Source/PluginProcessor.cpp
  Source/PluginProcessor.h
  Source/PluginEditor.cpp
  Source/PluginEditor.h
)

target_compile_features(HarmonyCanvas PRIVATE cxx_std_17)

target_compile_definitions(HarmonyCanvas PUBLIC
  JUCE_USE_CURL=0
  JUCE_WEB_BROWSER=1
  JUCE_USE_WIN_WEBVIEW2=1
  JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(HarmonyCanvas
  PRIVATE
    juce::juce_audio_utils
    juce::juce_gui_extra
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags
)
