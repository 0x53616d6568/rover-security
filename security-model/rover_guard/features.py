"""Causal one-second features, independent of command acceptance and Guard rules."""

import argparse
from collections import deque
import csv
from dataclasses import dataclass
import math
from pathlib import Path
from statistics import fmean, pvariance

from .config import GuardConfig


FEATURE_NAMES = (
    "throttle_change_mean_per_s", "throttle_change_max_per_s",
    "steering_change_mean_per_s", "steering_change_max_per_s",
    "steering_direction_flips", "time_gap_mean_s", "time_gap_variance_s2",
    "command_rate_hz", "sequence_step_mean", "sequence_step_min",
    "sequence_step_max", "sequence_nonunit_fraction", "arm_zero_fraction",
    "stop_fraction",
)


@dataclass(frozen=True)
class CommandFrame:
    timestamp_s: float
    ver: int
    seq: int
    arm: int
    fwd: float
    turn: float
    stop: int

    def __post_init__(self):
        if not all(math.isfinite(value) for value in (self.timestamp_s, self.fwd, self.turn)):
            raise ValueError("Timestamp and axes must be finite")
        if self.timestamp_s < 0:
            raise ValueError("Timestamp must be nonnegative")
        if type(self.ver) is not int or type(self.seq) is not int:
            raise ValueError("Version and sequence must be integers")
        if not 0 <= self.seq <= 0xFFFFFFFF:
            raise ValueError("Sequence must fit the firmware's unsigned 32-bit field")
        if self.arm not in (0, 1) or self.stop not in (0, 1):
            raise ValueError("arm and stop must be 0 or 1")

    @classmethod
    def from_wire(cls, timestamp_s, frame):
        """Decode numeric fields; this is not a replacement for policy validation.

        Finite out-of-range axes are retained for anomaly measurement. Malformed
        frames raise ValueError so the caller can use its existing rule path.
        """
        fields = frame.strip().split(",")
        if len(fields) != 7 or fields[0] != "CMD":
            raise ValueError("Expected CMD,<ver>,<seq>,<arm>,<fwd>,<turn>,<stop>")
        return cls(float(timestamp_s), int(fields[1]), int(fields[2]),
                   int(fields[3]), float(fields[4]), float(fields[5]), int(fields[6]))


@dataclass(frozen=True)
class FeatureWindow:
    timestamp_s: float
    sample_count: int
    values: dict[str, float]

    def as_vector(self):
        """Stable column order for the future model's training and scoring."""
        return [self.values[name] for name in FEATURE_NAMES]


class WindowFeatureExtractor:
    def __init__(self, config=None):
        self.config = config or GuardConfig()
        self.reset()

    def reset(self):
        """Call on a new session; never connect two drivers' sequence/timing history."""
        self._frames = deque()
        self._started_at = None

    def update(self, frame):
        """Return None during warmup, then one causal window per incoming frame.

        Use receiver monotonic arrival timestamps. Equal timestamps are allowed
        (burst traffic); decreasing timestamps are rejected without changing state.
        The window is inclusive: [current_time - window_seconds, current_time].
        """
        cfg = self.config
        if self._frames and frame.timestamp_s < self._frames[-1].timestamp_s:
            raise ValueError("Arrival timestamps must be nondecreasing; reset for a new session")
        cutoff = frame.timestamp_s - cfg.window_seconds
        while self._frames and self._frames[0].timestamp_s < cutoff:
            self._frames.popleft()
        if len(self._frames) >= cfg.max_window_frames:
            raise ValueError("Window capacity exceeded; caller must handle this as a separate event")
        if self._started_at is None:
            self._started_at = frame.timestamp_s
        self._frames.append(frame)
        if frame.timestamp_s - self._started_at < cfg.window_seconds or len(self._frames) < 2:
            return None
        frames = list(self._frames)
        pairs = list(zip(frames, frames[1:]))
        gaps = [b.timestamp_s - a.timestamp_s for a, b in pairs]
        # A floor avoids division by zero in bursts; raw gaps remain unmodified.
        throttle_rates = [abs(b.fwd - a.fwd) / max(gap, cfg.min_time_gap_s)
                          for (a, b), gap in zip(pairs, gaps)]
        steering_rates = [abs(b.turn - a.turn) / max(gap, cfg.min_time_gap_s)
                          for (a, b), gap in zip(pairs, gaps)]
        steps = [b.seq - a.seq for a, b in pairs]
        signs = [1 if f.turn > 0 else -1 for f in frames if abs(f.turn) > cfg.steering_deadband]
        flips = sum(a != b for a, b in zip(signs, signs[1:]))
        values = (
            fmean(throttle_rates), max(throttle_rates),
            fmean(steering_rates), max(steering_rates), float(flips),
            fmean(gaps), pvariance(gaps),
            len(gaps) / max(sum(gaps), cfg.min_time_gap_s),
            fmean(steps), float(min(steps)), float(max(steps)),
            sum(step != 1 for step in steps) / len(steps),
            sum(f.arm == 0 for f in frames) / len(frames),
            sum(f.stop == 1 for f in frames) / len(frames),
        )
        return FeatureWindow(frame.timestamp_s, len(frames), dict(zip(FEATURE_NAMES, values)))


def extract_csv(input_path, output_path, config=None):
    """Extract features from contiguous sessions and preserve provenance labels.

    timestamp_s is the arrival time; frame is the authoritative wire payload.
    No labels, sequence numbers, or absolute timestamps enter the model vector.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    extractor = WindowFeatureExtractor(config)
    session = None
    count = 0
    with Path(input_path).open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        required = {"dataset", "session_id", "timestamp_s", "frame"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"Input CSV must contain {sorted(required)}")
        with output_path.open("x", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=(
                "dataset", "session_id", "timestamp_s", "sample_count", *FEATURE_NAMES,
            ))
            writer.writeheader()
            for row in reader:
                key = (row["dataset"], row["session_id"])
                if key != session:
                    extractor.reset()
                    session = key
                window = extractor.update(CommandFrame.from_wire(row["timestamp_s"], row["frame"]))
                if window is not None:
                    writer.writerow(dict(dataset=row["dataset"], session_id=row["session_id"],
                                          timestamp_s=window.timestamp_s,
                                          sample_count=window.sample_count, **window.values))
                    count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or args.input.with_name(args.input.stem + "_features.csv")
    try:
        count = extract_csv(args.input, output)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Error: {exc}\n")
    print(f"Wrote {count} windows with {len(FEATURE_NAMES)} features to {output}")
    print("Input provenance labels preserved; simulated inputs are not hardware validation.")


if __name__ == "__main__":
    main()
