# Verification — Proving the Work Functions

> Golden rule: **an agent never claims "it works" — it proves it**.
> Every feature ends with executable evidence, never bare assertions.
> This file is the single source of truth for the project's verification commands.

## Project Commands ({{PROJECT_NAME}})

| Check | Command | Status |
|---|---|---|
| **Lint / static analysis** | `{{LINT_COMMAND}}` | Mandatory, active |
| **Typecheck / compilation** | `{{TYPECHECK_COMMAND}}` | Mandatory, active |
| **Tests** | `{{TEST_COMMAND}}` | Mandatory, active |
| **Build** | `{{BUILD_COMMAND}}` | Mandatory when applicable or before release |

## Verification Levels

### Level 1 — Unit and Integration Tests (Mandatory)

Every new public function, service, or module with logic must have at least one test that:
1. Covers the happy path and asserts the concrete expected outcome.
2. Covers at least one relevant error path or edge case.

```bash
{{TEST_COMMAND}}
```

### Level 2 — Static Analysis and Typecheck (Mandatory)

```bash
{{LINT_COMMAND}}
{{TYPECHECK_COMMAND}}
```

Both must finish with `0` errors and `0` warnings.

### Level 3 — Build (When Applicable or Before Release)

```bash
{{BUILD_COMMAND}}
```

### Level 4 — Requirement Traceability (Mandatory for `"sdd": true`)

Every `R<n>` in `specs/<name>/requirements.md` must map to at least one concrete test in the project test suite. `reviewer` rejects the feature if coverage is missing.

## Anti-Patterns (Do Not)

- ❌ "I added the feature, it looks good." → missing executable evidence.
- ❌ A test that only checks no exception was thrown → must assert concrete outputs or side effects.
- ❌ Reporting tests green when the runner does not exist or ran only a partial filter without stating so.
- ❌ Marking a feature `done` while lint, typecheck, build, or tests fail.

## Final Verification Before Closing a Session

```bash
{{FINAL_VERIFICATION_COMMAND}}
```

If any check fails or required test infrastructure is missing, **do not** mark the feature `done`. Document the blocker in `progress/current.md` and set `"status": "blocked"` in `feature_list.json`.
