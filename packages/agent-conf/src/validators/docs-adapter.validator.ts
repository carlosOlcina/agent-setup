import {
  ADAPTER_FILES,
  BASE_HARNESS_FILES,
  PLACEHOLDER_REGEX,
  TODO_ADAPTER_REGEX,
  VERIFICATION_PENDING_MARKERS,
} from "../constants.js";
import {
  computeManagedBlockLineSet,
  extractMarkdownHeadings,
  extractMarkdownTables,
  normalizeLineEndings,
} from "../parsers/markdown.js";
import {
  readProjectFile,
  type ValidationContext,
} from "./structure.validator.js";

const ARCHITECTURE_SECTION_CHECKS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
}[] = [
  {
    label: "project structure",
    pattern:
      /estructura|structure|arquitectura|layout|topolog|monorepo|overview/i,
  },
  {
    label: "architectural principles",
    pattern:
      /principio|principle|regla|rule|gu[ií]a|guideline|est[aá]ndar|standard|decision/i,
  },
  {
    label: "anti-patterns / what not to do",
    pattern:
      /qu[eé]\s+no\s+hacer|no\s+hacer|not\s+to\s+do|anti-?patr[oó]n|anti-?pattern|prohibid|don't|do not|avoid/i,
  },
];

const CONVENTIONS_SECTION_CHECKS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
}[] = [
  {
    label: "language and commits",
    pattern: /idioma|language|comunicaci[oó]n|communication|commit/i,
  },
  {
    label: "naming and code conventions",
    pattern: /nombre|naming|convencion|convention|estilo|style/i,
  },
  {
    label: "testing conventions",
    pattern: /test|prueba/i,
  },
  {
    label: "error handling",
    pattern: /error|excepci[oó]n|exception/i,
  },
];

const LINT_ROW_PATTERN =
  /lint|est[aá]tic|static|format|check|ruff|clippy|golangci|flake8/i;
const TEST_ROW_PATTERN = /test|prueba|pytest|spec/i;
const COMMAND_HEADER_PATTERN = /comando|command|cmd/i;
const CHECK_HEADER_PATTERN =
  /verificaci[oó]n|verification|check|paso|step|tarea|task/i;
const STATUS_HEADER_PATTERN = /estado|status/i;
const OPTIONAL_STATUS_PATTERN = /opcional|optional/i;
const MANDATORY_STATUS_PATTERN = /obligatorio|mandatory|required/i;

function scanUnresolvedPlaceholders(
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
    PLACEHOLDER_REGEX.lastIndex = 0;
    const placeholderMatch = PLACEHOLDER_REGEX.exec(line);
    if (placeholderMatch !== null) {
      ctx.issues.push({
        code: "ADAPTER_UNRESOLVED_PLACEHOLDER",
        severity: "error",
        message: `Unresolved template placeholder "${placeholderMatch[0]}" found in project file.`,
        filePath: relativePath,
        line: index + 1,
      });
    }

    TODO_ADAPTER_REGEX.lastIndex = 0;
    const todoMatch = TODO_ADAPTER_REGEX.exec(line);
    if (todoMatch !== null) {
      ctx.issues.push({
        code: "ADAPTER_UNRESOLVED_PLACEHOLDER",
        severity: "error",
        message: `Unresolved adapter marker "${todoMatch[0]}" found in project file.`,
        filePath: relativePath,
        line: index + 1,
      });
    }
  }
}

function validateRequiredHeadings(
  ctx: ValidationContext,
  relativePath: string,
  content: string,
  minH2Count: number,
  checks: readonly { readonly label: string; readonly pattern: RegExp }[],
): void {
  const headings = extractMarkdownHeadings(content);
  const hasH1 = headings.some((heading) => heading.level === 1);
  if (!hasH1) {
    ctx.issues.push({
      code: "ADAPTER_MISSING_SECTION",
      severity: "error",
      message: `Adapter document "${relativePath}" must contain a top-level '# ' heading.`,
      filePath: relativePath,
      line: 1,
    });
  }

  const h2Headings = headings.filter((heading) => heading.level === 2);
  if (h2Headings.length < minH2Count) {
    ctx.issues.push({
      code: "ADAPTER_MISSING_SECTION",
      severity: "error",
      message: `Adapter document "${relativePath}" must contain at least ${String(minH2Count)} level-2 ('## ') sections (found ${String(h2Headings.length)}).`,
      filePath: relativePath,
    });
  }

  for (const check of checks) {
    const matched = h2Headings.some((heading) =>
      check.pattern.test(heading.text),
    );
    if (!matched) {
      ctx.issues.push({
        code: "ADAPTER_MISSING_SECTION",
        severity: "error",
        message: `Adapter document "${relativePath}" is missing required section covering ${check.label}.`,
        filePath: relativePath,
      });
    }
  }
}

function isPendingOrEmpty(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  return VERIFICATION_PENDING_MARKERS.some((pattern) => pattern.test(trimmed));
}

function extractBacktickCommands(cell: string): string[] {
  const commands: string[] = [];
  for (const match of cell.matchAll(/`([^`]+)`/g)) {
    const command = match[1]?.trim() ?? "";
    if (command.length > 0) {
      commands.push(command);
    }
  }
  return commands;
}

function validateVerificationDocument(
  ctx: ValidationContext,
  content: string,
): void {
  const relativePath = "docs/verification.md";
  const headings = extractMarkdownHeadings(content);
  if (!headings.some((heading) => heading.level === 1)) {
    ctx.issues.push({
      code: "ADAPTER_MISSING_SECTION",
      severity: "error",
      message: `Verification document "${relativePath}" must contain a top-level '# ' heading.`,
      filePath: relativePath,
      line: 1,
    });
  }

  const tables = extractMarkdownTables(content);
  const commandTable = tables.find((table) => {
    const hasCheckCol = table.headers.some((header) =>
      CHECK_HEADER_PATTERN.test(header),
    );
    const hasCmdCol = table.headers.some((header) =>
      COMMAND_HEADER_PATTERN.test(header),
    );
    return table.headers.length >= 2 && hasCheckCol && hasCmdCol;
  });

  if (commandTable === undefined || commandTable.rows.length === 0) {
    ctx.issues.push({
      code: "VERIFICATION_INVALID_TABLE",
      severity: "error",
      message: `Verification document "${relativePath}" must contain a non-empty Markdown table listing verification checks and commands.`,
      filePath: relativePath,
    });
    return;
  }

  const commandColIndex = Math.max(
    1,
    commandTable.headers.findIndex((header) =>
      COMMAND_HEADER_PATTERN.test(header),
    ),
  );
  const statusColIndex = commandTable.headers.findIndex((header) =>
    STATUS_HEADER_PATTERN.test(header),
  );

  let hasLintRow = false;
  let hasTestRow = false;

  for (const row of commandTable.rows) {
    const labelCell = row.cells[0] ?? "";
    const commandCell = row.cells[commandColIndex] ?? "";
    const statusCell =
      statusColIndex >= 0 ? (row.cells[statusColIndex] ?? "") : "";

    if (LINT_ROW_PATTERN.test(labelCell)) {
      hasLintRow = true;
    }
    if (TEST_ROW_PATTERN.test(labelCell)) {
      hasTestRow = true;
    }

    const isOptionalRow =
      statusCell.length > 0 &&
      OPTIONAL_STATUS_PATTERN.test(statusCell) &&
      !MANDATORY_STATUS_PATTERN.test(statusCell);

    if (isOptionalRow) {
      continue;
    }

    if (statusCell.length > 0 && isPendingOrEmpty(statusCell)) {
      ctx.issues.push({
        code: "VERIFICATION_EMPTY_COMMAND",
        severity: "error",
        message: `Mandatory verification row "${labelCell}" is marked as pending or unconfigured.`,
        filePath: relativePath,
        line: row.line,
      });
      continue;
    }

    if (isPendingOrEmpty(commandCell)) {
      ctx.issues.push({
        code: "VERIFICATION_EMPTY_COMMAND",
        severity: "error",
        message: `Mandatory verification row "${labelCell}" has an empty or pending command.`,
        filePath: relativePath,
        line: row.line,
      });
      continue;
    }

    const backtickCommands = extractBacktickCommands(commandCell);
    if (
      backtickCommands.length === 0 ||
      backtickCommands.every((command) => isPendingOrEmpty(command))
    ) {
      ctx.issues.push({
        code: "VERIFICATION_EMPTY_COMMAND",
        severity: "error",
        message: `Mandatory verification row "${labelCell}" must wrap its active command in backticks (\`<cmd>\`).`,
        filePath: relativePath,
        line: row.line,
      });
    }
  }

  if (!hasLintRow) {
    ctx.issues.push({
      code: "VERIFICATION_INVALID_TABLE",
      severity: "error",
      message: `Verification table in "${relativePath}" must include a static analysis / lint row.`,
      filePath: relativePath,
      line: commandTable.startLine,
    });
  }

  if (!hasTestRow) {
    ctx.issues.push({
      code: "VERIFICATION_INVALID_TABLE",
      severity: "error",
      message: `Verification table in "${relativePath}" must include an automated tests row.`,
      filePath: relativePath,
      line: commandTable.startLine,
    });
  }
}

export function validateDocsAdapter(ctx: ValidationContext): void {
  if (ctx.mode === "template") {
    for (const adapterPath of ADAPTER_FILES) {
      const file = readProjectFile(ctx, adapterPath);
      if (!file.exists) {
        continue;
      }
      PLACEHOLDER_REGEX.lastIndex = 0;
      if (!PLACEHOLDER_REGEX.test(file.content)) {
        ctx.issues.push({
          code: "TEMPLATE_MISSING_PLACEHOLDER",
          severity: "error",
          message: `Adapter template "${adapterPath}" must contain at least one explicit "{{PLACEHOLDER}}" marker.`,
          filePath: adapterPath,
        });
      }
    }
  } else {
    for (const harnessPath of BASE_HARNESS_FILES) {
      const file = readProjectFile(ctx, harnessPath);
      if (!file.exists) {
        continue;
      }
      scanUnresolvedPlaceholders(
        ctx,
        harnessPath,
        file.content,
        harnessPath === "AGENTS.md",
      );
    }
  }

  const architectureFile = readProjectFile(ctx, "docs/architecture.md");
  if (architectureFile.exists && architectureFile.content.trim().length > 0) {
    validateRequiredHeadings(
      ctx,
      "docs/architecture.md",
      architectureFile.content,
      3,
      ARCHITECTURE_SECTION_CHECKS,
    );
  }

  const conventionsFile = readProjectFile(ctx, "docs/conventions.md");
  if (conventionsFile.exists && conventionsFile.content.trim().length > 0) {
    validateRequiredHeadings(
      ctx,
      "docs/conventions.md",
      conventionsFile.content,
      4,
      CONVENTIONS_SECTION_CHECKS,
    );
  }

  if (ctx.mode === "project") {
    const verificationFile = readProjectFile(ctx, "docs/verification.md");
    if (verificationFile.exists && verificationFile.content.trim().length > 0) {
      validateVerificationDocument(ctx, verificationFile.content);
    }
  }
}
