# Requirements — `agent-conf`

> Specification of requirements in **strict English EARS notation** (see `docs/specs.md`).
> Every requirement contains a single normative clause (`SHALL` or `SHALL NOT`), avoids ambiguous modal verbs, and is verifiable through concrete automated tests.

## 1. Static Template Package and Read-Only Validation CLI

- **R1:** The system SHALL expose in `packages/agent-conf` an internal workspace package (`@repo/agent-conf`) providing a typed programmatic validation library and a read-only validation CLI executable.

- **R2:** IF the `packages/agent-conf` CLI executable receives installation or mutation subcommands such as `init`, `update`, `install`, `sync`, or `upgrade` (or unrecognized flags), THEN the system SHALL exit with a non-zero status code and report a usage error without modifying any file on disk.

- **R3:** The system SHALL organize agent platform configurations inside `packages/agent-conf` under dot-free directories at `agents/agents/` (Antigravity), `claude/agents/` (Claude Code), and `codex/` (`codex/config.toml` and `codex/agents/` for OpenAI Codex).

- **R4:** The system SHALL include in `packages/agent-conf` the base SDD harness templates at `AGENTS.md`, `CLAUDE.md`, `CHECKPOINTS.md`, `docs/architecture.md`, `docs/conventions.md`, `docs/specs.md`, `docs/verification.md`, `feature_list.json`, `progress/current.md`, `progress/history.md`, and `specs/README.md`.

## 2. Pure Five-Agent English SDD Model Without Skills

- **R5:** The system SHALL include in every configured platform (`agents/agents/`, `claude/agents/`, and `codex/agents/` in `template` mode, or `.agents/agents/`, `.claude/agents/`, and `.codex/agents/` in `project` mode) exclusively the five pure SDD workflow agents (`leader`, `spec_author`, `implementer`, `reviewer`, and `commiter`).

- **R6:** The system SHALL NOT include skill directories or references to skills (`SKILL.md`, `.agents/skills`, `.claude/skills`, `.codex/skills`), `secure-auditer`, or `skill-generator` in SDD harness templates or in the five SDD agent definitions.

- **R7:** The system SHALL author all five SDD agent system prompts, core SDD harness templates, adapter templates in `packages/agent-conf`, and SDD specifications (`specs/<name>/{requirements,design,tasks}.md`) strictly in English.

## 3. Stack Neutrality and Project Adapter Contract

- **R8:** The system SHALL NOT couple the prompts, rules, or SDD templates in `packages/agent-conf` to any project-specific stack, framework, package manager, or repository name (such as `Olcina-IA`, Turborepo, pnpm, Next.js, React, TypeScript, ESLint, Prettier, or Vercel).

- **R9:** The system SHALL delegate target-repository specifics to the adapter templates (`docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, and `feature_list.json`) using explicit placeholder tokens formatted as `{{PLACEHOLDER_NAME}}`.

## 4. Stack-Agnostic Validation Layer

- **R10:** WHEN validation runs in `template` mode on a source package directory, the system SHALL verify the presence and integrity of all base templates, the existence of dot-free platform folders (`agents/`, `claude/`, `codex/`), the absence of `skills/` or dot-prefixed folders (`.agents/`, `.claude/`, `.codex/`), and the presence of `{{...}}` placeholders in adapter files.

- **R11:** WHEN validation runs in `project` mode on any consumer repository, the system SHALL verify the existence and non-emptiness of the base harness files and dot-prefixed platform directories (`.agents/agents/`, `.claude/agents/`, and `.codex/`) without assuming any programming language or package manager.

- **R12:** IF in `project` mode any adapter document (`docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`) or `feature_list.json` retains unresolved template markers (`{{...}}` or `TODO(agent-conf)`), omits required structural headings, or declares empty or pending mandatory commands in `docs/verification.md`, THEN the system SHALL reject validation reporting the rule code, file path, and affected line.

- **R13:** IF any canonical SDD harness file (`AGENTS.md` outside managed blocks, `CLAUDE.md`, `CHECKPOINTS.md`, `docs/specs.md`, `specs/README.md`), template file in `template` mode, SDD agent definition, or SDD specification file contains residual Spanish prose or headings, THEN the system SHALL report a `NON_ENGLISH_CONTENT` validation error with file path and line number.

- **R14:** WHEN agent configurations are validated in `template` or `project` mode, the system SHALL verify YAML frontmatter syntax in Antigravity and Claude Code, TOML syntax in Codex `config.toml` and agent files, role-based tool restrictions, and cross-platform parity of headings and output contracts across all three platforms for the five SDD agents.

- **R15:** WHEN `feature_list.json` is validated in `project` mode, the system SHALL verify the JSON schema (`project`, `description`, `rules`, and `features`), unique `kebab-case` feature `name` values, valid `status` membership, and at most one feature in `in_progress` status.

- **R16:** WHEN an SDD feature (`"sdd": true`) in `feature_list.json` has status `spec_ready`, `in_progress`, or `done`, the system SHALL verify that `specs/<name>/` contains `requirements.md` written in strict English EARS syntax (sequential `R1..Rn` items each with a single `SHALL` or `SHALL NOT` normative clause, rejecting non-English EARS keywords such as `DEBE`/`CUANDO` and ambiguous English verbs `can`, `could`, `may`, `might`, `should`, `support`, `supports`), `design.md` with required technical sections and at least one discarded alternative, and `tasks.md` with sequential `T1..Tm` items covering all `R<n>` IDs (all checked `[x]` when status is `done` unless a deviation is documented in `progress/impl_<name>.md`).

- **R17:** WHERE validation is invoked in `project` mode with `canonicalTemplateRoot` specified, the system SHALL verify that invariant core SDD files and all fifteen SDD agent files in the consumer repository match the normalized source of truth in `packages/agent-conf` (ignoring tool-managed comment blocks delimited by `<!-- BEGIN:... -->` and `<!-- END:... -->` in `AGENTS.md`).

## 5. Workspace Test Infrastructure and English Dogfooding in `Olcina-IA`

- **R18:** The system SHALL configure the `test` task in root `package.json`, `turbo.json`, and `packages/agent-conf/package.json` to execute the automated test suite via `pnpm test` covering `packages/agent-conf` templates and the validation layer.

- **R19:** The system SHALL synchronize the root of `Olcina-IA` (`AGENTS.md` preserving the Turborepo managed block, `CLAUDE.md`, `CHECKPOINTS.md`, `docs/specs.md`, `progress/current.md`, `progress/history.md`, `specs/README.md`, `.agents/agents/`, `.claude/agents/`, and `.codex/`) in English with `packages/agent-conf`, keeping `secure-auditer` and `skill-generator` absent and passing agnostic validation with canonical parity.

- **R20:** The system SHALL update `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, and the root `feature_list.json` description in `Olcina-IA` in English to document `packages/agent-conf` (`@repo/agent-conf`) in the monorepo architecture and declare `pnpm test` as an active mandatory verification command.
