import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");

const TEMPLATE_EXCLUDE = new Set(["src", "tests", "dist", "node_modules"]);

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export function copyDirSync(
  sourceDir: string,
  targetDir: string,
  excludeNames: ReadonlySet<string> = new Set(),
): void {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (excludeNames.has(entry.name)) {
      continue;
    }
    const srcPath = path.join(sourceDir, entry.name);
    const destPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function writeFixtureFile(
  rootDir: string,
  relativePath: string,
  content: string,
): void {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

export function readFixtureFile(rootDir: string, relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

export function createValidTemplateFixture(): string {
  const tempRoot = createTempDir("agent-conf-template-");
  copyDirSync(PACKAGE_ROOT, tempRoot, TEMPLATE_EXCLUDE);
  return tempRoot;
}

export interface ProjectFixtureOptions {
  readonly stack?: "python" | "go" | "rust";
  readonly withManagedBlock?: boolean;
  readonly features?: readonly Record<string, unknown>[];
}

export function createValidProjectFixture(
  options: ProjectFixtureOptions = {},
): string {
  const stack = options.stack ?? "python";
  const tempRoot = createTempDir(`agent-conf-project-${stack}-`);

  const coreFiles = [
    "AGENTS.md",
    "CLAUDE.md",
    "CHECKPOINTS.md",
    "docs/specs.md",
    "progress/current.md",
    "progress/history.md",
    "specs/README.md",
  ];

  for (const rel of coreFiles) {
    let content = fs.readFileSync(path.join(PACKAGE_ROOT, rel), "utf8");
    if (rel === "AGENTS.md" && options.withManagedBlock) {
      content = [
        "<!-- BEGIN:external-tool-rules -->",
        "",
        "# Managed block from external tooling",
        "",
        "<!-- END:external-tool-rules -->",
        "",
        "---",
        "",
        content,
      ].join("\n");
    }
    writeFixtureFile(tempRoot, rel, content);
  }

  copyDirSync(
    path.join(PACKAGE_ROOT, "agents"),
    path.join(tempRoot, ".agents"),
  );
  copyDirSync(
    path.join(PACKAGE_ROOT, "claude"),
    path.join(tempRoot, ".claude"),
  );
  copyDirSync(path.join(PACKAGE_ROOT, "codex"), path.join(tempRoot, ".codex"));

  if (stack === "python") {
    writeFixtureFile(
      tempRoot,
      "pyproject.toml",
      '[project]\nname = "sample-python-service"\nversion = "0.1.0"\n',
    );
    writeFixtureFile(
      tempRoot,
      "docs/architecture.md",
      `# Architecture

## Project Structure

\`\`\`text
src/
tests/
\`\`\`

## Architectural Principles

1. Keep business logic inside pure domain modules.

## What Not To Do

- Do not mix HTTP transport logic with domain rules.
`,
    );
    writeFixtureFile(
      tempRoot,
      "docs/conventions.md",
      `# Code Conventions

## Language and Communication

- Use English for code and Conventional Commits.

## Naming Conventions

- Use snake_case for modules and functions.

## Tests

- Use pytest in tests/test_*.py.

## Error Handling

- Raise explicit domain exceptions.
`,
    );
    writeFixtureFile(
      tempRoot,
      "docs/verification.md",
      `# Verification

## Project Commands

| Check | Command | Status |
|---|---|---|
| **Lint** | \`ruff check .\` | Mandatory, active |
| **Typecheck** | \`mypy src\` | Mandatory, active |
| **Tests** | \`pytest\` | Mandatory, active |
`,
    );
  } else if (stack === "go") {
    writeFixtureFile(
      tempRoot,
      "go.mod",
      "module example.com/sample-go-service\n\ngo 1.24\n",
    );
    writeFixtureFile(
      tempRoot,
      "docs/architecture.md",
      `# Architecture

## Directory Structure

\`\`\`text
cmd/
internal/
\`\`\`

## Principles

1. Keep packages cohesive and acyclic.

## Anti-patterns

- Avoid global mutable state.
`,
    );
    writeFixtureFile(
      tempRoot,
      "docs/conventions.md",
      `# Conventions

## Language and Commits

- English identifiers and Conventional Commits.

## Style and Naming

- Standard gofmt and idiomatic Go names.

## Testing

- Table-driven tests in *_test.go files.

## Error Handling

- Return wrapped errors explicitly.
`,
    );
    writeFixtureFile(
      tempRoot,
      "docs/verification.md",
      `# Verification

## Commands

| Check | Command | Status |
|---|---|---|
| **Static lint** | \`golangci-lint run\` | Mandatory |
| **Tests** | \`go test ./...\` | Mandatory |
`,
    );
  } else {
    writeFixtureFile(
      tempRoot,
      "Cargo.toml",
      '[package]\nname = "sample-rust-app"\nversion = "0.1.0"\nedition = "2024"\n',
    );
    writeFixtureFile(
      tempRoot,
      "docs/architecture.md",
      `# Architecture

## Structure

\`\`\`text
src/
\`\`\`

## Rules

1. Separate domain crates from adapters.

## Avoid

- Avoid unwrap in production paths.
`,
    );
    writeFixtureFile(
      tempRoot,
      "docs/conventions.md",
      `# Conventions

## Language

- English code and Conventional Commits.

## Naming

- Follow standard Rust naming lints.

## Tests

- Unit and integration tests via cargo test.

## Error Handling

- Return Result<T, E> everywhere.
`,
    );
    writeFixtureFile(
      tempRoot,
      "docs/verification.md",
      `# Verification

## Commands

| Verification | Command | Status |
|---|---|---|
| **Lint** | \`cargo clippy -- -D warnings\` | Mandatory |
| **Tests** | \`cargo test\` | Mandatory |
`,
    );
  }

  writeFixtureFile(
    tempRoot,
    "feature_list.json",
    `${JSON.stringify(
      {
        project: `sample-${stack}-service`,
        description: `Sample ${stack} repository without package.json`,
        rules: {
          one_feature_at_a_time: true,
          require_tests_to_close: true,
          require_approved_spec_to_implement: true,
          valid_status: [
            "pending",
            "spec_ready",
            "in_progress",
            "done",
            "blocked",
          ],
          sdd_required_when: 'feature has "sdd": true',
        },
        features: options.features ?? [],
      },
      null,
      2,
    )}\n`,
  );

  return tempRoot;
}

export function snapshotDirectoryTree(rootDir: string): Map<string, string> {
  const snapshot = new Map<string, string>();

  function walk(currentRel: string): void {
    const abs =
      currentRel.length === 0 ? rootDir : path.join(rootDir, currentRel);
    const entries = fs
      .readdirSync(abs, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const nextRel =
        currentRel.length === 0 ? entry.name : `${currentRel}/${entry.name}`;
      if (entry.isDirectory()) {
        snapshot.set(`${nextRel}/`, "<DIR>");
        walk(nextRel);
      } else if (entry.isFile()) {
        snapshot.set(
          nextRel,
          fs.readFileSync(path.join(rootDir, nextRel), "utf8"),
        );
      }
    }
  }

  walk("");
  return snapshot;
}
