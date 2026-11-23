"""Offline checks only: no hardware, transport, or model performance claims."""

import csv
from dataclasses import replace
import math
from statistics import fmean, pvariance

import pytest

from rover_guard.config import GuardConfig
from rover_guard.features import (
    CommandFrame, FEATURE_NAMES, WindowFeatureExtractor, extract_csv,
)
from sim.simulate_driving import simulate_driving, write_driving_csv


def frame(timestamp, seq, fwd=0.0, turn=0.0, arm=1, stop=0):
    return CommandFrame(timestamp, 1, seq, arm, fwd, turn, stop)


def filled_extractor(config=None):
    extractor = WindowFeatureExtractor(config)
    values = [
        frame(0, 1, 0, .2), frame(.25, 2, .1, -.2),
        frame(.5, 3, .2, 0, arm=0), frame(.75, 6, .1, .2, arm=0),
        frame(1, 6, 0, -.2, stop=1),
    ]
    windows = [extractor.update(value) for value in values]
    return extractor, windows[-1]


def test_seed_reproduces_complete_stream_and_other_seeds_vary():
    first = list(simulate_driving(60, seed=7))
    assert first == list(simulate_driving(60, seed=7))
    assert first != list(simulate_driving(60, seed=8))


def test_normal_stream_has_jitter_safe_stops_and_driving_phases():
    rows = list(simulate_driving(60))
    assert 1150 < len(rows) < 1250
    assert {r["phase"] for r in rows} >= {
        "disarmed", "straight", "left_turn", "pause", "right_turn", "reverse", "stop",
    }
    gaps = [b["timestamp_s"] - a["timestamp_s"] for a, b in zip(rows, rows[1:])]
    assert fmean(gaps) == pytest.approx(.05, abs=.002)
    assert pvariance(gaps) > 0
    assert all(r["dataset"] == "SIMULATED_NORMAL" for r in rows)
    assert all(-1 <= r["fwd"] <= 1 and -1 <= r["turn"] <= 1 for r in rows)
    assert [r["seq"] for r in rows] == list(range(len(rows)))
    for row in rows:
        parsed = CommandFrame.from_wire(row["timestamp_s"], row["frame"])
        assert parsed.fwd == row["fwd"] and parsed.turn == row["turn"]
        if not row["arm"] or row["stop"]:
            assert row["fwd"] == row["turn"] == 0


def test_ordinary_axes_obey_configured_slew_rates():
    config = replace(GuardConfig(), throttle_slew_per_s=.3, steering_slew_per_s=.6)
    rows = list(simulate_driving(60, config=config))
    for previous, current in zip(rows, rows[1:]):
        if not current["arm"] or current["stop"]:
            continue  # STOP/disarm immediately zeroes axes; that is intentional.
        dt = current["timestamp_s"] - previous["timestamp_s"]
        assert abs(current["fwd"] - previous["fwd"]) <= config.throttle_slew_per_s * dt + 1.1e-6
        assert abs(current["turn"] - previous["turn"]) <= config.steering_slew_per_s * dt + 1.1e-6


@pytest.mark.parametrize("duration", [0, -1, math.inf, math.nan])
def test_invalid_duration_is_rejected(duration):
    with pytest.raises(ValueError):
        list(simulate_driving(duration))


@pytest.mark.parametrize("changes", [
    {"sample_rate_hz": 0}, {"window_seconds": -1},
    {"timing_jitter_std_s": math.nan}, {"min_time_gap_s": 0},
    {"timing_jitter_limit_fraction": 1}, {"max_window_frames": 1},
])
def test_invalid_configuration_is_rejected(changes):
    with pytest.raises(ValueError):
        replace(GuardConfig(), **changes)


def test_hand_calculated_features_and_stable_vector_order():
    _, window = filled_extractor()
    assert window.timestamp_s == 1
    assert window.sample_count == 5
    expected = [.4, .4, 1.2, 1.6, 3, .25, 0, 4, 1.25, 0, 3, .5, .4, .2]
    assert tuple(window.values) == FEATURE_NAMES
    assert window.as_vector() == pytest.approx(expected)


def test_no_features_before_full_second_of_history():
    extractor = WindowFeatureExtractor()
    assert extractor.update(frame(10, 1)) is None
    assert extractor.update(frame(10.999, 2)) is None
    assert extractor.update(frame(11, 3)) is not None


def test_old_frames_expire_and_window_boundary_is_included():
    extractor, _ = filled_extractor()
    window = extractor.update(frame(1.25, 7))
    # .25 is included; time zero has expired.
    assert window.sample_count == 5
    window = extractor.update(frame(1.251, 8))
    assert window.sample_count == 5  # .25 has now expired as well.
    assert window.values["sequence_step_max"] == 3


def test_reset_and_large_gaps_never_bridge_unrelated_history():
    extractor, _ = filled_extractor()
    assert extractor.update(frame(5, 100)) is None
    window = extractor.update(frame(5.05, 101))
    assert window.sample_count == 2
    assert window.values["sequence_step_mean"] == 1
    extractor.reset()
    assert extractor.update(frame(0, 0)) is None


def test_out_of_order_timestamp_is_rejected_without_consuming_frame():
    extractor, original = filled_extractor()
    with pytest.raises(ValueError, match="nondecreasing"):
        extractor.update(frame(.9, 500))
    window = extractor.update(frame(1, 7))
    assert window.sample_count == original.sample_count + 1
    assert window.values["sequence_step_max"] == 3


def test_burst_timestamps_produce_finite_rates_and_keep_zero_gaps():
    extractor, _ = filled_extractor()
    window = extractor.update(frame(1, 7, fwd=1))
    assert all(math.isfinite(value) for value in window.as_vector())
    assert window.values["throttle_change_max_per_s"] == 1e6
    assert window.values["time_gap_mean_s"] == .2


def test_capacity_is_explicit_instead_of_silently_sampling_a_flood():
    extractor = WindowFeatureExtractor(replace(GuardConfig(), max_window_frames=2))
    extractor.update(frame(0, 0))
    extractor.update(frame(.01, 1))
    with pytest.raises(ValueError, match="capacity"):
        extractor.update(frame(.02, 2))


def test_sequence_backsteps_are_preserved_and_deadband_ignores_hand_noise():
    extractor = WindowFeatureExtractor()
    extractor.update(frame(0, 100, turn=.2))
    extractor.update(frame(.25, 101, turn=-.01))
    extractor.update(frame(.5, 101, turn=.01))
    extractor.update(frame(.75, 5, turn=-.2))
    window = extractor.update(frame(1, 6, turn=-.1))
    assert window.values["steering_direction_flips"] == 1
    assert window.values["sequence_step_min"] == -96
    assert window.values["sequence_nonunit_fraction"] == .5


@pytest.mark.parametrize("wire", [
    "BAD,1,1,1,0,0,0", "CMD,1,1,1,0,0", "CMD,1,1,2,0,0,0",
    "CMD,1,1,1,nan,0,0", "CMD,1,-1,1,0,0,0", "CMD,1,1,1,0,inf,0",
])
def test_malformed_frames_do_not_enter_statistics(wire):
    with pytest.raises(ValueError):
        CommandFrame.from_wire(0, wire)


def test_stop_is_observed_without_any_acceptance_or_drop_decision():
    extractor, _ = filled_extractor()
    # Feature code measures even unusual STOP content; it cannot reject a STOP.
    unusual_stop = CommandFrame.from_wire(1.1, "CMD,1,500,1,9,-9,1")
    window = extractor.update(unusual_stop)
    assert window.values["stop_fraction"] > 0
    assert window.values["throttle_change_max_per_s"] > 1


def test_csv_round_trip_preserves_labels_and_does_not_overwrite(tmp_path):
    source = tmp_path / "SIMULATED_normal.csv"
    target = tmp_path / "SIMULATED_features.csv"
    count = write_driving_csv(source, duration_s=5)
    windows = extract_csv(source, target)
    with target.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == windows > 0
    assert count - 25 < windows < count
    assert all(row["dataset"] == "SIMULATED_NORMAL" for row in rows)
    assert all(float(row["timestamp_s"]) >= 1 for row in rows)
    original = source.read_bytes()
    with pytest.raises(FileExistsError):
        write_driving_csv(source, duration_s=5)
    assert source.read_bytes() == original


def test_csv_resets_features_between_sessions(tmp_path):
    source = tmp_path / "sessions.csv"
    with source.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=("dataset", "session_id", "timestamp_s", "frame"))
        writer.writeheader()
        for session in ("first", "second"):
            for index in range(5):
                writer.writerow(dict(dataset="SIMULATED_NORMAL", session_id=session,
                                     timestamp_s=index * .25, frame=f"CMD,1,{index},1,0,0,0"))
    target = tmp_path / "features.csv"
    assert extract_csv(source, target) == 2
    with target.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["session_id"] for row in rows] == ["first", "second"]
    assert all(float(row["sequence_step_mean"]) == 1 for row in rows)
