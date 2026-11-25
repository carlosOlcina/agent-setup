import type { ValidationResult } from "./types.js";

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export class HarnessValidationError extends Error {
  readonly result: ValidationResult;

  constructor(result: ValidationResult, message?: string) {
    const defaultMessage =
      message ??
      `Harness validation failed in ${result.summary.mode} mode for "${result.summary.rootDir}" with ${String(result.summary.errorCount)} error(s).`;
    super(defaultMessage);
    this.name = "HarnessValidationError";
    this.result = result;
  }
}
