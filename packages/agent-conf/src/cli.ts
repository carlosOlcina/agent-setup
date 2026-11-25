#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { FORBIDDEN_CLI_SUBCOMMANDS } from "./constants.js";
import { CliUsageError } from "./errors.js";
import type { CliExecutionResult, ValidationMode } from "./types.js";
import { formatValidationReport, validateHarness } from "./validator.js";

interface ParsedCliArgs {
  readonly help: boolean;
  readonly json: boolean;
  readonly mode: ValidationMode;
  readonly rootDir: string;
  readonly canonicalTemplateRoot?: string;
}

const HELP_TEXT = `Usage: agent-conf-validate [--mode project|template] [--root <dir>] [--canonical-root <dir>] [--json] [--help]

Read-only Spec Driven Development (SDD) harness validator.
This CLI never creates, updates, or modifies files on disk.

Options:
  --mode <project|template>   Validation mode (default: project)
  --root <dir>                Target directory to validate (default: current working directory)
  --canonical-root <dir>      Optional canonical template root to verify sync parity (project mode)
  --json                      Print machine-readable JSON validation output
  --help, -h                  Show this help message
`;

const FORBIDDEN_SUBCOMMAND_SET = new Set<string>(FORBIDDEN_CLI_SUBCOMMANDS);

function readFlagValue(
  argv: readonly string[],
  index: number,
  flagName: string,
): { readonly value: string; readonly nextIndex: number } {
  const nextValue = argv[index + 1];
  if (nextValue === undefined || nextValue.startsWith("-")) {
    throw new CliUsageError(`Option "${flagName}" requires a value.`);
  }
  return { value: nextValue, nextIndex: index + 1 };
}

function parseModeValue(rawValue: string): ValidationMode {
  if (rawValue === "project" || rawValue === "template") {
    return rawValue;
  }
  throw new CliUsageError(
    `Invalid value "${rawValue}" for "--mode". Expected "project" or "template".`,
  );
}

function parseCliArgs(argv: readonly string[], baseCwd: string): ParsedCliArgs {
  let help = false;
  let json = false;
  let mode: ValidationMode = "project";
  let rootDir = baseCwd;
  let canonicalTemplateRoot: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--mode") {
      const parsed = readFlagValue(argv, index, "--mode");
      mode = parseModeValue(parsed.value);
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = parseModeValue(arg.slice("--mode=".length));
      continue;
    }

    if (arg === "--root") {
      const parsed = readFlagValue(argv, index, "--root");
      rootDir = path.resolve(baseCwd, parsed.value);
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--root=")) {
      const value = arg.slice("--root=".length);
      if (value.trim().length === 0) {
        throw new CliUsageError('Option "--root" requires a non-empty value.');
      }
      rootDir = path.resolve(baseCwd, value);
      continue;
    }

    if (arg === "--canonical-root") {
      const parsed = readFlagValue(argv, index, "--canonical-root");
      canonicalTemplateRoot = path.resolve(baseCwd, parsed.value);
      index = parsed.nextIndex;
      continue;
    }

    if (arg.startsWith("--canonical-root=")) {
      const value = arg.slice("--canonical-root=".length);
      if (value.trim().length === 0) {
        throw new CliUsageError(
          'Option "--canonical-root" requires a non-empty value.',
        );
      }
      canonicalTemplateRoot = path.resolve(baseCwd, value);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CliUsageError(
        `Unknown option "${arg}". Run with "--help" to view supported read-only validation flags.`,
      );
    }

    const lowered = arg.toLowerCase();
    if (FORBIDDEN_SUBCOMMAND_SET.has(lowered)) {
      throw new CliUsageError(
        `Subcommand "${arg}" is not supported: @repo/agent-conf is a strictly read-only validator and does not install, initialize, or mutate files.`,
      );
    }

    throw new CliUsageError(
      `Unexpected positional argument "${arg}". Run with "--help" to view usage.`,
    );
  }

  return {
    help,
    json,
    mode,
    rootDir,
    canonicalTemplateRoot,
  };
}

export function runCli(
  argv: readonly string[],
  cwd?: string,
): CliExecutionResult {
  const baseCwd = path.resolve(cwd ?? process.cwd());

  let parsedArgs: ParsedCliArgs;
  try {
    parsedArgs = parseCliArgs(argv, baseCwd);
  } catch (error) {
    if (error instanceof CliUsageError) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: `Usage error: ${error.message}\n\n${HELP_TEXT}`,
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Usage error: ${detail}\n`,
    };
  }

  if (parsedArgs.help) {
    return {
      exitCode: 0,
      stdout: HELP_TEXT,
      stderr: "",
    };
  }

  const result = validateHarness({
    rootDir: parsedArgs.rootDir,
    mode: parsedArgs.mode,
    canonicalTemplateRoot: parsedArgs.canonicalTemplateRoot,
  });

  const output = parsedArgs.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${formatValidationReport(result)}\n`;

  return {
    exitCode: result.valid ? 0 : 1,
    stdout: output,
    stderr: "",
  };
}

function isDirectExecution(): boolean {
  const entryPath = process.argv[1];
  if (entryPath === undefined || entryPath.length === 0) {
    return false;
  }

  try {
    const currentFile = fs.realpathSync(fileURLToPath(import.meta.url));
    const invokedFile = fs.realpathSync(path.resolve(entryPath));
    return currentFile === invokedFile;
  } catch {
    return path.resolve(entryPath) === fileURLToPath(import.meta.url);
  }
}

if (isDirectExecution()) {
  const outcome = runCli(process.argv.slice(2), process.cwd());
  if (outcome.stdout.length > 0) {
    process.stdout.write(outcome.stdout);
  }
  if (outcome.stderr.length > 0) {
    process.stderr.write(outcome.stderr);
  }
  process.exitCode = outcome.exitCode;
}
