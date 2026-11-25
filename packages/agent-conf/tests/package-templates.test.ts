import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertValidHarness,
  formatValidationReport,
  HarnessValidationError,
  SDD_AGENTS,
  validateHarness,
} from "@repo/agent-conf";
import {
  createValidTemplateFixture,
  PACKAGE_ROOT,
  removeTempDir,
  writeFixtureFile,
} from "./helpers.ts";

describe("packages/agent-conf static templates and package contract", () => {
  it("exposes internal @repo/agent-conf package with zero runtime dependencies and CLI bin (R1)", () => {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as Record<string, unknown>;

    assert.equal(pkgJson.name, "@repo/agent-conf");
    assert.equal(pkgJson.dependencies, undefined);
    assert.deepEqual(pkgJson.bin, {
      "agent-conf-validate": "./dist/cli.js",
    });
    assert.equal(typeof validateHarness, "function");
    assert.equal(typeof assertValidHarness, "function");
    assert.equal(typeof formatValidationReport, "function");
  });

  it("organizes platform agent configs in dot-free directories agents/, claude/, and codex/ (R3)", () => {
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "agents/agents")), true);
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "claude/agents")), true);
    assert.equal(
      fs.existsSync(path.join(PACKAGE_ROOT, "codex/config.toml")),
      true,
    );
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, "codex/agents")), true);
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, ".agents")), false);
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, ".claude")), false);
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, ".codex")), false);
  });

  it("includes all 11 base SDD template files and only the 5 pure SDD agents without skills (R4, R5, R6)", () => {
    const expectedBaseFiles = [
      "AGENTS.md",
      "CLAUDE.md",
      "CHECKPOINTS.md",
      "docs/architecture.md",
      "docs/conventions.md",
      "docs/specs.md",
      "docs/verification.md",
      "feature_list.json",
      "progress/current.md",
      "progress/history.md",
      "specs/README.md",
    ];

    for (const relPath of expectedBaseFiles) {
      const fullPath = path.join(PACKAGE_ROOT, relPath);
      assert.equal(fs.existsSync(fullPath), true, `Missing ${relPath}`);
      assert.ok(fs.readFileSync(fullPath, "utf8").trim().length > 0);
    }

    const expectedMd = SDD_AGENTS.map((name) => `${name}.md`).sort();
    const expectedToml = SDD_AGENTS.map((name) => `${name}.toml`).sort();

    assert.deepEqual(
      fs.readdirSync(path.join(PACKAGE_ROOT, "agents/agents")).sort(),
      expectedMd,
    );
    assert.deepEqual(
      fs.readdirSync(path.join(PACKAGE_ROOT, "claude/agents")).sort(),
      expectedMd,
    );
    assert.deepEqual(
      fs.readdirSync(path.join(PACKAGE_ROOT, "codex/agents")).sort(),
      expectedToml,
    );
  });

  it("passes template validation cleanly with English stack-agnostic templates and explicit adapter placeholders (R7, R8, R9, R10)", () => {
    const result = validateHarness({
      rootDir: PACKAGE_ROOT,
      mode: "template",
    });

    assert.equal(result.valid, true, formatValidationReport(result));
    assert.equal(result.issues.length, 0);
    assert.equal(result.summary.mode, "template");
    assert.ok(result.summary.checkedFiles >= 27);

    const summary = assertValidHarness({
      rootDir: PACKAGE_ROOT,
      mode: "template",
    });
    assert.equal(summary.errorCount, 0);
  });

  it("rejects dot-prefixed dirs, skills dirs, stack coupling, missing placeholders, and non-English prose in template mode (R6, R7, R8, R9, R10, R13)", () => {
    const fixture = createValidTemplateFixture();
    try {
      fs.mkdirSync(path.join(fixture, ".agents"), { recursive: true });
      fs.mkdirSync(path.join(fixture, "agents/skills"), { recursive: true });
      writeFixtureFile(
        fixture,
        "AGENTS.md",
        `${fs.readFileSync(path.join(fixture, "AGENTS.md"), "utf8")}\nUse pnpm and Turborepo in Olcina-IA.\nReglas del proyecto en español.\n`,
      );
      writeFixtureFile(
        fixture,
        "docs/architecture.md",
        `# Architecture\n\n## Structure\n\nPlain text.\n\n## Principles\n\nRule.\n\n## What Not To Do\n\nNone.\n`,
      );

      const result = validateHarness({ rootDir: fixture, mode: "template" });
      assert.equal(result.valid, false);

      const codes = new Set(result.issues.map((issue) => issue.code));
      assert.equal(codes.has("TEMPLATE_FORBIDDEN_DOT_DIR"), true);
      assert.equal(codes.has("TEMPLATE_FORBIDDEN_SKILLS_DIR"), true);
      assert.equal(codes.has("TEMPLATE_STACK_COUPLED_CONTENT"), true);
      assert.equal(codes.has("TEMPLATE_MISSING_PLACEHOLDER"), true);
      assert.equal(codes.has("NON_ENGLISH_CONTENT"), true);

      const nonEnglishIssue = result.issues.find(
        (issue) =>
          issue.code === "NON_ENGLISH_CONTENT" &&
          issue.filePath === "AGENTS.md",
      );
      assert.ok(nonEnglishIssue);
      assert.ok((nonEnglishIssue.line ?? 0) > 1);

      assert.throws(
        () => assertValidHarness({ rootDir: fixture, mode: "template" }),
        (error: unknown) => {
          assert.ok(error instanceof HarnessValidationError);
          assert.equal(error.result.valid, false);
          return true;
        },
      );
    } finally {
      removeTempDir(fixture);
    }
  });

  it("reports missing or empty base harness files and validates options strictly (R1, R10)", () => {
    const fixture = createValidTemplateFixture();
    try {
      fs.unlinkSync(path.join(fixture, "CHECKPOINTS.md"));
      writeFixtureFile(fixture, "specs/README.md", "   \n");

      const result = validateHarness({ rootDir: fixture, mode: "template" });
      assert.equal(result.valid, false);
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "HARNESS_MISSING_PATH" &&
            issue.filePath === "CHECKPOINTS.md",
        ),
      );
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "HARNESS_EMPTY_FILE" &&
            issue.filePath === "specs/README.md",
        ),
      );

      assert.throws(
        () =>
          validateHarness({
            rootDir: "",
            mode: "template",
          }),
        TypeError,
      );
    } finally {
      removeTempDir(fixture);
    }
  });
});
