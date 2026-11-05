# PDF source

The project plan is authored in `main.typ` and uses the colocated `report-theme.typ`. It imports the pinned Typst Universe package `@preview/glossarium:0.5.10`.

With Typst installed and package access available, build from this directory:

```sh
typst compile main.typ project-plan.pdf
```

The manifest and build-plan JSON record the routing decision and package pin used for this artifact. The rendered deliverable is [`../project-plan.pdf`](../project-plan.pdf).
