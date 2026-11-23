# ENISOLAR simulated driving and window features

Implemented in this step: **items 1 and 3 only**. All generated driving and
derived example results are **SIMULATED**, with no hardware validation.
The existing `Guard` and its 13 tests were not present in this checkout, so
their behavior and results cannot be verified here. No Guard rules are changed.

## Run in PowerShell

From the repository root, use the existing virtual environment explicitly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r security-model\requirements-dev.txt
Set-Location security-model
..\.venv\Scripts\python.exe -m sim.simulate_driving --duration 60 --seed 7
..\.venv\Scripts\python.exe -m rover_guard.features data\sim\SIMULATED_normal_seed7.csv
..\.venv\Scripts\python.exe -m pytest -v
```

With the default configuration and seed 7, the verified simulated output is:

```text
SIMULATED ONLY: wrote 1196 command frames to ...\data\sim\SIMULATED_normal_seed7.csv
Wrote 1176 windows with 14 features to data\sim\SIMULATED_normal_seed7_features.csv
30 passed
```

Generation and feature extraction require only Python 3.10+ standard-library
modules. Pytest is needed only for tests. No network, rover connection, or
credentials are used. Commands refuse to overwrite existing CSV files; use a
different seed or `--output` for subsequent runs.

The simulation prints the number of frames (about 1,200 for 60 seconds at
20 Hz) and writes `data/sim/SIMULATED_normal_seed7.csv`. The first row looks like:

```csv
dataset,session_id,timestamp_s,ver,seq,arm,fwd,turn,stop,phase,frame
SIMULATED_NORMAL,SIMULATED-seed-7,0.0,1,0,0,0.0,0.0,0,disarmed,"CMD,1,0,0,0.000000,0.000000,0"
```

Normal-driving scenarios include disarming, forward acceleration, both turn
directions, neutral pauses, braking before reverse, and explicit STOP frames.
Arrival timestamps have jitter. Axis changes are slew-limited toward noisy
targets; STOP/disarm immediately zeros both axes. Seeds reproduce a session.
This simulator is a hypothesis of human driving, not evidence of how a real
driver or phone behaves. A model trained on it alone cannot establish field
performance. In particular, a phone may transmit perfectly periodic frames
while a human drives; regular timing alone does not establish an attack.

## Feature definitions

`rover_guard/config.py` contains the shared `GuardConfig` object. Pass a tuned
instance to `simulate_driving`, `WindowFeatureExtractor`, or `extract_csv`.
All measurement features use frames in the inclusive last-one-second window.
There is a one-second initial warmup, and at least two frames are required.
Only transitions with both endpoints inside the window contribute to rates.

| Feature | Definition |
|---|---|
| throttle_change_mean/max_per_s | Mean/maximum absolute forward-axis delta divided by its arrival gap |
| steering_change_mean/max_per_s | Mean/maximum absolute turn-axis delta divided by its arrival gap |
| steering_direction_flips | Changes between positive/negative steering outside the configurable deadband; neutral samples ignored |
| time_gap_mean_s / time_gap_variance_s2 | Mean and population variance of interarrival gaps |
| command_rate_hz | Number of transitions divided by their elapsed span |
| sequence_step_mean/min/max | Signed differences between adjacent sequence numbers |
| sequence_nonunit_fraction | Fraction of sequence steps other than +1, retaining replays, backsteps, and jumps |
| arm_zero_fraction / stop_fraction | Fractions of frames whose corresponding flag is 0 / 1 |

Equal arrival timestamps are allowed and their zero gaps retained. Only rate
denominators have a configurable positive floor. Excess window capacity raises
an explicit error rather than silently truncating burst statistics. Caller code
must handle parse/capacity errors through its existing protection policy.
Decreasing timestamps raise an error. Reset the extractor on a new connection
or session. Sequence steps are raw signed differences, with no inferred rollover
acceptance policy. Absolute sequence numbers and provenance labels are excluded
from the numerical feature vector.

The features CLI writes `data/sim/SIMULATED_normal_seed7_features.csv`, preserving
the dataset and session labels. Each row contains a timestamp, sample count,
and 14 numerical features. The timestamp must represent receiver arrival time,
not an attacker-controlled timestamp inside a payload. A large gap expires old
frames; no features are emitted until at least two frames are present again.

For later online integration:

```python
from rover_guard.config import GuardConfig
from rover_guard.features import CommandFrame, WindowFeatureExtractor

extractor = WindowFeatureExtractor(GuardConfig())
# Call on each received frame, using a monotonic receiver timestamp in seconds:
window = extractor.update(CommandFrame.from_wire(0.0, "CMD,1,0,1,0,0,0"))
if window is not None:
    vector = window.as_vector()  # Fixed FEATURE_NAMES ordering; no decision made.
```

This feature extractor makes no accept/drop decision. It measures STOP frames
without intercepting them. The STOP-always-passes policy must remain in the Guard
when integration is authorized. Attack generation, IsolationForest training,
validation thresholds, evaluation, and strike integration are deferred until the
next requested step. Future attack data is for testing only, never training.
