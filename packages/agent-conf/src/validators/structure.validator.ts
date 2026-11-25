import fs from "node:fs";
import path from "node:path";
import {
  BASE_HARNESS_FILES,
  CANONICAL_CORE_FILES,
  STACK_COUPLED_PATTERNS,
  TEMPLATE_FORBIDDEN_DOT_DIRS,
} from "../constants.js";
import {
  findNonEnglishMatches,
  normalizeLineEndings,
  type NonEnglishScanOptions,
} from "../parsers/markdown.js";
import type { ValidationIssue, ValidationMode } from "../types.js";

export interface ValidationContext {
  readonly rootDir: string;
  readonly mode: ValidationMode;
  readonly canonicalTemplateRoot?: string;
  readonly issues: ValidationIssue[];
  readonly checkedFiles: Set<string>;
}

export interface FileReadResult {
  readonly exists: boolean;
  readonly content: string;
}

const IGNORED_WALK_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".turbo",
  ".next",
]);

export function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function isExistingDirectory(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function isExistingFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function readProjectFile(
  ctx: ValidationContext,
  relativePath: string,
): FileReadResult {
  const posixPath = toPosixPath(relativePath);
  const absolutePath = path.join(ctx.rootDir, posixPath);
  if (!isExistingFile(absolutePath)) {
    return { exists: false, content: "" };
  }

  try {
    const content = fs.readFileSync(absolutePath, "utf8");
    ctx.checkedFiles.add(posixPath);
    return { exists: true, content };
  } catch {
    return { exists: false, content: "" };
  }
}

function findSkillsDirectories(
  rootDir: string,
  currentRelative: string,
  found: string[],
): void {
  const currentAbsolute =
    currentRelative.length === 0
      ? rootDir
      : path.join(rootDir, currentRelative);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentAbsolute, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (IGNORED_WALK_DIRS.has(entry.name)) {
      continue;
    }

    const nextRelative =
      currentRelative.length === 0
        ? entry.name
        : `${currentRelative}/${entry.name}`;

    if (entry.name.toLowerCase() === "skills") {
      found.push(nextRelative);
      continue;
    }

    findSkillsDirectories(rootDir, nextRelative, found);
  }
}

function collectFilesInDirectory(
  rootDir: string,
  relativeDir: string,
): string[] {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!isExistingDirectory(absoluteDir)) {
    return [];
  }

  const collected: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return collected;
  }

  for (const entry of entries) {
    const childRel = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      collected.push(...collectFilesInDirectory(rootDir, childRel));
    } else if (entry.isFile()) {
      collected.push(childRel);
    }
  }

  return collected;
}

function scanTemplateStackCoupling(
  ctx: ValidationContext,
  relativePath: string,
  content: string,
): void {
  const lines = normalizeLineEndings(content).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const term of STACK_COUPLED_PATTERNS) {
      if (term.pattern.test(line)) {
        ctx.issues.push({
          code: "TEMPLATE_STACK_COUPLED_CONTENT",
          severity: "error",
          message: `Template file contains stack-coupled or project-specific term "${term.label}".`,
          filePath: relativePath,
          line: index + 1,
        });
      }
    }
  }
}

export function scanNonEnglishContent(
  ctx: ValidationContext,
  relativePath: string,
  content: string,
  options?: NonEnglishScanOptions,
): void {
  const matches = findNonEnglishMatches(content, options);
  for (const match of matches) {
    ctx.issues.push({
      code: "NON_ENGLISH_CONTENT",
      severity: "error",
      message: `Residual non-English content ("${match.token}") found; SDD harness files must be authored strictly in English.`,
      filePath: relativePath,
      line: match.line,
    });
  }
}

export function validateStructure(ctx: ValidationContext): boolean {
  if (!isExistingDirectory(ctx.rootDir)) {
    ctx.issues.push({
      code: "HARNESS_MISSING_PATH",
      severity: "error",
      message: `Target root directory does not exist: "${ctx.rootDir}".`,
      filePath: ".",
    });
    return false;
  }

  for (const relativePath of BASE_HARNESS_FILES) {
    const file = readProjectFile(ctx, relativePath);
    if (!file.exists) {
      ctx.issues.push({
        code: "HARNESS_MISSING_PATH",
        severity: "error",
        message: `Required harness file is missing: "${relativePath}".`,
        filePath: relativePath,
      });
      continue;
    }

    if (file.content.trim().length === 0) {
      ctx.issues.push({
        code: "HARNESS_EMPTY_FILE",
        severity: "error",
        message: `Required harness file is empty: "${relativePath}".`,
        filePath: relativePath,
      });
    }
  }

  const requiredDirs =
    ctx.mode === "template"
      ? ["agents/agents", "claude/agents", "codex/agents"]
      : [".agents/agents", ".claude/agents", ".codex/agents"];

  for (const relativeDir of requiredDirs) {
    if (!isExistingDirectory(path.join(ctx.rootDir, relativeDir))) {
      ctx.issues.push({
        code: "HARNESS_MISSING_PATH",
        severity: "error",
        message: `Required agent platform directory is missing: "${relativeDir}".`,
        filePath: relativeDir,
      });
    }
  }

  const codexConfigRel =
    ctx.mode === "template" ? "codex/config.toml" : ".codex/config.toml";
  const codexConfig = readProjectFile(ctx, codexConfigRel);
  if (!codexConfig.exists) {
    ctx.issues.push({
      code: "HARNESS_MISSING_PATH",
      severity: "error",
      message: `Required Codex configuration file is missing: "${codexConfigRel}".`,
      filePath: codexConfigRel,
    });
  } else if (codexConfig.content.trim().length === 0) {
    ctx.issues.push({
      code: "HARNESS_EMPTY_FILE",
      severity: "error",
      message: `Required Codex configuration file is empty: "${codexConfigRel}".`,
      filePath: codexConfigRel,
    });
  }

  if (ctx.mode === "template") {
    for (const dotDir of TEMPLATE_FORBIDDEN_DOT_DIRS) {
      if (fs.existsSync(path.join(ctx.rootDir, dotDir))) {
        ctx.issues.push({
          code: "TEMPLATE_FORBIDDEN_DOT_DIR",
          severity: "error",
          message: `Template package must not contain dot-prefixed platform directory "${dotDir}".`,
          filePath: dotDir,
        });
      }
    }

    const skillsDirs: string[] = [];
    findSkillsDirectories(ctx.rootDir, "", skillsDirs);
    for (const skillsDir of skillsDirs) {
      ctx.issues.push({
        code: "TEMPLATE_FORBIDDEN_SKILLS_DIR",
        severity: "error",
        message: `Template package must not include a skills directory: "${skillsDir}".`,
        filePath: skillsDir,
      });
    }

    const templateFilesToScan = new Set<string>([
      ...BASE_HARNESS_FILES,
      "codex/config.toml",
      ...collectFilesInDirectory(ctx.rootDir, "agents"),
      ...collectFilesInDirectory(ctx.rootDir, "claude"),
      ...collectFilesInDirectory(ctx.rootDir, "codex"),
    ]);

    for (const relativePath of templateFilesToScan) {
      const file = readProjectFile(ctx, relativePath);
      if (file.exists) {
        scanTemplateStackCoupling(ctx, relativePath, file.content);
      }
    }

    const templateNonAgentFiles = [...BASE_HARNESS_FILES, "codex/config.toml"];
    for (const relativePath of templateNonAgentFiles) {
      const file = readProjectFile(ctx, relativePath);
      if (file.exists) {
        scanNonEnglishContent(ctx, relativePath, file.content, {
          ignoreFences: relativePath.endsWith(".md"),
        });
      }
    }
  } else {
    for (const coreFile of CANONICAL_CORE_FILES) {
      const file = readProjectFile(ctx, coreFile);
      if (file.exists) {
        scanNonEnglishContent(ctx, coreFile, file.content, {
          ignoreManagedBlocks: coreFile === "AGENTS.md",
          ignoreFences: true,
        });
      }
    }
  }

  return true;
}
