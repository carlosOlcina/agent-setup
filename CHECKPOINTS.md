# CHECKPOINTS — Final State Evaluation

> In multi-agent systems, you do not grade the path — you grade the destination.
> These are the objective checkpoints a judge (human or AI) uses to decide
> whether the repository is healthy.

## C1 — The Harness Is Complete

- [ ] Base harness files exist: `AGENTS.md`, `CLAUDE.md`, `feature_list.json`,
      `progress/current.md`, `progress/history.md`.
- [ ] All four core docs exist: `docs/architecture.md`, `docs/conventions.md`,
      `docs/specs.md`, `docs/verification.md`.
- [ ] Static-analysis and lint commands configured in `docs/verification.md` pass with zero errors.

## C2 — State Is Coherent

- [ ] At most one feature is in `in_progress` in `feature_list.json`.
- [ ] Every `done` feature has associated automated tests that pass (per `docs/verification.md`).
- [ ] `progress/current.md` is either reset to its empty template or describes only the active session
      (no leftover artifacts from prior sessions).

## C3 — Code Respects Architecture

- [ ] Code respects the structure, layer/module boundaries, and dependency rules
      defined in `docs/architecture.md`.
- [ ] Code follows the style, naming, typing, and error-handling conventions in `docs/conventions.md`.
- [ ] There are no circular dependencies, debug logs, or contextless TODOs.

## C4 — Verification Is Real

- [ ] Unit and/or integration tests exist for added or modified modules and behaviors.
- [ ] Every mandatory command in `docs/verification.md` passes cleanly.

## C5 — Session Closed Cleanly

- [ ] No suspicious untracked files (`*.tmp`, temporary artifacts, or unignored secrets).
- [ ] `progress/history.md` contains an entry for the last closed session.
- [ ] The last worked feature reflects its accurate status in `feature_list.json`.
- [ ] Once closed after human sign-off, commits and PR URL are recorded in `progress/pr_<name>.md`.

## C6 — Spec Driven Development

- [ ] Every `"sdd": true` feature in `spec_ready`, `in_progress`, or `done` status
      has its `specs/<name>/` folder containing all three English spec files:
      `requirements.md`, `design.md`, and `tasks.md`.
- [ ] `requirements.md` uses strict English EARS notation (`SHALL` / `SHALL NOT`, see `docs/specs.md`).
- [ ] Every `done` feature with `"sdd": true` has all tasks checked `[x]` in `tasks.md`
      (or an explicit documented deviation in `progress/impl_<name>.md`).
- [ ] Every `R<n>` in `requirements.md` is covered by at least one concrete automated test
      in the project test suite.

---

**How to use this file:** the `reviewer` agent evaluates every checkbox,
marks `[x]` or `[ ]` in `progress/review_<name>.md`, and rejects session closeout
if any criterion in C1–C6 fails.
