# Architecture — What "Doing a Good Job" Means

> This document defines the technical structure and quality bar of the repository.
> Agents (`spec_author`, `implementer`, `reviewer`) consult and evaluate work against this file.
> Adapt every `{{...}}` placeholder to the target repository's real architecture without editing generic agent definitions.

## Project Structure ({{PROJECT_NAME}})

{{PROJECT_ARCHITECTURE_SUMMARY}}

```text
{{DIRECTORY_TREE}}
```

## Architectural Principles

1. **Project orchestration and tooling:**
   {{TOOLCHAIN_PRINCIPLES}}

2. **Separation of concerns and layer boundaries:**
   {{LAYER_BOUNDARIES}}

3. **Clean dependency boundaries:**
   {{DEPENDENCY_RULES}}

4. **Contracts and code quality:**
   {{CODE_QUALITY_PRINCIPLES}}

5. **Verification and testing:**
   Every new feature with meaningful logic must ship with automated tests and keep every mandatory command in `docs/verification.md` green.

## What Not To Do

- ❌ {{ANTI_PATTERN_1}}
- ❌ {{ANTI_PATTERN_2}}
- ❌ Do not introduce circular dependencies between modules or leave debug logs in production code.
- ❌ Do not skip mandatory verification commands in `docs/verification.md` when closing a feature.
