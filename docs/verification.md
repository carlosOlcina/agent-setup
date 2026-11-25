# Verification — Proving the Work Functions

> Golden rule: **an agent never claims "it works" — it proves it**.
> Every feature ends with executable evidence, never bare assertions.
> This file is the single source of truth for the project's verification commands.

## Project Commands (`Olcina-IA`)

| Check | Command | Status |
|---|---|---|
| **Lint** | `pnpm lint` (`turbo run lint`) | Mandatory, active (`eslint --max-warnings 0`) |
| **Typecheck** | `pnpm check-types` (`turbo run check-types`) | Mandatory, active (`tsc --noEmit` / `next typegen`) |
| **Tests** | `pnpm test` (`turbo run test`) | Mandatory, active (`node --test` in `@repo/agent-conf`) |
| **Build** | `pnpm build` (`turbo run build`) | Mandatory when modifying routes, configs, or bundling |

> **Note on tests and harness validation:** `pnpm test` runs `turbo run test` (with `"dependsOn": ["build", "^build"]` in `turbo.json`), executing the native `node --test` (Node >= 24) test suite in `packages/agent-conf`, including full `project`-mode canonical validation of `Olcina-IA` against the source of truth in `packages/agent-conf`.

## Verification Levels

### Level 1 — Unit and Integration Tests (Mandatory)

Every new public function, hook, or module with logic must have at least one test that:
1. Covers the happy path and asserts the concrete expected outcome.
2. Covers at least one relevant error path or edge case.

```bash
pnpm test
```

### Level 2 — Lint and Typecheck (Mandatory)

```bash
pnpm lint
pnpm check-types
```

Both must finish with `0` errors and `0` warnings (`--max-warnings 0`).

### Level 3 — Build (When Applicable or Before Release)

```bash
pnpm build
```

### Level 4 — Requirement Traceability (Mandatory for `"sdd": true`)

Every `R<n>` in `specs/<name>/requirements.md` must map to at least one concrete test in the project test suite. `reviewer` rejects the feature if coverage is missing.

## Anti-Patterns (Do Not)

- ❌ "I added the feature, it looks good." → missing executable evidence.
- ❌ A test that only checks no exception was thrown → must assert concrete outputs or side effects.
- ❌ Reporting tests green when not executed after the last edit or run with undeclared partial filters.
- ❌ Marking a feature `done` while lint, typecheck, build, or tests fail.

## Final Verification Before Closing a Session

```bash
pnpm lint && pnpm check-types && pnpm test && pnpm build
```

If any check fails or required test infrastructure is missing, **do not** mark the feature `done`. Document the blocker in `progress/current.md` and set `"status": "blocked"` in `feature_list.json`.
