# `@repo/agent-conf`

Static Spec Driven Development (SDD) harness templates and stack-agnostic read-only validation layer.

## Contents

- **Core SDD harness templates:** `AGENTS.md`, `CLAUDE.md`, `CHECKPOINTS.md`, `docs/specs.md`, `specs/README.md`, `progress/current.md`, `progress/history.md`.
- **Project adapter templates (`{{...}}` placeholders):** `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, `feature_list.json`.
- **Platform agent configurations (5 pure SDD agents, dot-free directories):**
  - `agents/agents/{leader,spec_author,implementer,reviewer,commiter}.md` (Antigravity → copy to `.agents/agents/`)
  - `claude/agents/{leader,spec_author,implementer,reviewer,commiter}.md` (Claude Code → copy to `.claude/agents/`)
  - `codex/config.toml` and `codex/agents/{leader,spec_author,implementer,reviewer,commiter}.toml` (OpenAI Codex → copy to `.codex/`)
- **Validation library and read-only CLI (`src/`):** zero runtime dependencies; validates both the source template package (`--mode template`) and any target repository (`--mode project`, optionally checking canonical parity via `--canonical-root`).

## Usage

### CLI (read-only)

```bash
agent-conf-validate --mode template --root packages/agent-conf
agent-conf-validate --mode project --root . --canonical-root packages/agent-conf
agent-conf-validate --mode project --root /path/to/repo --json
```

This CLI is strictly read-only and never writes or mutates files on disk. Subcommands such as `init`, `update`, or `install` are rejected with exit code `2`.

### Programmatic API

```ts
import {
  assertValidHarness,
  formatValidationReport,
  runCli,
  stripManagedBlocks,
  validateHarness,
} from "@repo/agent-conf";
```
