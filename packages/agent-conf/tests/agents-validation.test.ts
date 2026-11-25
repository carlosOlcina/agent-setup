import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateHarness } from "@repo/agent-conf";
import {
  createValidProjectFixture,
  readFixtureFile,
  removeTempDir,
  writeFixtureFile,
} from "./helpers.ts";

describe("SDD agents syntax, membership, tool restrictions, language, and cross-platform parity", () => {
  it("rejects unexpected excluded agents and missing required SDD agents (R5)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        ".agents/agents/secure-auditer.md",
        "---\nname: secure-auditer\n---\n# Extra\n",
      );
      fs.unlinkSync(path.join(projectDir, ".claude/agents/commiter.md"));

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "AGENT_UNEXPECTED_FILE" &&
            issue.filePath === ".agents/agents/secure-auditer.md",
        ),
      );
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "AGENT_MISSING_FILE" &&
            issue.filePath === ".claude/agents/commiter.md",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects forbidden skill or excluded agent references in core docs and agent configs (R6)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        "CLAUDE.md",
        `${readFixtureFile(projectDir, "CLAUDE.md")}\n- Skills live in .agents/skills/SKILL.md.\n`,
      );
      writeFixtureFile(
        projectDir,
        ".agents/agents/implementer.md",
        `${readFixtureFile(projectDir, ".agents/agents/implementer.md")}\nAlso call skill-generator.\n`,
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      const forbiddenIssues = result.issues.filter(
        (issue) => issue.code === "AGENT_FORBIDDEN_REFERENCE",
      );
      assert.ok(
        forbiddenIssues.some((issue) => issue.filePath === "CLAUDE.md"),
      );
      assert.ok(
        forbiddenIssues.some(
          (issue) => issue.filePath === ".agents/agents/implementer.md",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects residual Spanish prose or descriptions in SDD agent configurations across all platforms (R7, R13)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        ".agents/agents/leader.md",
        `${readFixtureFile(projectDir, ".agents/agents/leader.md")}\nEres el agente coordinador.\n`,
      );
      writeFixtureFile(
        projectDir,
        ".claude/agents/reviewer.md",
        readFixtureFile(projectDir, ".claude/agents/reviewer.md").replace(
          "Automated strict reviewer.",
          "Revisor automático estricto.",
        ),
      );
      writeFixtureFile(
        projectDir,
        ".codex/agents/spec_author.toml",
        readFixtureFile(projectDir, ".codex/agents/spec_author.toml").replace(
          "You never write application code.",
          "Nunca escribes código de aplicación.",
        ),
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      const nonEnglishIssues = result.issues.filter(
        (issue) => issue.code === "NON_ENGLISH_CONTENT",
      );
      assert.ok(
        nonEnglishIssues.some(
          (issue) =>
            issue.filePath === ".agents/agents/leader.md" &&
            (issue.line ?? 0) > 1,
        ),
      );
      assert.ok(
        nonEnglishIssues.some(
          (issue) =>
            issue.filePath === ".claude/agents/reviewer.md" && issue.line === 3,
        ),
      );
      assert.ok(
        nonEnglishIssues.some(
          (issue) =>
            issue.filePath === ".codex/agents/spec_author.toml" &&
            (issue.line ?? 0) > 1,
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects invalid YAML frontmatter and invalid TOML syntax with line numbers (R14)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        ".agents/agents/leader.md",
        '---\nname: leader\ndescription: "unterminated\n---\n# Broken\n',
      );
      writeFixtureFile(
        projectDir,
        ".codex/config.toml",
        "[features]\nmulti_agent = true\n[agents\nenabled = true\n",
      );
      writeFixtureFile(
        projectDir,
        ".codex/agents/reviewer.toml",
        'name = "reviewer"\ndescription = "Broken"\ndeveloper_instructions = """\n# Never closed\n',
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      const yamlIssue = result.issues.find(
        (issue) =>
          issue.code === "AGENT_INVALID_SYNTAX" &&
          issue.filePath === ".agents/agents/leader.md",
      );
      assert.ok(yamlIssue);
      assert.equal(yamlIssue.line, 3);

      const configTomlIssue = result.issues.find(
        (issue) =>
          issue.code === "AGENT_INVALID_SYNTAX" &&
          issue.filePath === ".codex/config.toml",
      );
      assert.ok(configTomlIssue);
      assert.equal(configTomlIssue.line, 3);

      const agentTomlIssue = result.issues.find(
        (issue) =>
          issue.code === "AGENT_INVALID_SYNTAX" &&
          issue.filePath === ".codex/agents/reviewer.toml",
      );
      assert.ok(agentTomlIssue);
      assert.equal(agentTomlIssue.line, 3);
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("enforces role-specific tool restrictions across Antigravity, Claude Code, and Codex (R14)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        ".agents/agents/spec_author.md",
        readFixtureFile(projectDir, ".agents/agents/spec_author.md").replace(
          "  - replace_file_content",
          "  - replace_file_content\n  - run_command",
        ),
      );
      writeFixtureFile(
        projectDir,
        ".claude/agents/leader.md",
        readFixtureFile(projectDir, ".claude/agents/leader.md").replace(
          "Agent(spec_author, implementer, reviewer, commiter)",
          "Agent(spec_author, implementer)",
        ),
      );
      writeFixtureFile(
        projectDir,
        ".claude/agents/implementer.md",
        readFixtureFile(projectDir, ".claude/agents/implementer.md").replace(
          "disallowedTools: Agent",
          "tools: Read, Write",
        ),
      );
      writeFixtureFile(
        projectDir,
        ".codex/agents/spec_author.toml",
        readFixtureFile(projectDir, ".codex/agents/spec_author.toml").replace(
          "shell_tool = false",
          "shell_tool = true",
        ),
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      const toolViolations = result.issues.filter(
        (issue) => issue.code === "AGENT_ROLE_TOOL_VIOLATION",
      );
      assert.ok(
        toolViolations.some(
          (issue) => issue.filePath === ".agents/agents/spec_author.md",
        ),
      );
      assert.ok(
        toolViolations.some(
          (issue) => issue.filePath === ".claude/agents/leader.md",
        ),
      );
      assert.ok(
        toolViolations.some(
          (issue) => issue.filePath === ".claude/agents/implementer.md",
        ),
      );
      assert.ok(
        toolViolations.some(
          (issue) => issue.filePath === ".codex/agents/spec_author.toml",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("detects heading and output contract parity mismatches across platforms (R14)", () => {
    const projectDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(
        projectDir,
        ".codex/agents/commiter.toml",
        readFixtureFile(projectDir, ".codex/agents/commiter.toml").replace(
          "## Process",
          "## Alternate Process",
        ),
      );
      writeFixtureFile(
        projectDir,
        ".claude/agents/implementer.md",
        readFixtureFile(projectDir, ".claude/agents/implementer.md").replace(
          "done -> progress/impl_<name>.md",
          "finished -> progress/out.md",
        ),
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "AGENT_PARITY_MISMATCH" &&
            issue.filePath === ".codex/agents/commiter.toml",
        ),
      );
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "AGENT_INVALID_CONTRACT" &&
            issue.filePath === ".claude/agents/implementer.md",
        ),
      );
      assert.ok(
        result.issues.some(
          (issue) =>
            issue.code === "AGENT_PARITY_MISMATCH" &&
            issue.filePath === ".claude/agents/implementer.md",
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });
});
