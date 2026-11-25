import type {
  AGENT_PLATFORMS,
  SDD_AGENTS,
  VALID_FEATURE_STATUSES,
  VALIDATION_RULE_CODES,
} from "./constants.js";

export type SddAgentName = (typeof SDD_AGENTS)[number];

export type AgentPlatform = (typeof AGENT_PLATFORMS)[number];

export type FeatureStatus = (typeof VALID_FEATURE_STATUSES)[number];

export type ValidationMode = "template" | "project";

export type ValidationSeverity = "error" | "warning";

export type ValidationRuleCode = (typeof VALIDATION_RULE_CODES)[number];

export interface ValidationIssue {
  readonly code: ValidationRuleCode;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly filePath: string;
  readonly line?: number;
}

export interface ValidateHarnessOptions {
  readonly rootDir: string;
  readonly mode: ValidationMode;
  readonly canonicalTemplateRoot?: string;
}

export interface ValidationSummary {
  readonly rootDir: string;
  readonly mode: ValidationMode;
  readonly checkedFiles: number;
  readonly errorCount: number;
  readonly warningCount: number;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly summary: ValidationSummary;
}

export interface CliExecutionResult {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
}
