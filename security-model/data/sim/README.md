Generated CSV files in this directory are **SIMULATED**, not rover recordings.

`SIMULATED_normal_seed7.csv` contains synthetic normal driving; its companion
`_features.csv` contains derived sliding windows. These generated files are
ignored by Git. Keep future simulated attack streams separate from normal data;
attacks must never enter training. This step does not train a detector.
