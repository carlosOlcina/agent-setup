# Harness Engineering — Spec Driven Development

> This file is the **entry point** for any agent working in this repository.
> It is NOT a wall of rules: it is a **map**. Read only what you need when
> you need it (progressive disclosure).

## 1. Before You Start (Mandatory)

1. Run the baseline verification commands defined in `docs/verification.md` to confirm repository health.
2. Read `progress/current.md` to understand where the previous session left off.
3. Read `feature_list.json`. Every new feature with `"sdd": true` follows **Spec Driven Development** — see `docs/specs.md` and §4.
4. Read `docs/specs.md` before authoring or implementing any spec or feature with `"sdd": true`.

## 2. Repository Map

| File / Directory | Purpose | When to Read |
|---|---|---|
| `feature_list.json` | Task backlog with status (`pending` / `spec_ready` / `in_progress` / `done` / `blocked`) | Always, at session start |
| `progress/current.md` | Live state of the active session | Always, at session start |
| `progress/history.md` | Append-only log of closed sessions | When historical context is needed |
| `specs/<feature>/` | `requirements.md` + `design.md` + `tasks.md` (Kiro-style) | Before implementing any `"sdd": true` feature |
| `docs/architecture.md` | Project architecture, module/layer layout, and quality standards | Before designing or implementing |
| `docs/conventions.md` | Style, naming, structure, error-handling, and testing conventions | Before writing code |
| `docs/specs.md` | SDD workflow: strict English EARS notation, the 3 spec files, human gates, and PR closeout | Before authoring or reviewing a spec |
| `docs/verification.md` | Exact verification commands and requirement traceability rules | Before declaring any task `done` |
| `CHECKPOINTS.md` | Objective C1–C6 criteria for a healthy final state | For self-check and review |
| `.agents/agents/` | Antigravity subagents (`leader`, `spec_author`, `implementer`, `reviewer`, `commiter`) | When orchestrating work in Antigravity |
| `.codex/config.toml` and `.codex/agents/` | OpenAI Codex multi-agent configuration and subagents | When orchestrating work in Codex |
| `.claude/agents/` and `CLAUDE.md` | Claude Code subagent configuration and entry import | When orchestrating work in Claude Code |

Consult `docs/architecture.md` for the concrete module, package, and layer layout of this project.

## 3. Hard Rules (Non-Negotiable)

- **One feature at a time.** Never mix changes from multiple features in the same session.
- **Never declare a task `done` without green verification.** Run every mandatory command in `docs/verification.md` and confirm all pass.
- **Never skip the spec phase.** Every feature with `"sdd": true` must go through `spec_author` and receive human approval before any code is touched.
- **Never bypass the human approval gates.** The `leader` stops at `spec_ready` (spec approval) and after `reviewer` `APPROVED` (feature acceptance), and waits for the human.
- **Never close a feature without atomic commits and a PR.** After human sign-off, the `leader` invokes `commiter` to create `feat/<name>`, make atomic commits, push, and open a PR against `main`.
- **Document as you work** in `progress/current.md` in real time, not after finishing.
- **Leave the repository clean** before closing the session (see §5).
- **If you are unsure, read `docs/`** instead of guessing.

## 4. Workflow (SDD)

```text
pending → [spec_author] → spec_ready → ⏸ HUMAN APPROVES → in_progress
       → [implementer → reviewer] → ⏸ HUMAN ACCEPTS
       → [implementer: done] → [commiter: commits + PR]
```

1. `leader` locates the first `pending` feature with `"sdd": true` (or coordinates based on current state in `feature_list.json`).
2. `leader` invokes `spec_author`, who creates `specs/<name>/{requirements,design,tasks}.md` in English and transitions status to `spec_ready`.
3. **Pause.** The human reviews `specs/<name>/` and approves (or requests revisions).
4. Once approved, `leader` changes status to `in_progress` and invokes `implementer`.
5. `implementer` executes `tasks.md` in order, checking off `[x]` each completed task.
6. `reviewer` verifies `R<n>` ↔ test traceability, completed tasks, verification commands, and `CHECKPOINTS.md`; issues `APPROVED` or `CHANGES_REQUESTED`. On rejection, `leader` re-invokes `implementer` with concrete feedback and repeats the review loop.
7. Upon `APPROVED`, **pause again**: `leader` summarizes the verdict and asks the human whether everything is acceptable or changes are needed. If changes are requested, adjust via `implementer` (in-scope) or `spec_author` + re-approval (scope change) and repeat step 6.
8. After human sign-off, `implementer` marks the feature `done` and appends the session summary to `progress/history.md`.
9. `leader` invokes `commiter` to create `feat/<name>`, make atomic commits, push, and open the PR against `main` (`progress/pr_<name>.md`).

Subagents exchange artifacts via files on disk (`specs/<name>/`, `progress/*.md`) rather than dumping long specs or diffs into chat.

## 5. Session Close (Lifecycle)

Before finishing a session:

1. Run all mandatory verification commands from `docs/verification.md` — all green.
2. If the feature is complete and human sign-off has been granted: `implementer` sets `"status": "done"` in `feature_list.json`, and `leader` invokes `commiter` for branch `feat/<name>`, atomic commits, push, and PR against `main`.
3. Append the session summary from `progress/current.md` to the end of `progress/history.md`.
4. Reset `progress/current.md` to its empty template.
5. Leave no temporary files, debug logs, or untracked TODOs behind.

## 6. If You Get Blocked

- Re-read the relevant section of `docs/`.
- If a tool or verification check fails unexpectedly, **never invent a silent workaround**: document the blocker in `progress/current.md` (and mark `"status": "blocked"` if appropriate) and stop the session.

## 7. General Engineering and Style Rules

- Always use **English** in code, identifiers, comments, SDD templates, specs, and commit messages.
- Favor simplicity over complexity (KISS), eliminate duplication (DRY), and apply SOLID where it improves clarity.
- Write self-explanatory code; avoid redundant comments that merely restate what the code does.
- Use descriptive names for variables, functions, classes, and files; avoid non-standard abbreviations.
- Keep functions small with a single responsibility and extract magic numbers or strings into named constants.
- Respect formatting and static-analysis rules defined in `docs/conventions.md` and `docs/verification.md` without disabling them unless explicitly justified.
- Avoid adding external dependencies without a clear benefit; reuse existing modules and utilities first.
- Prefer composition over inheritance, remove dead or commented-out code, and avoid premature optimization.
- Handle errors explicitly and consistently; never assume nullable or missing values without validation.
- Use the strictest typing and contract enforcement available in the project language; avoid unsafe wildcard types.
- Do not modify files unrelated to the active feature or break public APIs without justification; deliver complete solutions without unresolved TODOs.
