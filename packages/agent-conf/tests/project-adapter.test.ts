import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  formatValidationReport,
  stripManagedBlocks,
  validateHarness,
} from "@repo/agent-conf";
import {
  createValidProjectFixture,
  PACKAGE_ROOT,
  readFixtureFile,
  removeTempDir,
  writeFixtureFile,
} from "./helpers.ts";

describe("agnostic project and adapter validation", () => {
  it("validates heterogeneous Python, Go, and Rust projects with no package.json (R11)", () => {
    for (const stack of ["python", "go", "rust"] as const) {
      const projectDir = createValidProjectFixture({ stack });
      try {
        assert.equal(
          fs.existsSync(path.join(projectDir, "package.json")),
          false,
        );

        const result = validateHarness({
          rootDir: projectDir,
          mode: "project",
        });

        assert.equal(
          result.valid,
          true,
          `Expected ${stack} project to pass:\n${formatValidationReport(result)}`,
        );
        assert.equal(result.summary.errorCount, 0);
      } finally {
        removeTempDir(projectDir);
      }
    }
  });

  it("rejects project missing required dot-prefixed agent folders or base files (R11)", () => {
    const projectDir = createValidProjectFixture({ stack: "go" });
    try {
      fs.rmSync(path.join(projectDir, ".agents/agents"), {
        recursive: true,
        force: true,
      });

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "HARNESS_MISSING_PATH" &&
            issue.filePath === ".agents/agents",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects unresolved placeholders, TODO(agent-conf) markers, missing adapter sections, and invalid/empty verification commands with file and line (R12)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        "docs/architecture.md",
        "# Architecture\n\n## Overview\n\nProject {{PROJECT_NAME}} overview.\n",
      );
      writeFixtureFile(
        projectDir,
        "docs/conventions.md",
        "# Conventions\n\n## Language\n\nTODO(agent-conf) fill this in.\n",
      );
      writeFixtureFile(
        projectDir,
        "docs/verification.md",
        `# Verification

## Commands

| Check | Command | Status |
|---|---|---|
| **Lint** | \`ruff check .\` | Mandatory |
| **Tests** | \`pytest\` | Pending configuration |
| **Typecheck** | TBD | Mandatory |
| **Build** | no backticks here | Mandatory |
`,
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      const unresolvedArch = result.issues.find(
        (issue) =>
          issue.code === "ADAPTER_UNRESOLVED_PLACEHOLDER" &&
          issue.filePath === "docs/architecture.md",
      );
      assert.ok(unresolvedArch);
      assert.equal(unresolvedArch.line, 5);

      const unresolvedConv = result.issues.find(
        (issue) =>
          issue.code === "ADAPTER_UNRESOLVED_PLACEHOLDER" &&
          issue.filePath === "docs/conventions.md",
      );
      assert.ok(unresolvedConv);
      assert.equal(unresolvedConv.line, 5);

      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "ADAPTER_MISSING_SECTION" &&
            issue.filePath === "docs/architecture.md",
        ),
      );
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "ADAPTER_MISSING_SECTION" &&
            issue.filePath === "docs/conventions.md",
        ),
      );

      const emptyCmdIssues = result.issues.filter(
        (issue) =>
          issue.code === "VERIFICATION_EMPTY_COMMAND" &&
          issue.filePath === "docs/verification.md",
      );
      assert.equal(emptyCmdIssues.length, 3);
      assert.deepEqual(
        emptyCmdIssues.map((issue) => issue.line),
        [8, 9, 10],
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects verification document without required Markdown table or lint/test rows (R12)", () => {
    const projectDir = createValidProjectFixture({ stack: "go" });
    try {
      writeFixtureFile(
        projectDir,
        "docs/verification.md",
        "# Verification\n\nJust run commands manually.\n",
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "VERIFICATION_INVALID_TABLE" &&
            issue.filePath === "docs/verification.md",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects residual Spanish in canonical SDD files while ignoring managed blocks and inline code (R13)", () => {
    const projectDir = createValidProjectFixture({
      stack: "python",
      withManagedBlock: true,
    });
    try {
      const agentsWithSpanishInManagedBlock = readFixtureFile(
        projectDir,
        "AGENTS.md",
      ).replace(
        "# Managed block from external tooling",
        "# Bloque gestionado externo con tildes áéíóú",
      );
      writeFixtureFile(
        projectDir,
        "AGENTS.md",
        agentsWithSpanishInManagedBlock,
      );

      const managedOnlyRes = validateHarness({
        rootDir: projectDir,
        mode: "project",
      });
      assert.equal(
        managedOnlyRes.valid,
        true,
        formatValidationReport(managedOnlyRes),
      );

      writeFixtureFile(
        projectDir,
        "CLAUDE.md",
        `${readFixtureFile(projectDir, "CLAUDE.md")}\n- Reglas del proyecto en español.\n`,
      );
      writeFixtureFile(
        projectDir,
        "CHECKPOINTS.md",
        `${readFixtureFile(projectDir, "CHECKPOINTS.md")}\n## C7 — Revisión obligatoria\n`,
      );

      const spanishRes = validateHarness({
        rootDir: projectDir,
        mode: "project",
      });
      assert.equal(spanishRes.valid, false);

      const claudeIssue = spanishRes.issues.find(
        (issue) =>
          issue.code === "NON_ENGLISH_CONTENT" &&
          issue.filePath === "CLAUDE.md",
      );
      assert.ok(claudeIssue);
      assert.ok((claudeIssue.line ?? 0) > 1);

      const checkpointsIssue = spanishRes.issues.find(
        (issue) =>
          issue.code === "NON_ENGLISH_CONTENT" &&
          issue.filePath === "CHECKPOINTS.md",
      );
      assert.ok(checkpointsIssue);
      assert.ok((checkpointsIssue.line ?? 0) > 1);
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("verifies canonical template parity while ignoring managed blocks in AGENTS.md (R17)", () => {
    const projectDir = createValidProjectFixture({
      stack: "python",
      withManagedBlock: true,
    });
    try {
      const stripped = stripManagedBlocks(
        "<!-- BEGIN:tool -->\nignored\n<!-- END:tool -->\n\n---\n\n# Title\n\n---\n\nFooter\n",
      );
      assert.equal(stripped, "# Title\n\n---\n\nFooter\n");

      const validRes = validateHarness({
        rootDir: projectDir,
        mode: "project",
        canonicalTemplateRoot: PACKAGE_ROOT,
      });
      assert.equal(validRes.valid, true, formatValidationReport(validRes));

      const originalClaude = readFixtureFile(projectDir, "CLAUDE.md");
      writeFixtureFile(
        projectDir,
        "CLAUDE.md",
        `${originalClaude}\n- Extra drifted line.\n`,
      );

      const driftedRes = validateHarness({
        rootDir: projectDir,
        mode: "project",
        canonicalTemplateRoot: PACKAGE_ROOT,
      });
      assert.equal(driftedRes.valid, false);
      assert.ok(
        driftedRes.issues.some(
          (issue) =>
            issue.code === "CANONICAL_SYNC_MISMATCH" &&
            issue.filePath === "CLAUDE.md",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });
});
