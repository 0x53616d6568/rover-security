"""Keep simulation and feature parameters together for reproducible tuning."""

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class GuardConfig:
    sample_rate_hz: float = 20.0
    timing_jitter_std_s: float = 0.004
    timing_jitter_limit_fraction: float = 0.4
    throttle_slew_per_s: float = 0.65
    steering_slew_per_s: float = 1.2
    joystick_noise_std: float = 0.015
    noise_smoothing: float = 0.25
    segment_duration_jitter_fraction: float = 0.2
    window_seconds: float = 1.0
    steering_deadband: float = 0.05
    min_time_gap_s: float = 1e-6
    max_window_frames: int = 10000

    def __post_init__(self):
        for name in (
            "sample_rate_hz", "throttle_slew_per_s", "steering_slew_per_s",
            "window_seconds", "min_time_gap_s",
        ):
            value = getattr(self, name)
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{name} must be finite and positive")
        for name in ("timing_jitter_std_s", "joystick_noise_std", "steering_deadband"):
            value = getattr(self, name)
            if not math.isfinite(value) or value < 0:
                raise ValueError(f"{name} must be finite and nonnegative")
        for name in (
            "timing_jitter_limit_fraction", "noise_smoothing",
            "segment_duration_jitter_fraction",
        ):
            value = getattr(self, name)
            if not math.isfinite(value) or not 0 <= value < 1:
                raise ValueError(f"{name} must be in [0, 1)")
        if type(self.max_window_frames) is not int or self.max_window_frames < 2:
            raise ValueError("max_window_frames must be an integer >= 2")
