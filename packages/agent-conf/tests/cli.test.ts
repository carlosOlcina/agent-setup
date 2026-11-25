import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { describe, it } from "node:test";
import { runCli, type ValidationResult } from "@repo/agent-conf";
import {
  createTempDir,
  createValidProjectFixture,
  PACKAGE_ROOT,
  removeTempDir,
  snapshotDirectoryTree,
  writeFixtureFile,
} from "./helpers.ts";

const CLI_BIN_PATH = path.join(PACKAGE_ROOT, "dist/cli.js");

describe("agent-conf-validate read-only CLI", () => {
  it("validates packages/agent-conf in template mode via runCli and binary executable with human and JSON output (R1)", () => {
    const helpResult = runCli(["--help"]);
    assert.equal(helpResult.exitCode, 0);
    assert.match(helpResult.stdout, /Read-only Spec Driven Development/i);
    assert.equal(helpResult.stderr, "");

    const textResult = runCli(["--mode", "template", "--root", PACKAGE_ROOT]);
    assert.equal(textResult.exitCode, 0);
    assert.match(textResult.stdout, /SDD Harness Validation: PASS/);

    const jsonResult = runCli([
      "--mode=template",
      `--root=${PACKAGE_ROOT}`,
      "--json",
    ]);
    assert.equal(jsonResult.exitCode, 0);
    const parsed = JSON.parse(jsonResult.stdout) as ValidationResult;
    assert.equal(parsed.valid, true);
    assert.equal(parsed.summary.mode, "template");

    const proc = spawnSync(
      process.execPath,
      [CLI_BIN_PATH, "--mode", "template", "--root", PACKAGE_ROOT, "--json"],
      { encoding: "utf8" },
    );
    assert.equal(proc.status, 0);
    const binParsed = JSON.parse(proc.stdout) as ValidationResult;
    assert.equal(binParsed.valid, true);
  });

  it("returns exit code 1 when validation fails without modifying target files (R1)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        "docs/architecture.md",
        "# Architecture\n\n## Structure\n\n{{UNRESOLVED}}\n\n## Principles\n\nOk.\n\n## What Not To Do\n\nOk.\n",
      );
      const before = snapshotDirectoryTree(projectDir);

      const cliRes = runCli([
        "--mode",
        "project",
        "--root",
        projectDir,
        "--json",
      ]);
      assert.equal(cliRes.exitCode, 1);
      const parsed = JSON.parse(cliRes.stdout) as ValidationResult;
      assert.equal(parsed.valid, false);
      assert.ok(
        parsed.issues.some(
          (issue) => issue.code === "ADAPTER_UNRESOLVED_PLACEHOLDER",
        ),
      );

      const after = snapshotDirectoryTree(projectDir);
      assert.deepEqual(after, before);
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects init, update, install, sync, upgrade, and unknown flags with exit code 2 and zero disk mutations (R2)", () => {
    const sandboxDir = createTempDir("agent-conf-cli-readonly-");
    try {
      writeFixtureFile(sandboxDir, "existing.txt", "untouched\n");
      const before = snapshotDirectoryTree(sandboxDir);

      for (const forbidden of [
        "init",
        "update",
        "install",
        "sync",
        "upgrade",
        "--write",
      ]) {
        const res = runCli([forbidden], sandboxDir);
        assert.equal(res.exitCode, 2, `Expected exitCode 2 for "${forbidden}"`);
        assert.equal(res.stdout, "");
        assert.match(res.stderr, /Usage error:/);
      }

      const binProc = spawnSync(process.execPath, [CLI_BIN_PATH, "init"], {
        cwd: sandboxDir,
        encoding: "utf8",
      });
      assert.equal(binProc.status, 2);
      assert.match(binProc.stderr, /read-only/i);

      const after = snapshotDirectoryTree(sandboxDir);
      assert.deepEqual(after, before);
    } finally {
      removeTempDir(sandboxDir);
    }
  });
});
