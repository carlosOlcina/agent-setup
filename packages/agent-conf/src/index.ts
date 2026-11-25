export { runCli } from "./cli.js";
export {
  AGENT_PLATFORMS,
  SDD_AGENTS,
  VALID_FEATURE_STATUSES,
  VALIDATION_RULE_CODES,
} from "./constants.js";
export { CliUsageError, HarnessValidationError } from "./errors.js";
export { stripManagedBlocks } from "./parsers/markdown.js";
export type {
  AgentPlatform,
  CliExecutionResult,
  FeatureStatus,
  SddAgentName,
  ValidateHarnessOptions,
  ValidationIssue,
  ValidationMode,
  ValidationResult,
  ValidationRuleCode,
  ValidationSeverity,
  ValidationSummary,
} from "./types.js";
export {
  assertValidHarness,
  formatValidationReport,
  validateHarness,
} from "./validator.js";
