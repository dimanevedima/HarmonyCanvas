import pytest

from sidecar.harmony_engine import (
    MODE_INTERVALS,
    analyze_sketch,
    apply_chord_edit,
    apply_note_edit,
    compose_symbol,
    inversion_availability,
    melody_grid,
    normalise_melody,
    note_to_midi,
    option_availability,
    parse_chord,
    parse_progression,
    normalize_progression_text,
    roman_to_symbol,
)


def test_roman_numerals_resolve_against_the_sketch_key():
    assert roman_to_symbol("I", "C", "major") == "C"
    assert roman_to_symbol("V7", "C", "major") == "G7"
    assert roman_to_symbol("vi", "C", "major") == "Am"
    assert roman_to_symbol("ii7", "C", "major") == "Dm7"
    assert roman_to_symbol("bVII", "C", "major") == "Bb"
    assert roman_to_symbol("IVmaj7", "C", "major") == "Fmaj7"
    # Minor key: the tonic is minor, a written V stays major (the usual dominant).
    assert roman_to_symbol("i", "A", "minor") == "Am"
    assert roman_to_symbol("bVI", "A", "minor") == "F"
    assert roman_to_symbol("V", "A", "minor") == "E"


def test_absolute_symbols_are_left_for_parse_chord():
    assert roman_to_symbol("Am7", "C", "major") is None
    assert roman_to_symbol("Bbmaj13/D", "C", "major") is None


def test_normalize_mixes_roman_and_absolute_tokens():
    assert normalize_progression_text("I V vi IV", "C", "major") == "C G Am F"
    assert normalize_progression_text("i bVII bVI V", "A", "minor") == "Am G F E"
    # Absolute symbols and separators pass through untouched.
    assert normalize_progression_text("C G Am7 F | bVII", "C", "major") == "C G Am7 F Bb"


def test_pitches_are_stored_as_midi_so_nothing_is_rounded_to_the_scale():
    assert [note_to_midi(value) for value in ["C4", "F#4", "Bb3", "D", 60]] == [60, 66, 58, 62, 60]
    assert note_to_midi("not a note") is None


def test_a_given_position_is_trusted_and_a_missing_one_follows_the_previous_note():
    given = normalise_melody([
        {"pitch": "D4", "start": 0, "duration": 2},
        {"pitch": "F4", "start": 1, "duration": 1},
    ])
    assert [note["start"] for note in given] == [0.0, 1.0]
    laid_out = normalise_melody([
        {"pitch": "D4", "duration": 2},
        {"pitch": "F4", "duration": 1},
        {"pitch": "A4", "duration": 1},
    ])
    assert [note["start"] for note in laid_out] == [0.0, 2.0, 3.0]
    assert [note["pitch"] for note in laid_out] == [62, 65, 69]


def test_notes_can_be_added_moved_resized_and_deleted():
    melody, index = apply_note_edit([], op="add", pitch=62, start=0, duration=1)
    assert melody == [{"pitch": 62, "start": 0.0, "duration": 1.0, "voice": 1}] and index == 0
    melody, index = apply_note_edit(melody, op="add", pitch=65, start=2, duration=1)
    assert index == 1
    melody, index = apply_note_edit(melody, op="resize", index=1, duration=0.5)
    assert melody[1]["duration"] == 0.5
    melody, index = apply_note_edit(melody, op="move", index=1, pitch=60, start=0.5)
    assert melody[index] == {"pitch": 60, "start": 0.5, "duration": 0.5, "voice": 1}
    melody, index = apply_note_edit(melody, op="delete", index=0)
    assert [note["pitch"] for note in melody] == [60] and index == 0


def test_an_edit_that_reorders_the_melody_keeps_the_moved_note_selected():
    """Notes stay sorted by position, so the index has to be recomputed."""
    melody = [{"pitch": 62, "start": 2, "duration": 1}, {"pitch": 65, "start": 3, "duration": 1}]
    moved, index = apply_note_edit(melody, op="move", index=1, start=0)
    assert [note["pitch"] for note in moved] == [65, 62]
    assert index == 0
    # A negative drag is clamped to the start of the sketch, not rejected.
    clamped, _ = apply_note_edit(moved, op="move", index=1, start=-5)
    assert clamped[0]["start"] == 0.0


def test_a_note_edit_on_a_missing_index_changes_nothing():
    melody = [{"pitch": 62, "start": 0, "duration": 1}]
    unchanged, index = apply_note_edit(melody, op="resize", index=7, duration=2)
    assert unchanged == normalise_melody(melody) and index == -1


def test_the_note_grid_labels_every_semitone_by_degree():
    rows = melody_grid(0, MODE_INTERVALS["major"], False, chromatic=True, low=60, high=71)
    assert [row["degree"] for row in rows][::-1] == ["1", "#1/b2", "2", "#2/b3", "3", "4", "#4/b5", "5", "#5/b6", "6", "#6/b7", "7"]
    diatonic = melody_grid(0, MODE_INTERVALS["major"], False, low=60, high=71)
    assert [row["name"] for row in diatonic][::-1] == ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]


def test_borrowed_chord_tones_open_only_the_needed_chromatic_rows():
    report = analyze_sketch(chord_input="C Abaug", tonic="C", mode="major")
    chromatic_pitch_classes = {row["pitch_class"] for row in report["melody_grid"] if not row["in_scale"]}
    assert chromatic_pitch_classes == {8}, "Ab is shown for Abaug without opening every chromatic row"
    assert report["timeline"]["chromatic"] is False


def test_chord_tones_are_labelled_from_each_chord_root():
    report = analyze_sketch(chord_input="C Abaug", tonic="C", mode="major")
    labels = {item["pitch_class"]: item["label"] for item in report["chords"][1]["tone_labels"]}
    assert labels == {8: "1", 0: "3", 4: "#5"}


def test_melody_is_marked_against_the_chord_sounding_underneath_it():
    report = analyze_sketch(
        chord_input="Am F G C", tonic="C", mode="major", selected_index=0,
        melody=[{"pitch": "A4", "duration": 1}, {"pitch": "B4", "duration": 3}, {"pitch": "F#4", "duration": 1}],
    )
    first, second, third = report["melody"]
    assert (first["degree"], first["chord_tone"], first["chord_symbol"]) == ("6", True, "Am")
    assert (second["degree"], second["chord_tone"]) == ("7", False)
    assert (third["degree"], third["in_scale"], third["chord_symbol"]) == ("#4/b5", False, "F")
    # The grid dots follow the selected chord, across every octave.
    assert {row["name"] for row in report["melody_grid"] if row["chord_tone"]} >= {"A4", "C5", "E5"}
    assert report["timeline"] == {"beats_per_bar": 4, "total_beats": 64.0, "used_beats": 16.0, "bars": 16, "chromatic": False}


def test_the_grid_always_offers_sixteen_bars_but_grows_past_them():
    """Empty bars are where the next idea goes, so the canvas never stops at the material."""
    empty = analyze_sketch(chord_input="", tonic="C", mode="major")["timeline"]
    assert (empty["bars"], empty["used_beats"]) == (16, 0.0)
    short = analyze_sketch(chord_input="C Am", tonic="C", mode="major")["timeline"]
    assert (short["bars"], short["used_beats"]) == (16, 8.0)
    long = analyze_sketch(chord_input="C Am", tonic="C", mode="major", chord_beats=[40, 40])["timeline"]
    assert (long["bars"], long["used_beats"]) == (20, 80.0)
    waltz = analyze_sketch(chord_input="C", tonic="C", mode="major", meter="3/4")["timeline"]
    assert (waltz["beats_per_bar"], waltz["bars"], waltz["total_beats"]) == (3, 16, 48.0)


def test_a_chord_can_be_dropped_anywhere_and_the_lane_re_reads_in_time_order():
    """Dragging used to swap slots, so a chord could not be placed into a gap."""
    progression, index, _, starts = apply_chord_edit("C Am F G", index=0, op="position", value="24", tonic="C", mode="major")
    assert progression == "Am F G C"
    assert starts == [4.0, 8.0, 12.0, 24.0]
    assert index == 3, "the dragged chord stays selected after the lane is re-sorted"
    report = analyze_sketch(chord_input=progression, tonic="C", mode="major", chord_starts=starts)
    assert [(chord["symbol"], chord["start"]) for chord in report["chords"]][-1] == ("C", 24.0)


def test_free_positions_survive_a_later_edit():
    _, _, beats, starts = apply_chord_edit("C Am F", index=2, op="position", value="20", tonic="C", mode="major")
    assert starts == [0.0, 4.0, 20.0]
    # Positions are absolute: deleting a chord leaves its gap rather than
    # sliding the rest of the lane out from under the author.
    _, _, _, after = apply_chord_edit("C Am F", index=0, op="delete", tonic="C", mode="major", chord_beats=beats, chord_starts=starts)
    assert after == [4.0, 20.0]
    # Resizing likewise touches only the chord being resized.
    _, _, sized, unmoved = apply_chord_edit("C Am F", index=0, op="duration", value="8", tonic="C", mode="major", chord_beats=beats, chord_starts=starts)
    assert sized[0] == 8.0 and unmoved == [0.0, 4.0, 20.0]


def test_chord_lengths_survive_reordering_and_deletion():
    _, _, beats, _ = apply_chord_edit("Dm Gm A7", index=1, op="duration", value="2", tonic="D", mode="minor")
    assert beats == [4.0, 2.0, 4.0]
    moved, index, beats, _ = apply_chord_edit("Dm Gm A7", index=1, op="move", value="0", tonic="D", mode="minor", chord_beats=[4, 2, 8])
    assert moved == "Gm Dm A7" and index == 0 and beats == [2.0, 4.0, 8.0]
    _, _, beats, _ = apply_chord_edit("Dm Gm A7", index=0, op="delete", tonic="D", mode="minor", chord_beats=[4, 2, 8])
    assert beats == [2.0, 8.0]


@pytest.mark.parametrize(
    "symbol",
    ["Bbmaj13/D", "Cmaj7", "Cadd11", "C7b5no3", "Am/E", "C/D", "Cdim7", "Am7b5", "C6", "CmMaj7"],
)
def test_chord_state_round_trips_without_rewriting_the_harmony(symbol):
    """Reading a symbol into state and back must be the identity."""
    assert compose_symbol(parse_chord(symbol)["state"]) == symbol


def test_editing_an_extended_chord_keeps_its_major_seventh():
    progression, index, _, _ = apply_chord_edit("Bbmaj13/D Am/E C Dm", index=0, op="type", value="7", tonic="D", mode="minor")
    assert progression.split()[0] == "Bbmaj7/D"
    assert index == 0
    quality, _, _, _ = apply_chord_edit("Bbmaj13/D", index=0, op="quality", value="maj", tonic="D", mode="minor")
    assert quality == "Bbmaj13/D"


def test_a_bass_outside_the_chord_is_not_reported_as_an_inversion():
    assert parse_chord("C/D")["state"]["inversion"] is None
    assert parse_chord("Am/E")["state"]["inversion"] == 2


def test_options_are_offered_only_where_they_still_change_the_chord():
    triad = option_availability("triad")
    seventh = option_availability("7")
    thirteenth = option_availability("13")
    assert triad["add9"] and not seventh["add9"]
    assert seventh["add11"] and not thirteenth["add11"]
    assert seventh["b13"] and not thirteenth["b13"]
    assert not triad["b9"] and seventh["b9"]


def test_an_unavailable_option_is_dropped_instead_of_producing_a_broken_symbol():
    progression, _, _, _ = apply_chord_edit("Bbmaj13", index=0, op="option", value="add11:1", tonic="D", mode="minor")
    assert progression == "Bbmaj13"


def test_clearing_secondary_leaves_the_edited_chord_alone():
    """`None` used to reset the chord to its diatonic form and lose every edit."""
    progression, _, _, _ = apply_chord_edit("Bbmaj13/D Am/E", index=0, op="secondary", value="none", tonic="D", mode="minor")
    assert progression == "Bbmaj13/D Am/E"


def test_palette_takes_the_shape_of_the_selected_chord():
    """Clicking a palette chord should offer the same chord one degree over."""
    triad = analyze_sketch(chord_input="Am F G C", tonic="C", mode="major", selected_index=0)
    seventh = analyze_sketch(chord_input="Am7 F G C", tonic="C", mode="major", selected_index=0)
    inverted = analyze_sketch(chord_input="Am7/E F G C", tonic="C", mode="major", selected_index=0)
    assert [item["symbol"] for item in triad["diatonic_palette"]] == ["C", "Dm", "Em", "F", "G", "Am", "Bdim"]
    assert [item["symbol"] for item in seventh["diatonic_palette"]] == ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7b5"]
    assert [item["symbol"] for item in inverted["diatonic_palette"]] == ["Cmaj7/G", "Dm7/A", "Em7/B", "Fmaj7/C", "G7/D", "Am7/E", "Bm7b5/F"]
    assert inverted["palette_context"]["inversion"] == 2


def test_the_palette_carries_the_selected_chord_options_across_every_degree():
    """Checking b5 on one chord should offer every degree with a flat five."""
    plain = analyze_sketch(chord_input="Dm", tonic="D", mode="minor", selected_index=0)
    assert [item["symbol"] for item in plain["diatonic_palette"]] == ["Dm", "Edim", "F", "Gm", "Am", "Bb", "C"]
    flat_five = analyze_sketch(chord_input="Dmb5", tonic="D", mode="minor", selected_index=0)
    assert [item["symbol"] for item in flat_five["diatonic_palette"]] == ["Dmb5", "Emb5", "F(b5)", "Gmb5", "Amb5", "Bbb5", "C(b5)"]
    assert flat_five["palette_context"]["options"] == ["b5"]
    suspended = analyze_sketch(chord_input="Dmsus4", tonic="D", mode="minor", selected_index=0)
    assert [item["symbol"] for item in suspended["diatonic_palette"]][:3] == ["Dmsus4", "Edimsus4", "Fsus4"]
    # A suspension hides the third but must not hide which degree this is.
    assert [item["degree"] for item in suspended["diatonic_palette"]][:3] == ["i(sus4)", "ii°(sus4)", "III(sus4)"]


def test_a_secondary_lens_rebuilds_the_whole_palette_and_names_its_target():
    """vii°/ offers the leading-tone chord of every degree, not seven vii° chords."""
    leading = analyze_sketch(chord_input="Dm", tonic="D", mode="minor", selected_index=0, palette_secondary="vii")
    assert [item["symbol"] for item in leading["diatonic_palette"]] == ["C#dim", "D#dim", "Edim", "F#dim", "G#dim", "Adim", "Bdim"]
    assert [item["degree"] for item in leading["diatonic_palette"]][:3] == ["vii°/i", "vii°/ii°", "vii°/III"]
    dominant = analyze_sketch(chord_input="Dm", tonic="D", mode="minor", selected_index=0, palette_secondary="V")
    assert [item["symbol"] for item in dominant["diatonic_palette"]] == ["A", "B", "C", "D", "E", "F", "G"]


def test_a_secondary_root_is_spelled_by_its_function():
    """A leading tone is raised (C#), a subdominant is not (Bb)."""
    leading = analyze_sketch(chord_input="Dm", tonic="D", mode="minor", selected_index=0, palette_secondary="vii")
    assert leading["diatonic_palette"][0]["symbol"] == "C#dim"
    subdominant = analyze_sketch(chord_input="Dm", tonic="D", mode="minor", selected_index=0, palette_secondary="IV")
    assert [item["symbol"] for item in subdominant["diatonic_palette"]][2] == "Bb"


def test_a_secondary_keeps_the_shape_of_the_chord_it_replaces():
    seventh, _, _, _ = apply_chord_edit("Dm7", index=0, op="secondary", value="V", tonic="D", mode="minor")
    assert seventh == "A7"
    extended, _, _, _ = apply_chord_edit("Dm9", index=0, op="secondary", value="vii", tonic="D", mode="minor")
    assert extended == "C#dim9"


def test_a_flat_option_on_a_bare_root_stays_unambiguous():
    """`Fb5` reads as F-flat, so the alteration is parenthesised instead."""
    assert compose_symbol(parse_chord("F(b5)")["state"]) == "F(b5)"
    assert parse_chord("F(b5)")["root"] == "F"
    assert parse_chord("F(b5)")["state"]["options"] == ["b5"]
    # An accidental in the root already separates the two, so nothing changes.
    assert compose_symbol(parse_chord("Bbb5")["state"]) == "Bbb5"


def test_a_borrowed_palette_uses_the_lent_mode_and_names_degrees_at_home():
    report = analyze_sketch(chord_input="Am7 F G C", tonic="C", mode="major", selected_index=0, palette_mode="lydian")
    assert [item["symbol"] for item in report["diatonic_palette"]] == ["Cmaj7", "D7", "Em7", "F#m7b5", "Gmaj7", "Am7", "Bm7"]
    assert [item["degree"] for item in report["diatonic_palette"]][3] == "#iv7(b5)"
    assert report["palette_context"]["borrowed"] is True
    assert all(item["borrowed"] for item in report["diatonic_palette"])


def test_harmonic_minor_spells_its_fully_diminished_seventh():
    report = analyze_sketch(chord_input="Am7 Dm E7 Am", tonic="A", mode="minor", selected_index=0, palette_mode="harmonic_minor")
    assert [item["symbol"] for item in report["diatonic_palette"]][-1] == "G#dim7"


def test_suggestion_weights_come_from_the_catalogue_and_follow_the_selection():
    after_tonic = analyze_sketch(chord_input="Am F G C", tonic="C", mode="major", selected_index=3)
    after_sixth = analyze_sketch(chord_input="Am F G C", tonic="C", mode="major", selected_index=0)
    assert [item["symbol"] for item in after_tonic["key_chords"]][:3] == ["C", "G", "F"]
    # The key prior is unconditioned, the contextual one is not.
    assert after_tonic["key_chords"] == after_sixth["key_chords"]
    assert after_tonic["context_chords"] != after_sixth["context_chords"]
    assert after_tonic["context_chords"][0]["weight"] == 100
    assert after_tonic["statistics_source"]["progressions"] == 189


def test_borrowing_rereads_the_degree_without_discarding_the_chord():
    """Borrow used to replace the chord with a bare diatonic triad."""
    borrowed, _, _, _ = apply_chord_edit("Fmaj7/C", index=0, op="borrow", value="lydian", tonic="C", mode="major")
    # #iv in lydian is half-diminished, and the seventh and inversion survive.
    assert borrowed == "F#m7b5/C"
    assert parse_chord(borrowed)["state"]["inversion"] == 2


def test_the_bass_follows_the_chord_when_its_shape_changes():
    """An inversion means "this chord tone is in the bass", so it must be recomputed."""
    chain = "Fmaj7/C"
    for op, value in [("option", "add11:1"), ("type", "9"), ("quality", "min")]:
        chain, _, _, _ = apply_chord_edit(chain, index=0, op=op, value=value, tonic="C", mode="major")
        assert parse_chord(chain)["state"]["inversion"] == 2, chain
    inverted, _, _, _ = apply_chord_edit(chain, index=0, op="inversion", value="1", tonic="C", mode="major")
    parsed = parse_chord(inverted)
    assert parsed["state"]["inversion"] == 1
    # First inversion puts the third in the bass; Fm has a minor third, Ab.
    assert parsed["bass_pc"] == 8, inverted


def test_a_slash_bass_outside_the_chord_is_left_alone():
    """C/D is a deliberate slash, not an inversion, so edits must not move it."""
    edited, _, _, _ = apply_chord_edit("C/D", index=0, op="type", value="7", tonic="C", mode="major")
    assert edited.endswith("/D")
    assert parse_chord(edited)["state"]["inversion"] is None


def test_extended_chords_can_still_be_inverted():
    assert inversion_availability("9") == [True, True, True, True]
    assert inversion_availability("triad") == [True, True, True, False]


def test_nothing_selected_still_takes_its_shape_from_the_last_chord():
    """With no selection the palette appends, so it follows the tail of the progression."""
    none = analyze_sketch(chord_input="C Am7/E", tonic="C", mode="major", selected_index=-1)
    assert none["selected_index"] == -1
    # Am7/E is a seventh in second inversion, and the palette matches it.
    assert none["palette_context"]["type"] == "7" and none["palette_context"]["inversion"] == 2
    assert none["context_chords"] == analyze_sketch(chord_input="C Am7/E", tonic="C", mode="major", selected_index=1)["context_chords"]


def test_an_empty_progression_reports_no_selection():
    empty = analyze_sketch(chord_input="", tonic="C", mode="major")
    assert empty["selected_index"] == -1
    assert empty["chords"] == [] and empty["context_chords"] == []


def test_a_tone_in_the_bass_cannot_be_dropped():
    assert option_availability("triad", inversion=2)["no5"] is False
    assert option_availability("triad", inversion=1)["no3"] is False
    assert option_availability("triad", inversion=0)["no5"] is True


def test_reordering_and_inserting_keep_the_edited_chord_selected():
    moved, index, _, _ = apply_chord_edit("Dm Gm A7", index=0, op="move", value="2", tonic="D", mode="minor")
    assert moved == "Gm A7 Dm" and index == 2
    inserted, index, _, _ = apply_chord_edit("Dm Gm", index=0, op="insert", value="Bb", tonic="D", mode="minor")
    assert inserted == "Dm Bb Gm" and index == 1


def test_extended_and_slash_chords_keep_true_voicing_information():
    chord = parse_chord("Bbmaj13/D")
    assert chord["root"] == "Bb"
    assert chord["bass"] == "D"
    assert chord["quality"] == "maj13"
    assert chord["midi"][0] % 12 == 2
    assert len(chord["midi"]) >= 6


def test_progression_advice_uses_declared_mode_and_keeps_original_symbols():
    report = analyze_sketch(
        chord_input="Bbmaj13/D Am/E C Dm",
        tonic="D",
        mode="minor",
        melody=[{"pitch": "D4", "start": 0, "duration": 2}],
    )
    assert [item["symbol"] for item in report["chords"]] == ["Bbmaj13/D", "Am/E", "C", "Dm"]
    assert [item["degree"] for item in report["chords"]] == ["VImaj13", "v", "VII", "i"]
    assert report["chords"][0]["bass_degree"] == "I"
    assert report["key"]["scale_notes"] == ["D", "E", "F", "G", "A", "Bb", "C"]
    assert report["actions"][1]["title"] == "Встречное движение"
    assert len(report["next_chords"]) >= 9
    assert report["knowledge"]["ptm_catalog_size"] >= 189
    assert "ptm_core" in report["knowledge"]["providers"]


def test_parser_accepts_common_progression_separators():
    assert len(parse_progression("C — Am → F | G7")) == 4


def test_chord_options_change_real_voicing_without_forcing_a_seventh():
    add11 = parse_chord("Cadd11")
    assert 5 in {(note - add11["root_pc"]) % 12 for note in add11["midi"]}
    assert 10 not in {(note - add11["root_pc"]) % 12 for note in add11["midi"]}
    shell = parse_chord("C7b5no3")
    pitch_classes = {(note - shell["root_pc"]) % 12 for note in shell["midi"]}
    assert 6 in pitch_classes and 10 in pitch_classes
    assert 3 not in pitch_classes and 4 not in pitch_classes and 7 not in pitch_classes


def test_selected_chord_is_the_context_for_palette_and_suggestions():
    first = analyze_sketch(chord_input="Dm Gm A7 Dm", tonic="D", mode="minor", selected_index=0)
    second = analyze_sketch(chord_input="Dm Gm A7 Dm", tonic="D", mode="minor", selected_index=1)
    assert first["selected_index"] == 0
    assert second["selected_index"] == 1
    assert len(first["diatonic_palette"]) == 7
    assert [item["symbol"] for item in first["diatonic_palette"]][:3] == ["Dm", "Edim", "F"]
    assert first["next_chords"][0]["symbol"] != second["next_chords"][0]["symbol"]
