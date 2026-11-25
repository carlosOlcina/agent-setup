import path from "node:path";
import { HarnessValidationError } from "./errors.js";
import type {
  ValidateHarnessOptions,
  ValidationIssue,
  ValidationResult,
  ValidationSummary,
} from "./types.js";
import { validateAgents } from "./validators/agents.validator.js";
import { validateDocsAdapter } from "./validators/docs-adapter.validator.js";
import { validateSpecs } from "./validators/specs.validator.js";
import {
  validateStructure,
  type ValidationContext,
} from "./validators/structure.validator.js";

function assertValidOptions(options: ValidateHarnessOptions): void {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("Validation options must be a non-null object.");
  }

  if (
    typeof options.rootDir !== "string" ||
    options.rootDir.trim().length === 0
  ) {
    throw new TypeError(
      'Validation option "rootDir" must be a non-empty string.',
    );
  }

  if (options.mode !== "template" && options.mode !== "project") {
    throw new TypeError(
      'Validation option "mode" must be either "template" or "project".',
    );
  }

  if (
    options.canonicalTemplateRoot !== undefined &&
    (typeof options.canonicalTemplateRoot !== "string" ||
      options.canonicalTemplateRoot.trim().length === 0)
  ) {
    throw new TypeError(
      'Validation option "canonicalTemplateRoot" must be a non-empty string when provided.',
    );
  }
}

export function validateHarness(
  options: ValidateHarnessOptions,
): ValidationResult {
  assertValidOptions(options);

  const resolvedRoot = path.resolve(options.rootDir);
  const issues: ValidationIssue[] = [];
  const checkedFiles = new Set<string>();

  const ctx: ValidationContext = {
    rootDir: resolvedRoot,
    mode: options.mode,
    canonicalTemplateRoot: options.canonicalTemplateRoot,
    issues,
    checkedFiles,
  };

  const rootExists = validateStructure(ctx);
  if (rootExists) {
    validateDocsAdapter(ctx);
    validateAgents(ctx);
    validateSpecs(ctx);
  }

  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  const summary: ValidationSummary = {
    rootDir: resolvedRoot,
    mode: options.mode,
    checkedFiles: checkedFiles.size,
    errorCount,
    warningCount,
  };

  return {
    valid: errorCount === 0,
    issues,
    summary,
  };
}

export function assertValidHarness(
  options: ValidateHarnessOptions,
): ValidationSummary {
  const result = validateHarness(options);
  if (!result.valid) {
    throw new HarnessValidationError(result);
  }
  return result.summary;
}

export function formatValidationReport(result: ValidationResult): string {
  const statusLabel = result.valid ? "PASS" : "FAIL";
  const headerLines = [
    `SDD Harness Validation: ${statusLabel}`,
    `Mode: ${result.summary.mode}`,
    `Root: ${result.summary.rootDir}`,
    `Checked files: ${String(result.summary.checkedFiles)} | Errors: ${String(result.summary.errorCount)} | Warnings: ${String(result.summary.warningCount)}`,
  ];

  if (result.issues.length === 0) {
    return `${headerLines.join("\n")}\nNo issues found.`;
  }

  const issueLines = result.issues.map((issue) => {
    const location =
      issue.line !== undefined
        ? `${issue.filePath}:${String(issue.line)}`
        : issue.filePath;
    return `- [${issue.severity.toUpperCase()}] [${issue.code}] ${location} — ${issue.message}`;
  });

  return `${headerLines.join("\n")}\n\nIssues:\n${issueLines.join("\n")}`;
}
