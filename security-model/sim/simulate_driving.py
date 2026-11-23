"""Generate SIMULATED normal joystick driving with Python's standard library.

Run from security-model: python -m sim.simulate_driving --duration 60 --seed 7
This is a synthetic hypothesis of human driving, not measured operator data.
"""

import argparse
import csv
import math
from pathlib import Path
import random

from rover_guard.config import GuardConfig


DATASET = "SIMULATED_NORMAL"
CSV_FIELDS = (
    "dataset", "session_id", "timestamp_s", "ver", "seq", "arm", "fwd",
    "turn", "stop", "phase", "frame",
)


def _approach(current, target, limit):
    return current + max(-limit, min(limit, target - current))


def simulate_driving(duration_s=60.0, seed=7, config=None):
    """Yield reproducible frames, using jittered arrival time and bounded slew.

    Deliberate STOP/disarm transitions immediately zero the axes. Ordinary
    driving follows noisy targets gradually. No frames are transmitted.
    """
    cfg = config or GuardConfig()
    if not math.isfinite(duration_s) or duration_s <= 0:
        raise ValueError("duration_s must be finite and positive")
    rng = random.Random(seed)
    period = 1 / cfg.sample_rate_hz
    timestamp = previous_timestamp = 0.0
    seq = 0
    fwd = turn = fwd_noise = turn_noise = 0.0
    segment_end = 0.0
    segment_index = -1
    # Pauses precede reverse driving; both steering directions are represented.
    phases = (
        ("disarmed", 1.5, 0, 0, 0.0, 0.0),
        ("straight", 6.0, 1, 0, 0.55, 0.0),
        ("left_turn", 5.0, 1, 0, 0.35, -0.55),
        ("pause", 3.0, 1, 0, 0.0, 0.0),
        ("right_turn", 5.0, 1, 0, 0.4, 0.55),
        ("brake", 3.0, 1, 0, 0.0, 0.0),
        ("reverse", 4.0, 1, 0, -0.3, 0.0),
        ("stop", 2.0, 1, 1, 0.0, 0.0),
    )
    while timestamp < duration_s:
        if timestamp >= segment_end:
            segment_index = (segment_index + 1) % len(phases)
            phase, seconds, arm, stop, target_fwd, target_turn = phases[segment_index]
            jitter = cfg.segment_duration_jitter_fraction
            segment_end = timestamp + seconds * rng.uniform(1 - jitter, 1 + jitter)
            # Vary driver intent between manoeuvres as well as adding hand noise.
            target_fwd *= rng.uniform(0.8, 1.2)
            target_turn *= rng.uniform(0.8, 1.2)
        dt = timestamp - previous_timestamp
        if timestamp >= duration_s - period:
            phase, arm, stop = "stop", 1, 1
        if not arm or stop:
            fwd = turn = fwd_noise = turn_noise = 0.0
        else:
            alpha = cfg.noise_smoothing
            fwd_noise = (1 - alpha) * fwd_noise + alpha * rng.gauss(0, cfg.joystick_noise_std)
            turn_noise = (1 - alpha) * turn_noise + alpha * rng.gauss(0, cfg.joystick_noise_std)
            # Neutral pauses settle to exactly zero, rather than drifting forever.
            desired_fwd = target_fwd + fwd_noise if target_fwd else 0.0
            desired_turn = target_turn + turn_noise if target_turn else 0.0
            fwd = _approach(fwd, max(-1, min(1, desired_fwd)), cfg.throttle_slew_per_s * dt)
            turn = _approach(turn, max(-1, min(1, desired_turn)), cfg.steering_slew_per_s * dt)
        frame = f"CMD,1,{seq},{arm},{fwd:.6f},{turn:.6f},{stop}"
        yield dict(zip(CSV_FIELDS, (
            DATASET, f"SIMULATED-seed-{seed}", round(timestamp, 9), 1, seq,
            arm, round(fwd, 6), round(turn, 6), stop, phase, frame,
        )))
        previous_timestamp = timestamp
        jitter_limit = period * cfg.timing_jitter_limit_fraction
        jitter = max(-jitter_limit, min(jitter_limit, rng.gauss(0, cfg.timing_jitter_std_s)))
        timestamp += period + jitter
        seq += 1


def write_driving_csv(path, duration_s=60.0, seed=7, config=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidentally overwriting an earlier session.
    with path.open("x", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        count = 0
        for row in simulate_driving(duration_s, seed, config):
            writer.writerow(row)
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--duration", type=float, default=60.0, help="Duration in seconds")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or Path(__file__).resolve().parents[1] / "data" / "sim" / f"SIMULATED_normal_seed{args.seed}.csv"
    try:
        count = write_driving_csv(output, args.duration, args.seed)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Error: {exc}\n")
    print(f"SIMULATED ONLY: wrote {count} command frames to {output}")
    print("Synthetic normal-driving hypothesis; no hardware validation.")


if __name__ == "__main__":
    main()
