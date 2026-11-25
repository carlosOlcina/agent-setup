# Spec Driven Development (SDD)

> This repository follows a Kiro-style workflow: requirements → design → tasks → code.
> No implementation code is written until the specification is approved by a human.

## Structure

Every new feature with `"sdd": true` in `feature_list.json` receives a dedicated
folder as soon as it leaves `pending`:

```text
specs/<feature-name>/
├── requirements.md   # WHAT is needed (strict English EARS notation)
├── design.md         # HOW it will be built (technical decisions)
└── tasks.md          # Concrete ordered implementation checklist
```

The `<feature-name>` matches the `name` field in `feature_list.json`. All three
spec files are authored strictly in **English**.

## Feature Statuses

| Status | Meaning |
|---|---|
| `pending` | No spec yet. `spec_author` acts first. |
| `spec_ready` | Spec drafted. Waiting for human approval. DO NOT touch code. |
| `in_progress` | Spec approved. `implementer`/`reviewer` working, or waiting for human acceptance. |
| `done` | Verification green, `reviewer` approved, human accepted, and closed via PR. |
| `blocked` | Stuck. Reason documented in `progress/current.md`. |

## Human Approval Gates

The automated workflow pauses **twice**:

1. **Spec approval.** When `spec_author` finishes all three spec files, it marks the
   feature `spec_ready` and stops. The human reads `specs/<feature>/` and replies
   "approved" (or requests revisions).
2. **Acceptance after review.** When `reviewer` issues `APPROVED`
   (`progress/review_<feature>.md`), `leader` presents the verdict and asks whether
   everything is OK or changes are requested. If changes are requested, the feature
   is adjusted (`implementer`/`reviewer` if in scope, or `spec_author` + fresh spec
   approval if scope changes) and reviewed again. Only after human sign-off does
   `implementer` mark the feature `done`.

After human sign-off, `leader` invokes `commiter` to create branch `feat/<name>`,
create atomic commits, push, and open a PR against `main` (recording the summary
in `progress/pr_<feature>.md`).

```text
pending → [spec_author] → spec_ready → ⏸ HUMAN APPROVES → in_progress
       → [implementer → reviewer] → ⏸ HUMAN ACCEPTS
       → [implementer: done] → [commiter: commits + PR]
```

## `requirements.md` — Strict English EARS

Requirements are written strictly in English using **EARS** (Easy Approach to
Requirements Syntax). Every requirement is a numbered item using one of these
five patterns:

| Pattern | Template |
|---|---|
| **Ubiquitous** | `The system SHALL <action>.` (or `The system SHALL NOT <action>.`) |
| **Event-driven** | `WHEN <trigger>, the system SHALL <action>.` |
| **State-driven** | `WHILE <state>, the system SHALL <action>.` |
| **Optional** | `WHERE <optional feature>, the system SHALL <action>.` |
| **Unwanted** | `IF <unwanted condition>, THEN the system SHALL <action>.` |

Hard rules:

- Each requirement has a sequential, stable ID: `R1`, `R2`, ...
- Each requirement must be verifiable by at least one concrete automated test.
- Never combine multiple `SHALL` clauses in one requirement. Split into separate IDs instead.
- Never use weak or ambiguous verbs (`can`, `could`, `may`, `might`, `should`, `support`, `supports`). Use only `SHALL` or `SHALL NOT`.

## `design.md` — Technical Decisions

Captured **before** touching code:

- Affected files to create, modify, or delete.
- New public signatures, contracts, schemas, or types.
- Errors or exceptions reused or introduced.
- At least one discarded alternative and the technical reason for rejecting it.

Do not reinvent fundamentals — build on `docs/architecture.md` and `docs/conventions.md`.

## `tasks.md` — Executable Checklist

Discrete ordered steps, each with a checkbox (`- [ ] T1 ...`). Every task references
at least one `R<n>` that it covers, and together `T1..Tm` cover every `R1..Rn`.

`implementer` checks off `[x]` each task upon completion. `reviewer` rejects if any
`[ ]` remains without a valid documented justification in `progress/impl_<name>.md`.

## Traceability (Hard Rule)

- Every test added or updated for the feature maps to an `R<n>` in its spec.
- Every `R<n>` has at least one concrete test in the project's automated test suite.
- `reviewer` explicitly verifies this mapping and rejects the feature if any gap exists.
