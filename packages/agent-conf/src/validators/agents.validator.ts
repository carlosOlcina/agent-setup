import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_CORE_FILES,
  CORE_NO_SKILL_FILES,
  FORBIDDEN_AGENT_REFERENCE_PATTERNS,
  LEADER_CLAUDE_SUBAGENTS,
  REQUIRED_OUTPUT_CONTRACTS,
  SDD_AGENTS,
} from "../constants.js";
import { parseYamlFrontmatter } from "../parsers/frontmatter.js";
import {
  computeManagedBlockLineSet,
  extractMarkdownHeadings,
  extractOutputContracts,
  normalizeLineEndings,
  stripManagedBlocks,
} from "../parsers/markdown.js";
import { parseToml, type TomlTable } from "../parsers/toml.js";
import type { AgentPlatform, SddAgentName } from "../types.js";
import {
  isExistingDirectory,
  isExistingFile,
  readProjectFile,
  scanNonEnglishContent,
  type ValidationContext,
} from "./structure.validator.js";

interface ParsedAgentSignature {
  readonly platform: AgentPlatform;
  readonly filePath: string;
  readonly h1: string;
  readonly h2List: readonly string[];
  readonly outputContracts: readonly string[];
}

function isTomlTable(value: unknown): value is TomlTable {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scanForbiddenReferences(
  ctx: ValidationContext,
  relativePath: string,
  content: string,
  ignoreManagedBlocks: boolean,
): void {
  const lines = normalizeLineEndings(content).split("\n");
  const skippedLines = ignoreManagedBlocks
    ? computeManagedBlockLineSet(lines)
    : new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (skippedLines.has(index)) {
      continue;
    }
    const line = lines[index] ?? "";
    for (const rule of FORBIDDEN_AGENT_REFERENCE_PATTERNS) {
      if (rule.pattern.test(line)) {
        ctx.issues.push({
          code: "AGENT_FORBIDDEN_REFERENCE",
          severity: "error",
          message: `Forbidden skill or excluded agent reference "${rule.label}" found.`,
          filePath: relativePath,
          line: index + 1,
        });
      }
    }
  }
}

function validatePlatformDirectoryMembership(
  ctx: ValidationContext,
  relativeDir: string,
  extension: ".md" | ".toml",
): void {
  const absoluteDir = path.join(ctx.rootDir, relativeDir);
  if (!isExistingDirectory(absoluteDir)) {
    return;
  }

  const expectedFileNames = new Set(
    SDD_AGENTS.map((agent) => `${agent}${extension}`),
  );

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  const foundFileNames = new Set<string>();
  for (const entry of entries) {
    const entryRel = `${relativeDir}/${entry.name}`;
    if (!entry.isFile() || !expectedFileNames.has(entry.name)) {
      ctx.issues.push({
        code: "AGENT_UNEXPECTED_FILE",
        severity: "error",
        message: `Unexpected entry "${entry.name}" in "${relativeDir}"; only the 5 pure SDD agents are permitted.`,
        filePath: entryRel,
      });
      continue;
    }
    foundFileNames.add(entry.name);
  }

  for (const expectedName of expectedFileNames) {
    if (!foundFileNames.has(expectedName)) {
      ctx.issues.push({
        code: "AGENT_MISSING_FILE",
        severity: "error",
        message: `Missing required SDD agent configuration "${expectedName}" in "${relativeDir}".`,
        filePath: `${relativeDir}/${expectedName}`,
      });
    }
  }
}

function splitClaudeToolList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw !== "string") {
    return [];
  }

  const entries: string[] = [];
  let current = "";
  let depth = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        entries.push(trimmed);
      }
      current = "";
    } else {
      current += char ?? "";
    }
  }

  const tail = current.trim();
  if (tail.length > 0) {
    entries.push(tail);
  }
  return entries;
}

function buildAgentSignature(
  ctx: ValidationContext,
  platform: AgentPlatform,
  agent: SddAgentName,
  filePath: string,
  markdownBody: string,
): ParsedAgentSignature {
  const headings = extractMarkdownHeadings(markdownBody);
  const firstH1 = headings.find((heading) => heading.level === 1);
  if (firstH1 === undefined) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Agent "${agent}" (${platform}) must contain a level-1 '# ' heading.`,
      filePath,
    });
  }

  const h2List = headings
    .filter((heading) => heading.level === 2)
    .map((heading) => heading.text);

  const outputContracts = extractOutputContracts(markdownBody);
  const requiredContracts = REQUIRED_OUTPUT_CONTRACTS[agent];
  for (const required of requiredContracts) {
    if (!outputContracts.includes(required)) {
      ctx.issues.push({
        code: "AGENT_INVALID_CONTRACT",
        severity: "error",
        message: `Agent "${agent}" (${platform}) is missing required output contract "${required}".`,
        filePath,
      });
    }
  }

  return {
    platform,
    filePath,
    h1: firstH1?.text ?? "",
    h2List,
    outputContracts,
  };
}

function validateAntigravityAgent(
  ctx: ValidationContext,
  agentsDir: string,
  agent: SddAgentName,
): ParsedAgentSignature | null {
  const relativePath = `${agentsDir}/${agent}.md`;
  const file = readProjectFile(ctx, relativePath);
  if (!file.exists) {
    return null;
  }

  scanForbiddenReferences(ctx, relativePath, file.content, false);
  scanNonEnglishContent(ctx, relativePath, file.content, {
    ignoreFences: true,
  });

  const parsed = parseYamlFrontmatter(file.content);
  if (!parsed.ok) {
    ctx.issues.push({
      code: "AGENT_INVALID_SYNTAX",
      severity: "error",
      message: `Invalid YAML frontmatter in Antigravity agent: ${parsed.error.message}`,
      filePath: relativePath,
      line: parsed.error.line,
    });
    return null;
  }

  const { data, body } = parsed;
  if (data.name !== agent) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Antigravity agent frontmatter "name" must equal "${agent}".`,
      filePath: relativePath,
    });
  }

  if (
    typeof data.description !== "string" ||
    data.description.trim().length === 0
  ) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Antigravity agent "${agent}" must define a non-empty "description".`,
      filePath: relativePath,
    });
  }

  if (typeof data.model !== "string" || data.model.trim().length === 0) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Antigravity agent "${agent}" must define a non-empty "model".`,
      filePath: relativePath,
    });
  }

  if (typeof data.mainAgent !== "boolean") {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Antigravity agent "${agent}" must define boolean "mainAgent".`,
      filePath: relativePath,
    });
  }

  if (data.subagent !== true) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Antigravity agent "${agent}" must set "subagent: true".`,
      filePath: relativePath,
    });
  }

  if (!Array.isArray(data.tools) || data.tools.length === 0) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Antigravity agent "${agent}" must define a non-empty "tools" list.`,
      filePath: relativePath,
    });
  } else {
    const toolSet = new Set(data.tools);
    if (agent === "leader" && !toolSet.has("invoke_subagent")) {
      ctx.issues.push({
        code: "AGENT_ROLE_TOOL_VIOLATION",
        severity: "error",
        message: `Antigravity "leader" must include "invoke_subagent" in tools.`,
        filePath: relativePath,
      });
    }
    if (agent === "spec_author" && toolSet.has("run_command")) {
      ctx.issues.push({
        code: "AGENT_ROLE_TOOL_VIOLATION",
        severity: "error",
        message: `Antigravity "spec_author" must not include "run_command" in tools.`,
        filePath: relativePath,
      });
    }
    if (
      (agent === "reviewer" || agent === "commiter") &&
      toolSet.has("replace_file_content")
    ) {
      ctx.issues.push({
        code: "AGENT_ROLE_TOOL_VIOLATION",
        severity: "error",
        message: `Antigravity "${agent}" must not include "replace_file_content" in tools.`,
        filePath: relativePath,
      });
    }
  }

  return buildAgentSignature(ctx, "agents", agent, relativePath, body);
}

function validateClaudeAgent(
  ctx: ValidationContext,
  claudeAgentsDir: string,
  agent: SddAgentName,
): ParsedAgentSignature | null {
  const relativePath = `${claudeAgentsDir}/${agent}.md`;
  const file = readProjectFile(ctx, relativePath);
  if (!file.exists) {
    return null;
  }

  scanForbiddenReferences(ctx, relativePath, file.content, false);
  scanNonEnglishContent(ctx, relativePath, file.content, {
    ignoreFences: true,
  });

  const parsed = parseYamlFrontmatter(file.content);
  if (!parsed.ok) {
    ctx.issues.push({
      code: "AGENT_INVALID_SYNTAX",
      severity: "error",
      message: `Invalid YAML frontmatter in Claude Code agent: ${parsed.error.message}`,
      filePath: relativePath,
      line: parsed.error.line,
    });
    return null;
  }

  const { data, body } = parsed;
  if (data.name !== agent) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Claude Code agent frontmatter "name" must equal "${agent}".`,
      filePath: relativePath,
    });
  }

  if (
    typeof data.description !== "string" ||
    data.description.trim().length === 0
  ) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Claude Code agent "${agent}" must define a non-empty "description".`,
      filePath: relativePath,
    });
  }

  if (typeof data.model !== "string" || data.model.trim().length === 0) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Claude Code agent "${agent}" must define a non-empty "model".`,
      filePath: relativePath,
    });
  }

  const tools = splitClaudeToolList(data.tools);
  const disallowedTools = splitClaudeToolList(data.disallowedTools);

  if (tools.length === 0 && disallowedTools.length === 0) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Claude Code agent "${agent}" must declare "tools" or "disallowedTools".`,
      filePath: relativePath,
    });
  }

  if (agent === "leader") {
    const agentTool = tools.find((tool) => /^Agent\(.+\)$/.test(tool));
    if (agentTool === undefined) {
      ctx.issues.push({
        code: "AGENT_ROLE_TOOL_VIOLATION",
        severity: "error",
        message: `Claude Code "leader" must declare Agent(spec_author, implementer, reviewer, commiter) in tools.`,
        filePath: relativePath,
      });
    } else {
      const inner = agentTool.slice("Agent(".length, -1);
      const declaredSubagents = inner
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const expectedSet = new Set<string>(LEADER_CLAUDE_SUBAGENTS);
      const declaredSet = new Set(declaredSubagents);
      const exactMatch =
        declaredSubagents.length === expectedSet.size &&
        declaredSet.size === expectedSet.size &&
        [...expectedSet].every((subagent) => declaredSet.has(subagent));

      if (!exactMatch) {
        ctx.issues.push({
          code: "AGENT_ROLE_TOOL_VIOLATION",
          severity: "error",
          message: `Claude Code "leader" Agent(...) tool must allow exclusively (${LEADER_CLAUDE_SUBAGENTS.join(", ")}).`,
          filePath: relativePath,
        });
      }
    }
  }

  if (agent === "implementer" && !disallowedTools.includes("Agent")) {
    ctx.issues.push({
      code: "AGENT_ROLE_TOOL_VIOLATION",
      severity: "error",
      message: `Claude Code "implementer" must include "Agent" in disallowedTools.`,
      filePath: relativePath,
    });
  }

  if (agent === "spec_author" && tools.includes("Bash")) {
    ctx.issues.push({
      code: "AGENT_ROLE_TOOL_VIOLATION",
      severity: "error",
      message: `Claude Code "spec_author" must not include "Bash" in tools.`,
      filePath: relativePath,
    });
  }

  if (
    (agent === "reviewer" || agent === "commiter") &&
    tools.includes("Edit")
  ) {
    ctx.issues.push({
      code: "AGENT_ROLE_TOOL_VIOLATION",
      severity: "error",
      message: `Claude Code "${agent}" must not include "Edit" in tools.`,
      filePath: relativePath,
    });
  }

  return buildAgentSignature(ctx, "claude", agent, relativePath, body);
}

function validateCodexConfig(ctx: ValidationContext, codexDir: string): void {
  const configPath = `${codexDir}/config.toml`;
  const file = readProjectFile(ctx, configPath);
  if (!file.exists) {
    return;
  }

  const parsed = parseToml(file.content);
  if (!parsed.ok) {
    ctx.issues.push({
      code: "AGENT_INVALID_SYNTAX",
      severity: "error",
      message: `Invalid TOML in Codex config: ${parsed.error.message}`,
      filePath: configPath,
      line: parsed.error.line,
    });
    return;
  }

  const features = parsed.data.features;
  if (!isTomlTable(features) || features.multi_agent !== true) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Codex config "${configPath}" must set features.multi_agent = true.`,
      filePath: configPath,
    });
  }

  const agents = parsed.data.agents;
  if (!isTomlTable(agents) || agents.enabled !== true) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Codex config "${configPath}" must set agents.enabled = true.`,
      filePath: configPath,
    });
  }

  const maxThreads = isTomlTable(agents)
    ? agents.max_concurrent_threads_per_session
    : undefined;
  if (
    typeof maxThreads !== "number" ||
    !Number.isInteger(maxThreads) ||
    maxThreads < 1
  ) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Codex config "${configPath}" must set agents.max_concurrent_threads_per_session >= 1.`,
      filePath: configPath,
    });
  }
}

function validateCodexAgent(
  ctx: ValidationContext,
  codexAgentsDir: string,
  agent: SddAgentName,
): ParsedAgentSignature | null {
  const relativePath = `${codexAgentsDir}/${agent}.toml`;
  const file = readProjectFile(ctx, relativePath);
  if (!file.exists) {
    return null;
  }

  scanForbiddenReferences(ctx, relativePath, file.content, false);
  scanNonEnglishContent(ctx, relativePath, file.content, {
    ignoreFences: true,
  });

  const parsed = parseToml(file.content);
  if (!parsed.ok) {
    ctx.issues.push({
      code: "AGENT_INVALID_SYNTAX",
      severity: "error",
      message: `Invalid TOML in Codex agent: ${parsed.error.message}`,
      filePath: relativePath,
      line: parsed.error.line,
    });
    return null;
  }

  const { data } = parsed;
  if (data.name !== agent) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Codex agent "name" must equal "${agent}".`,
      filePath: relativePath,
    });
  }

  if (
    typeof data.description !== "string" ||
    data.description.trim().length === 0
  ) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Codex agent "${agent}" must define a non-empty "description".`,
      filePath: relativePath,
    });
  }

  const instructions =
    typeof data.developer_instructions === "string"
      ? data.developer_instructions
      : "";
  if (instructions.trim().length === 0) {
    ctx.issues.push({
      code: "AGENT_INVALID_CONTRACT",
      severity: "error",
      message: `Codex agent "${agent}" must define non-empty "developer_instructions".`,
      filePath: relativePath,
    });
  }

  if (agent === "spec_author") {
    const features = data.features;
    if (!isTomlTable(features) || features.shell_tool !== false) {
      ctx.issues.push({
        code: "AGENT_ROLE_TOOL_VIOLATION",
        severity: "error",
        message: `Codex "spec_author" must disable shell access with [features] shell_tool = false.`,
        filePath: relativePath,
      });
    }
  }

  return buildAgentSignature(ctx, "codex", agent, relativePath, instructions);
}

function comparePlatformParity(
  ctx: ValidationContext,
  agent: SddAgentName,
  signatures: readonly ParsedAgentSignature[],
): void {
  if (signatures.length < 2) {
    return;
  }

  const baseline = signatures[0];
  if (baseline === undefined) {
    return;
  }

  for (let index = 1; index < signatures.length; index += 1) {
    const candidate = signatures[index];
    if (candidate === undefined) {
      continue;
    }

    if (baseline.h1 !== candidate.h1) {
      ctx.issues.push({
        code: "AGENT_PARITY_MISMATCH",
        severity: "error",
        message: `Agent "${agent}" H1 heading mismatch between ${baseline.platform} ("${baseline.h1}") and ${candidate.platform} ("${candidate.h1}").`,
        filePath: candidate.filePath,
      });
    }

    const h2Matches =
      baseline.h2List.length === candidate.h2List.length &&
      baseline.h2List.every(
        (heading, pos) => heading === candidate.h2List[pos],
      );
    if (!h2Matches) {
      ctx.issues.push({
        code: "AGENT_PARITY_MISMATCH",
        severity: "error",
        message: `Agent "${agent}" level-2 section headings differ between ${baseline.platform} and ${candidate.platform}.`,
        filePath: candidate.filePath,
      });
    }

    const contractsMatch =
      baseline.outputContracts.length === candidate.outputContracts.length &&
      baseline.outputContracts.every(
        (contract, pos) => contract === candidate.outputContracts[pos],
      );
    if (!contractsMatch) {
      ctx.issues.push({
        code: "AGENT_PARITY_MISMATCH",
        severity: "error",
        message: `Agent "${agent}" output contracts differ between ${baseline.platform} and ${candidate.platform}.`,
        filePath: candidate.filePath,
      });
    }
  }
}

function normalizeForCanonicalCompare(
  relativePath: string,
  content: string,
): string {
  const normalized =
    relativePath === "AGENTS.md"
      ? stripManagedBlocks(content)
      : normalizeLineEndings(content);
  return normalized.trimEnd();
}

function validateCanonicalSync(ctx: ValidationContext): void {
  if (ctx.mode !== "project" || ctx.canonicalTemplateRoot === undefined) {
    return;
  }

  const canonicalRoot = path.resolve(ctx.canonicalTemplateRoot);
  if (!isExistingDirectory(canonicalRoot)) {
    ctx.issues.push({
      code: "CANONICAL_SYNC_MISMATCH",
      severity: "error",
      message: `Canonical template root directory does not exist: "${canonicalRoot}".`,
      filePath: ".",
    });
    return;
  }

  const pairs: readonly {
    readonly projectRel: string;
    readonly templateRel: string;
  }[] = [
    ...CANONICAL_CORE_FILES.map((file) => ({
      projectRel: file,
      templateRel: file,
    })),
    { projectRel: ".codex/config.toml", templateRel: "codex/config.toml" },
    ...SDD_AGENTS.flatMap((agent) => [
      {
        projectRel: `.agents/agents/${agent}.md`,
        templateRel: `agents/agents/${agent}.md`,
      },
      {
        projectRel: `.claude/agents/${agent}.md`,
        templateRel: `claude/agents/${agent}.md`,
      },
      {
        projectRel: `.codex/agents/${agent}.toml`,
        templateRel: `codex/agents/${agent}.toml`,
      },
    ]),
  ];

  for (const pair of pairs) {
    const projectFile = readProjectFile(ctx, pair.projectRel);
    if (!projectFile.exists) {
      continue;
    }

    const templateAbsPath = path.join(canonicalRoot, pair.templateRel);
    if (!isExistingFile(templateAbsPath)) {
      ctx.issues.push({
        code: "CANONICAL_SYNC_MISMATCH",
        severity: "error",
        message: `Canonical template file missing: "${pair.templateRel}".`,
        filePath: pair.projectRel,
      });
      continue;
    }

    const templateContent = fs.readFileSync(templateAbsPath, "utf8");
    const expected = normalizeForCanonicalCompare(
      pair.templateRel,
      templateContent,
    );
    const actual = normalizeForCanonicalCompare(
      pair.projectRel,
      projectFile.content,
    );

    if (actual !== expected) {
      ctx.issues.push({
        code: "CANONICAL_SYNC_MISMATCH",
        severity: "error",
        message: `File "${pair.projectRel}" is out of sync with canonical template "${pair.templateRel}".`,
        filePath: pair.projectRel,
      });
    }
  }
}

export function validateAgents(ctx: ValidationContext): void {
  for (const coreFile of CORE_NO_SKILL_FILES) {
    const file = readProjectFile(ctx, coreFile);
    if (file.exists) {
      scanForbiddenReferences(
        ctx,
        coreFile,
        file.content,
        coreFile === "AGENTS.md",
      );
    }
  }

  const antigravityDir =
    ctx.mode === "template" ? "agents/agents" : ".agents/agents";
  const claudeDir =
    ctx.mode === "template" ? "claude/agents" : ".claude/agents";
  const codexDir = ctx.mode === "template" ? "codex" : ".codex";
  const codexAgentsDir = `${codexDir}/agents`;

  validatePlatformDirectoryMembership(ctx, antigravityDir, ".md");
  validatePlatformDirectoryMembership(ctx, claudeDir, ".md");
  validatePlatformDirectoryMembership(ctx, codexAgentsDir, ".toml");
  validateCodexConfig(ctx, codexDir);

  for (const agent of SDD_AGENTS) {
    const signatures: ParsedAgentSignature[] = [];

    const antigravitySig = validateAntigravityAgent(ctx, antigravityDir, agent);
    if (antigravitySig !== null) {
      signatures.push(antigravitySig);
    }

    const claudeSig = validateClaudeAgent(ctx, claudeDir, agent);
    if (claudeSig !== null) {
      signatures.push(claudeSig);
    }

    const codexSig = validateCodexAgent(ctx, codexAgentsDir, agent);
    if (codexSig !== null) {
      signatures.push(codexSig);
    }

    comparePlatformParity(ctx, agent, signatures);
  }

  validateCanonicalSync(ctx);
}
