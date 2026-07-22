# Harmony Canvas — Transport Strip

Page-specific rules for the compact DAW plug-in toolbar.

- Keep a single dense row at desktop plug-in widths; wrap only below 900 px.
- Order controls by use: Play/Stop, Undo/Redo, tonic, mode, DAW tempo, meter.
- Icon buttons retain a 44×44 px hit target and a visible keyboard focus ring.
- Use one SVG stroke/fill language; do not use emoji or font glyphs as controls.
- DAW-owned BPM is read-only and explicitly labelled `DAW`, not communicated by colour alone.
- Hide autosave visually but keep its `aria-live` status available to assistive technology.
- Use 4/8 px spacing and 150–200 ms state transitions; disable transitions for reduced motion.
- Remove project naming, window management and destructive sketch actions from the primary strip.
