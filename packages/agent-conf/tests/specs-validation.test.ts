import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatValidationReport, validateHarness } from "@repo/agent-conf";
import {
  createValidProjectFixture,
  removeTempDir,
  writeFixtureFile,
} from "./helpers.ts";

const VALID_EARS_REQUIREMENTS = `# Requirements — sample-feature

- **R1:** The system SHALL validate the input before processing, ignoring literal tokens like \`should\` or \`DEBE\` inside inline code.
- **R2:** WHEN a user submits a request, the system SHALL record a unique identifier.
- **R3:** WHILE the queue is active, the system SHALL preserve FIFO ordering.
- **R4:** WHERE strict mode is enabled, the system SHALL NOT accept unknown fields.
- **R5:** IF storage fails, THEN the system SHALL return an explicit error.
`;

const VALID_DESIGN = `# Design — sample-feature

## Affected Files

- \`src/service.py\`

## Public Signatures and Contracts

- \`process_request(payload: dict) -> Result\`

## Error Handling

- Raises \`ValidationError\` on malformed input.

## Discarded Alternatives

### Alternative 1 — Lazy Validation

Rejected because deferring checks hides malformed payloads past system boundaries.
`;

const VALID_DONE_TASKS = `# Tasks — sample-feature

- [x] T1 Implement input validation and error handling. (Covers: R1, R4, R5)
- [x] T2 Implement identifier tracking and FIFO queue ordering. (Covers: R2, R3)
`;

describe("feature_list.json and English SDD specs (EARS, design, tasks) validation", () => {
  it("validates a well-formed feature_list.json and complete English done SDD spec (R7, R15, R16)", () => {
    const projectDir = createValidProjectFixture({
      stack: "python",
      features: [
        {
          name: "sample-feature",
          title: "Sample feature",
          description: "Complete SDD feature",
          sdd: true,
          status: "done",
          acceptance_criteria: ["All requirements verified"],
        },
        {
          name: "next-feature",
          title: "Next feature",
          description: "Pending work",
          sdd: true,
          status: "pending",
          acceptance_criteria: ["Pending spec"],
        },
      ],
    });
    try {
      writeFixtureFile(
        projectDir,
        "specs/sample-feature/requirements.md",
        VALID_EARS_REQUIREMENTS,
      );
      writeFixtureFile(
        projectDir,
        "specs/sample-feature/design.md",
        VALID_DESIGN,
      );
      writeFixtureFile(
        projectDir,
        "specs/sample-feature/tasks.md",
        VALID_DONE_TASKS,
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, true, formatValidationReport(result));
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("rejects invalid JSON, schema errors, duplicate or non-kebab names, and multiple in_progress features (R15)", () => {
    const invalidJsonDir = createValidProjectFixture({ stack: "python" });
    try {
      writeFixtureFile(invalidJsonDir, "feature_list.json", "{ broken json");
      const jsonRes = validateHarness({
        rootDir: invalidJsonDir,
        mode: "project",
      });
      assert.equal(jsonRes.valid, false);
      assert.ok(
        jsonRes.issues.some(
          (issue) => issue.code === "FEATURE_LIST_INVALID_JSON",
        ),
      );
    } finally {
      removeTempDir(invalidJsonDir);
    }

    const schemaDir = createValidProjectFixture({
      stack: "python",
      features: [
        {
          name: "Bad_Name",
          title: "Bad",
          description: "Invalid kebab-case",
          sdd: false,
          status: "pending",
          acceptance_criteria: ["ok"],
        },
        {
          name: "dup-feature",
          title: "First",
          description: "In progress 1",
          sdd: false,
          status: "in_progress",
          acceptance_criteria: ["ok"],
        },
        {
          name: "dup-feature",
          title: "Second",
          description: "Duplicate name and second in_progress",
          sdd: false,
          status: "in_progress",
          acceptance_criteria: ["ok"],
        },
      ],
    });
    try {
      const schemaRes = validateHarness({
        rootDir: schemaDir,
        mode: "project",
      });
      assert.equal(schemaRes.valid, false);
      assert.ok(
        schemaRes.issues.some(
          (issue) => issue.code === "FEATURE_LIST_INVALID_SCHEMA",
        ),
      );
      assert.ok(
        schemaRes.issues.some(
          (issue) => issue.code === "FEATURE_LIST_MULTIPLE_IN_PROGRESS",
        ),
      );
    } finally {
      removeTempDir(schemaDir);
    }
  });

  it("rejects Spanish EARS keywords (DEBE/CUANDO), weak English verbs, multiple SHALL clauses, non-English specs, incomplete design, orphan requirements, and unchecked done tasks (R13, R16)", () => {
    const projectDir = createValidProjectFixture({
      stack: "python",
      features: [
        {
          name: "missing-spec",
          title: "Missing spec",
          description: "Spec ready without files",
          sdd: true,
          status: "spec_ready",
          acceptance_criteria: ["Must have 3 files"],
        },
        {
          name: "broken-spec",
          title: "Broken spec",
          description: "Invalid EARS, design, and tasks",
          sdd: true,
          status: "done",
          acceptance_criteria: ["Must be valid"],
        },
      ],
    });
    try {
      writeFixtureFile(
        projectDir,
        "specs/broken-spec/requirements.md",
        `# Requirements

- **R1:** The system SHALL do A and SHALL do B.
- **R2:** The system should support extra formats and could retry.
- **R4:** CUANDO falla la red, el sistema DEBE reintentar.
`,
      );
      writeFixtureFile(
        projectDir,
        "specs/broken-spec/design.md",
        "# Design\n\n## Notes\n\nMissing required sections and arquitectura residual.\n",
      );
      writeFixtureFile(
        projectDir,
        "specs/broken-spec/tasks.md",
        `# Tasks

- [ ] T1 Incomplete work with missing coverage. (Covers: R1, R99)
`,
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, false);

      const codes = new Set(result.issues.map((issue) => issue.code));
      assert.equal(codes.has("SPEC_MISSING_FILE"), true);
      assert.equal(codes.has("SPEC_INVALID_EARS"), true);
      assert.equal(codes.has("SPEC_INVALID_DESIGN"), true);
      assert.equal(codes.has("SPEC_INVALID_TASKS"), true);
      assert.equal(codes.has("SPEC_ORPHAN_REQUIREMENT"), true);
      assert.equal(codes.has("SPEC_UNCHECKED_DONE_TASK"), true);
      assert.equal(codes.has("NON_ENGLISH_CONTENT"), true);

      const earsIssues = result.issues.filter(
        (issue) => issue.code === "SPEC_INVALID_EARS",
      );
      assert.ok(
        earsIssues.some((issue) =>
          /forbidden ambiguous verb/i.test(issue.message),
        ),
      );
      assert.ok(
        earsIssues.some((issue) =>
          /non-English EARS keyword/i.test(issue.message),
        ),
      );
      assert.ok(
        earsIssues.some((issue) =>
          /exactly one uppercase normative "SHALL"/i.test(issue.message),
        ),
      );
    } finally {
      removeTempDir(projectDir);
    }
  });

  it("allows an unchecked task in a done feature when deviation is explicitly documented in progress/impl_<name>.md (R16)", () => {
    const projectDir = createValidProjectFixture({
      stack: "python",
      features: [
        {
          name: "justified-feature",
          title: "Justified deviation",
          description: "Done feature with documented deviation",
          sdd: true,
          status: "done",
          acceptance_criteria: ["Documented deviation accepted"],
        },
      ],
    });
    try {
      writeFixtureFile(
        projectDir,
        "specs/justified-feature/requirements.md",
        VALID_EARS_REQUIREMENTS,
      );
      writeFixtureFile(
        projectDir,
        "specs/justified-feature/design.md",
        VALID_DESIGN,
      );
      writeFixtureFile(
        projectDir,
        "specs/justified-feature/tasks.md",
        `# Tasks

- [x] T1 Implement core validation. (Covers: R1, R4, R5)
- [ ] T2 Deferred task with justification. (Covers: R2, R3)
`,
      );
      writeFixtureFile(
        projectDir,
        "progress/impl_justified-feature.md",
        "# Implementation Report\n\n- Documented deviation for T2: deferred by approved external integration.\n",
      );

      const result = validateHarness({ rootDir: projectDir, mode: "project" });
      assert.equal(result.valid, true, formatValidationReport(result));
    } finally {
      removeTempDir(projectDir);
    }
  });
});
