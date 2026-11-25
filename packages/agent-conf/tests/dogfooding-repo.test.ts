import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  formatValidationReport,
  runCli,
  validateHarness,
} from "@repo/agent-conf";
import { PACKAGE_ROOT, REPO_ROOT } from "./helpers.ts";

const SPANISH_RESIDUAL_PATTERN =
  /[¡¿áéíóúñüÁÉÍÓÚÑÜ]|\b(Configuracion|arnes|Sesión|Bitácora|Arquitectura|Convenciones|Verificación|Pendiente de configurar)\b/i;

describe("Olcina-IA English dogfooding and workspace test infrastructure", () => {
  it("passes full English project validation with canonical parity against packages/agent-conf while preserving Turborepo managed block (R13, R17, R19)", () => {
    const rootAgentsMd = fs.readFileSync(
      path.join(REPO_ROOT, "AGENTS.md"),
      "utf8",
    );
    assert.match(rootAgentsMd, /<!-- BEGIN:turborepo-agent-rules -->/);
    assert.match(rootAgentsMd, /<!-- END:turborepo-agent-rules -->/);

    const removedAgents = [
      ".agents/agents/secure-auditer.md",
      ".agents/agents/skill-generator.md",
      ".claude/agents/secure-auditer.md",
      ".claude/agents/skill-generator.md",
      ".codex/agents/secure-auditer.toml",
      ".codex/agents/skill-generator.toml",
    ];
    for (const relPath of removedAgents) {
      assert.equal(
        fs.existsSync(path.join(REPO_ROOT, relPath)),
        false,
        `Excluded agent should have been deleted: ${relPath}`,
      );
    }

    const currentProgress = fs.readFileSync(
      path.join(REPO_ROOT, "progress/current.md"),
      "utf8",
    );
    const historyProgress = fs.readFileSync(
      path.join(REPO_ROOT, "progress/history.md"),
      "utf8",
    );
    assert.match(currentProgress, /^# Current Session/m);
    assert.match(historyProgress, /^# Historical Log/m);
    assert.doesNotMatch(currentProgress, SPANISH_RESIDUAL_PATTERN);
    assert.doesNotMatch(historyProgress, SPANISH_RESIDUAL_PATTERN);

    const result = validateHarness({
      rootDir: REPO_ROOT,
      mode: "project",
      canonicalTemplateRoot: PACKAGE_ROOT,
    });
    assert.equal(result.valid, true, formatValidationReport(result));
    assert.equal(result.summary.errorCount, 0);
    assert.equal(
      result.issues.some((issue) => issue.code === "NON_ENGLISH_CONTENT"),
      false,
    );

    const cliResult = runCli([
      "--mode",
      "project",
      "--root",
      REPO_ROOT,
      "--canonical-root",
      PACKAGE_ROOT,
    ]);
    assert.equal(cliResult.exitCode, 0, cliResult.stdout + cliResult.stderr);
  });

  it("configures the workspace test task across root package.json, turbo.json, and packages/agent-conf/package.json (R18)", () => {
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    assert.equal(rootPkg.scripts?.test, "turbo run test");

    const turboJson = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "turbo.json"), "utf8"),
    ) as {
      tasks?: {
        build?: { outputs?: string[] };
        test?: { dependsOn?: string[] };
      };
    };
    assert.ok(turboJson.tasks?.build?.outputs?.includes("dist/**"));
    assert.deepEqual(turboJson.tasks?.test?.dependsOn, ["build", "^build"]);

    const agentConfPkg = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    assert.equal(agentConfPkg.scripts?.test, "node --test");
  });

  it("updates root docs/architecture.md, docs/conventions.md, docs/verification.md, and feature_list.json description in English with @repo/agent-conf and active pnpm test (R13, R20)", () => {
    const archDoc = fs.readFileSync(
      path.join(REPO_ROOT, "docs/architecture.md"),
      "utf8",
    );
    assert.match(archDoc, /agent-conf/);
    assert.match(archDoc, /@repo\/agent-conf/);
    assert.doesNotMatch(archDoc, SPANISH_RESIDUAL_PATTERN);

    const convDoc = fs.readFileSync(
      path.join(REPO_ROOT, "docs/conventions.md"),
      "utf8",
    );
    assert.match(convDoc, /^# Code Conventions/m);
    assert.match(convDoc, /English/);
    assert.doesNotMatch(convDoc, SPANISH_RESIDUAL_PATTERN);

    const verificationDoc = fs.readFileSync(
      path.join(REPO_ROOT, "docs/verification.md"),
      "utf8",
    );
    assert.match(verificationDoc, /`pnpm test`/);
    assert.doesNotMatch(
      verificationDoc,
      /Pendiente de configurar|Pending configuration/i,
    );
    assert.doesNotMatch(verificationDoc, SPANISH_RESIDUAL_PATTERN);

    const featureList = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "feature_list.json"), "utf8"),
    ) as { description?: string };
    assert.equal(typeof featureList.description, "string");
    assert.match(featureList.description ?? "", /Spec Driven Development/i);
    assert.doesNotMatch(
      featureList.description ?? "",
      SPANISH_RESIDUAL_PATTERN,
    );
  });
});
