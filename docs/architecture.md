# Architecture — What "Doing a Good Job" Means

> This document defines the technical structure and quality bar of the repository.
> Agents (`spec_author`, `implementer`, `reviewer`) consult and evaluate work against this file.
> When adapting this harness to another project, update this file (together with `docs/conventions.md` and `docs/verification.md`) without modifying generic agent definitions.

## Monorepo Structure (Olcina-IA)

This repository is a monorepo managed with **Turborepo** and **pnpm** (`package.json`, `pnpm-workspace.yaml`, `turbo.json`), configured for multi-service deployment on Vercel (`vercel.json`):

```text
apps/
├── web/                  # Main web application (Next.js 16 + React 19)
└── docs/                 # Documentation application (Next.js 16 + React 19, served under /docs)

packages/
├── agent-conf/           # @repo/agent-conf — pure English static SDD templates and read-only agnostic validator
├── ui/                   # @repo/ui — shared React component library
├── eslint-config/        # @repo/eslint-config — shared ESLint configuration
└── typescript-config/    # @repo/typescript-config — shared base tsconfig
```

## Architectural Principles

1. **Task orchestration via Turborepo and pnpm.**
   Run workspace tasks through `pnpm` and `turbo` (see exact commands in `docs/verification.md`), avoiding ad-hoc direct tool invocations that bypass defined scripts.

2. **Clear separation between applications and shared packages:**
   - `apps/web/` and `apps/docs/` contain routes, pages, layouts, and app-specific Next.js logic.
   - `packages/agent-conf/` (`@repo/agent-conf`) is the single source of truth for the pure English 5-agent SDD harness (`leader`, `spec_author`, `implementer`, `reviewer`, `commiter`), dot-free platform folders (`agents/`, `claude/`, `codex/`), stack-agnostic base/adapter templates, and zero-runtime-dependency read-only validation library + CLI (`agent-conf-validate`). The `Olcina-IA` repository root dogfoods and synchronizes this canonical English SDD core.
   - `packages/ui/` hosts only reusable UI components and primitives shared across apps, decoupled from app routes or secrets.
   - `packages/eslint-config/` and `packages/typescript-config/` centralize shared tooling configurations across the monorepo.

3. **Clean dependency boundaries:**
   - Applications depend on `packages/*`, never on another application (`web` ↔ `docs`).
   - `packages/agent-conf` introduces zero external runtime dependencies and never couples its SDD templates to `Olcina-IA` or any specific technology stack.
   - Never introduce circular dependencies between workspace packages.

4. **Strict TypeScript:**
   - Maintain compatibility with `packages/typescript-config/base.json` (`strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`).
   - Never use `any`; explicitly type public APIs, contracts, and component props.

5. **Routing and composition:**
   - Preserve the routing boundaries in `vercel.json` (`/docs` and `/docs/(.*)` → `docs`, `/(.*)` → `web`).

6. **Verification and testing:**
   - Every new feature with business logic, tooling, or interactive UI ships with automated tests (`pnpm test`) and keeps lint, typecheck, and build green.

## What Not To Do

- ❌ Do not use `console.log()` for debugging or error handling; use explicit typed error handling.
- ❌ Do not duplicate UI components between `apps/web` and `apps/docs` when they belong in `@repo/ui`.
- ❌ Do not introduce circular workspace dependencies or couple `packages/agent-conf` templates to `Olcina-IA` stack details.
- ❌ Do not skip typecheck, lint, build, or automated tests when closing a feature.
