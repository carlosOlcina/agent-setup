import {
  EARS_NON_ENGLISH_KEYWORD_REGEX,
  EARS_PATTERNS,
  EARS_SHALL_CASE_INSENSITIVE_REGEX,
  EARS_SHALL_REGEX,
  EARS_WEAK_VERB_REGEX,
  KEBAB_CASE_REGEX,
  VALID_FEATURE_STATUSES,
} from "../constants.js";
import {
  extractMarkdownHeadings,
  normalizeLineEndings,
  stripInlineCode,
} from "../parsers/markdown.js";
import type { FeatureStatus } from "../types.js";
import {
  readProjectFile,
  scanNonEnglishContent,
  type ValidationContext,
} from "./structure.validator.js";

interface ValidatedFeature {
  readonly name: string;
  readonly sdd: boolean;
  readonly status: FeatureStatus;
}

interface ParsedRequirement {
  readonly id: number;
  readonly line: number;
  readonly text: string;
}

interface ParsedTask {
  readonly id: number;
  readonly checked: boolean;
  readonly line: number;
  readonly text: string;
}

const VALID_STATUS_SET = new Set<string>(VALID_FEATURE_STATUSES);

const DESIGN_FILES_PATTERN =
  /archivo|file|estructura|structure|m[oó]dulo|module|ruta|path/i;
const DESIGN_CONTRACTS_PATTERN =
  /firma|contrato|tipo|contract|signature|type|api|interfaz|interface|esquema|schema|cli/i;
const DESIGN_ERRORS_PATTERN = /error|excepci[oó]n|exception|fallo|failure/i;
const DESIGN_ALTERNATIVES_PATTERN =
  /alternativa|alternative|descartad|discarded|trade-?off/i;
const DEVIATION_KEYWORD_PATTERN =
  /desviaci[oó]n|justificaci[oó]n|deviation|justification|excepci[oó]n|deferred/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateFeatureListRules(
  ctx: ValidationContext,
  rules: unknown,
): void {
  const filePath = "feature_list.json";
  if (!isRecord(rules)) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"feature_list.json" must contain a "rules" object.`,
      filePath,
    });
    return;
  }

  if (rules.one_feature_at_a_time !== true) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"feature_list.json" must set rules.one_feature_at_a_time to true.`,
      filePath,
    });
  }

  if (rules.require_tests_to_close !== true) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"feature_list.json" must set rules.require_tests_to_close to true.`,
      filePath,
    });
  }

  if (rules.require_approved_spec_to_implement !== true) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"feature_list.json" must set rules.require_approved_spec_to_implement to true.`,
      filePath,
    });
  }

  if (!Array.isArray(rules.valid_status)) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"feature_list.json" must define rules.valid_status as an array.`,
      filePath,
    });
    return;
  }

  const statuses = rules.valid_status.map((item) => String(item));
  const statusSet = new Set(statuses);
  const exactStatuses =
    statuses.length === VALID_STATUS_SET.size &&
    statusSet.size === VALID_STATUS_SET.size &&
    [...VALID_STATUS_SET].every((status) => statusSet.has(status));

  if (!exactStatuses) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `rules.valid_status must contain exclusively: ${VALID_FEATURE_STATUSES.join(", ")}.`,
      filePath,
    });
  }
}

function parseRequirements(content: string): readonly ParsedRequirement[] {
  const lines = normalizeLineEndings(content).split("\n");
  const requirements: ParsedRequirement[] = [];
  let inFence = false;

  const reqStartRegex =
    /^\s*(?:[-*]\s+)?(?:\*\*R(\d+):\*\*|\*\*R(\d+)\*\*\s*:|R(\d+)\s*:)\s+(.+)$/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const match = reqStartRegex.exec(line);
    if (match === null) {
      continue;
    }

    const idStr = match[1] ?? match[2] ?? match[3] ?? "";
    const firstBody = match[4]?.trim() ?? "";
    const parts: string[] = [firstBody];

    let nextIndex = index + 1;
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex] ?? "";
      const nextTrimmed = nextLine.trim();
      if (
        nextTrimmed.length === 0 ||
        nextTrimmed.startsWith("#") ||
        /^(`{3,}|~{3,})/.test(nextTrimmed) ||
        reqStartRegex.test(nextLine) ||
        /^\s*[-*]\s+/.test(nextLine)
      ) {
        break;
      }
      parts.push(nextTrimmed);
      nextIndex += 1;
    }

    requirements.push({
      id: Number(idStr),
      line: index + 1,
      text: parts.join(" "),
    });
    index = nextIndex - 1;
  }

  return requirements;
}

function validateRequirementsFile(
  ctx: ValidationContext,
  filePath: string,
  content: string,
): Set<number> {
  const requirements = parseRequirements(content);
  const requirementIds = new Set<number>();

  if (requirements.length === 0) {
    ctx.issues.push({
      code: "SPEC_INVALID_EARS",
      severity: "error",
      message: `Spec "${filePath}" must define at least one EARS requirement (R1..Rn).`,
      filePath,
      line: 1,
    });
    return requirementIds;
  }

  for (let index = 0; index < requirements.length; index += 1) {
    const req = requirements[index];
    if (req === undefined) {
      continue;
    }

    const expectedId = index + 1;
    if (requirementIds.has(req.id)) {
      ctx.issues.push({
        code: "SPEC_INVALID_EARS",
        severity: "error",
        message: `Duplicate requirement ID "R${String(req.id)}" in "${filePath}".`,
        filePath,
        line: req.line,
      });
    } else if (req.id !== expectedId) {
      ctx.issues.push({
        code: "SPEC_INVALID_EARS",
        severity: "error",
        message: `Non-sequential requirement ID "R${String(req.id)}" (expected "R${String(expectedId)}") in "${filePath}".`,
        filePath,
        line: req.line,
      });
    }
    requirementIds.add(req.id);

    const sanitized = stripInlineCode(req.text)
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .trim();

    const nonEnglishKeyword = EARS_NON_ENGLISH_KEYWORD_REGEX.exec(sanitized);
    if (nonEnglishKeyword !== null) {
      ctx.issues.push({
        code: "SPEC_INVALID_EARS",
        severity: "error",
        message: `Requirement "R${String(req.id)}" uses non-English EARS keyword "${nonEnglishKeyword[0]}"; strict English EARS ("SHALL" / "SHALL NOT") is required.`,
        filePath,
        line: req.line,
      });
    }

    const matchesEarsPattern = EARS_PATTERNS.some((pattern) =>
      pattern.test(sanitized),
    );
    if (!matchesEarsPattern) {
      ctx.issues.push({
        code: "SPEC_INVALID_EARS",
        severity: "error",
        message: `Requirement "R${String(req.id)}" does not match any of the 5 strict English EARS patterns.`,
        filePath,
        line: req.line,
      });
    }

    const allShallMatches = sanitized.match(EARS_SHALL_CASE_INSENSITIVE_REGEX);
    const upperShallMatches = sanitized.match(EARS_SHALL_REGEX);
    const allShallCount = allShallMatches?.length ?? 0;
    const upperShallCount = upperShallMatches?.length ?? 0;
    if (allShallCount !== 1 || upperShallCount !== 1) {
      ctx.issues.push({
        code: "SPEC_INVALID_EARS",
        severity: "error",
        message: `Requirement "R${String(req.id)}" must contain exactly one uppercase normative "SHALL" clause (found ${String(allShallCount)}).`,
        filePath,
        line: req.line,
      });
    }

    const weakVerbMatch = EARS_WEAK_VERB_REGEX.exec(sanitized);
    if (weakVerbMatch !== null) {
      ctx.issues.push({
        code: "SPEC_INVALID_EARS",
        severity: "error",
        message: `Requirement "R${String(req.id)}" uses forbidden ambiguous verb "${weakVerbMatch[0]}".`,
        filePath,
        line: req.line,
      });
    }
  }

  return requirementIds;
}

function validateDesignFile(
  ctx: ValidationContext,
  filePath: string,
  content: string,
): void {
  const headings = extractMarkdownHeadings(content);
  if (!headings.some((heading) => heading.level === 1)) {
    ctx.issues.push({
      code: "SPEC_INVALID_DESIGN",
      severity: "error",
      message: `Design document "${filePath}" must contain a top-level '# ' heading.`,
      filePath,
      line: 1,
    });
  }

  const sectionHeadings = headings.filter((heading) => heading.level >= 2);
  const headingMatches = (pattern: RegExp): boolean =>
    sectionHeadings.some((heading) => pattern.test(heading.text));

  if (!headingMatches(DESIGN_FILES_PATTERN)) {
    ctx.issues.push({
      code: "SPEC_INVALID_DESIGN",
      severity: "error",
      message: `Design document "${filePath}" must document affected files or internal structure.`,
      filePath,
    });
  }

  if (!headingMatches(DESIGN_CONTRACTS_PATTERN)) {
    ctx.issues.push({
      code: "SPEC_INVALID_DESIGN",
      severity: "error",
      message: `Design document "${filePath}" must document public signatures, contracts, or types.`,
      filePath,
    });
  }

  if (!headingMatches(DESIGN_ERRORS_PATTERN)) {
    ctx.issues.push({
      code: "SPEC_INVALID_DESIGN",
      severity: "error",
      message: `Design document "${filePath}" must document error and exception handling.`,
      filePath,
    });
  }

  const alternativesHeading = sectionHeadings.find((heading) =>
    DESIGN_ALTERNATIVES_PATTERN.test(heading.text),
  );
  if (alternativesHeading === undefined) {
    ctx.issues.push({
      code: "SPEC_INVALID_DESIGN",
      severity: "error",
      message: `Design document "${filePath}" must include a section documenting at least one discarded alternative.`,
      filePath,
    });
    return;
  }

  const lines = normalizeLineEndings(content).split("\n");
  const nextSiblingHeading = sectionHeadings.find(
    (heading) =>
      heading.line > alternativesHeading.line &&
      heading.level <= alternativesHeading.level,
  );
  const endLine =
    nextSiblingHeading !== undefined
      ? nextSiblingHeading.line - 1
      : lines.length;
  const sectionBody = lines
    .slice(alternativesHeading.line, endLine)
    .join("\n")
    .trim();

  if (sectionBody.length === 0) {
    ctx.issues.push({
      code: "SPEC_INVALID_DESIGN",
      severity: "error",
      message: `Discarded alternatives section in "${filePath}" must not be empty.`,
      filePath,
      line: alternativesHeading.line,
    });
  }
}

function parseTasks(content: string): readonly ParsedTask[] {
  const lines = normalizeLineEndings(content).split("\n");
  const tasks: ParsedTask[] = [];
  let inFence = false;
  const taskStartRegex = /^\s*-\s+\[([ xX])\]\s+T(\d+)\b(.*)$/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const match = taskStartRegex.exec(line);
    if (match === null) {
      continue;
    }

    const checkMark = match[1] ?? " ";
    const idStr = match[2] ?? "";
    const parts: string[] = [match[3]?.trim() ?? ""];

    let nextIndex = index + 1;
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex] ?? "";
      const nextTrimmed = nextLine.trim();
      if (
        nextTrimmed.length === 0 ||
        nextTrimmed.startsWith("#") ||
        /^(`{3,}|~{3,})/.test(nextTrimmed) ||
        taskStartRegex.test(nextLine)
      ) {
        break;
      }
      parts.push(nextTrimmed);
      nextIndex += 1;
    }

    tasks.push({
      id: Number(idStr),
      checked: checkMark.toLowerCase() === "x",
      line: index + 1,
      text: parts.join(" "),
    });
    index = nextIndex - 1;
  }

  return tasks;
}

function hasDocumentedTaskDeviation(
  ctx: ValidationContext,
  featureName: string,
  taskId: number,
): boolean {
  const report = readProjectFile(ctx, `progress/impl_${featureName}.md`);
  if (!report.exists) {
    return false;
  }

  const taskPattern = new RegExp(`\\bT${String(taskId)}\\b`);
  const lines = normalizeLineEndings(report.content).split("\n");
  for (const line of lines) {
    if (taskPattern.test(line) && DEVIATION_KEYWORD_PATTERN.test(line)) {
      return true;
    }
  }

  return (
    taskPattern.test(report.content) &&
    DEVIATION_KEYWORD_PATTERN.test(report.content)
  );
}

function validateTasksFile(
  ctx: ValidationContext,
  feature: ValidatedFeature,
  filePath: string,
  content: string,
  requirementIds: ReadonlySet<number>,
): void {
  const tasks = parseTasks(content);
  if (tasks.length === 0) {
    ctx.issues.push({
      code: "SPEC_INVALID_TASKS",
      severity: "error",
      message: `Tasks checklist "${filePath}" must contain at least one task (- [ ] T1 ...).`,
      filePath,
      line: 1,
    });
    return;
  }

  const seenTaskIds = new Set<number>();
  const coveredRequirements = new Set<number>();

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    if (task === undefined) {
      continue;
    }

    const expectedId = index + 1;
    if (seenTaskIds.has(task.id)) {
      ctx.issues.push({
        code: "SPEC_INVALID_TASKS",
        severity: "error",
        message: `Duplicate task ID "T${String(task.id)}" in "${filePath}".`,
        filePath,
        line: task.line,
      });
    } else if (task.id !== expectedId) {
      ctx.issues.push({
        code: "SPEC_INVALID_TASKS",
        severity: "error",
        message: `Non-sequential task ID "T${String(task.id)}" (expected "T${String(expectedId)}") in "${filePath}".`,
        filePath,
        line: task.line,
      });
    }
    seenTaskIds.add(task.id);

    const referencedIds: number[] = [];
    for (const match of task.text.matchAll(/\bR(\d+)\b/g)) {
      const id = Number(match[1]);
      if (!Number.isNaN(id)) {
        referencedIds.push(id);
      }
    }

    if (referencedIds.length === 0) {
      ctx.issues.push({
        code: "SPEC_INVALID_TASKS",
        severity: "error",
        message: `Task "T${String(task.id)}" in "${filePath}" must reference at least one requirement ID (R<n>).`,
        filePath,
        line: task.line,
      });
    }

    for (const refId of referencedIds) {
      if (requirementIds.size > 0 && !requirementIds.has(refId)) {
        ctx.issues.push({
          code: "SPEC_INVALID_TASKS",
          severity: "error",
          message: `Task "T${String(task.id)}" references non-existent requirement "R${String(refId)}".`,
          filePath,
          line: task.line,
        });
      } else {
        coveredRequirements.add(refId);
      }
    }

    if (
      feature.status === "done" &&
      !task.checked &&
      !hasDocumentedTaskDeviation(ctx, feature.name, task.id)
    ) {
      ctx.issues.push({
        code: "SPEC_UNCHECKED_DONE_TASK",
        severity: "error",
        message: `Done feature "${feature.name}" has unchecked task "T${String(task.id)}" without documented deviation in "progress/impl_${feature.name}.md".`,
        filePath,
        line: task.line,
      });
    }
  }

  for (const reqId of requirementIds) {
    if (!coveredRequirements.has(reqId)) {
      ctx.issues.push({
        code: "SPEC_ORPHAN_REQUIREMENT",
        severity: "error",
        message: `Requirement "R${String(reqId)}" is not referenced by any task in "${filePath}".`,
        filePath,
      });
    }
  }
}

function validateFeatureSpec(
  ctx: ValidationContext,
  feature: ValidatedFeature,
): void {
  const specDir = `specs/${feature.name}`;
  const reqPath = `${specDir}/requirements.md`;
  const designPath = `${specDir}/design.md`;
  const tasksPath = `${specDir}/tasks.md`;

  const reqFile = readProjectFile(ctx, reqPath);
  const designFile = readProjectFile(ctx, designPath);
  const tasksFile = readProjectFile(ctx, tasksPath);

  if (!reqFile.exists || reqFile.content.trim().length === 0) {
    ctx.issues.push({
      code: "SPEC_MISSING_FILE",
      severity: "error",
      message: `Missing or empty spec file "${reqPath}" for SDD feature "${feature.name}".`,
      filePath: reqPath,
    });
  }

  if (!designFile.exists || designFile.content.trim().length === 0) {
    ctx.issues.push({
      code: "SPEC_MISSING_FILE",
      severity: "error",
      message: `Missing or empty spec file "${designPath}" for SDD feature "${feature.name}".`,
      filePath: designPath,
    });
  }

  if (!tasksFile.exists || tasksFile.content.trim().length === 0) {
    ctx.issues.push({
      code: "SPEC_MISSING_FILE",
      severity: "error",
      message: `Missing or empty spec file "${tasksPath}" for SDD feature "${feature.name}".`,
      filePath: tasksPath,
    });
  }

  const requirementIds =
    reqFile.exists && reqFile.content.trim().length > 0
      ? (() => {
          scanNonEnglishContent(ctx, reqPath, reqFile.content, {
            ignoreFences: true,
          });
          return validateRequirementsFile(ctx, reqPath, reqFile.content);
        })()
      : new Set<number>();

  if (designFile.exists && designFile.content.trim().length > 0) {
    scanNonEnglishContent(ctx, designPath, designFile.content, {
      ignoreFences: true,
    });
    validateDesignFile(ctx, designPath, designFile.content);
  }

  if (tasksFile.exists && tasksFile.content.trim().length > 0) {
    scanNonEnglishContent(ctx, tasksPath, tasksFile.content, {
      ignoreFences: true,
    });
    validateTasksFile(
      ctx,
      feature,
      tasksPath,
      tasksFile.content,
      requirementIds,
    );
  }
}

export function validateSpecs(ctx: ValidationContext): void {
  const filePath = "feature_list.json";
  const featureListFile = readProjectFile(ctx, filePath);
  if (!featureListFile.exists || featureListFile.content.trim().length === 0) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(featureListFile.content) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_JSON",
      severity: "error",
      message: `Invalid JSON in "${filePath}": ${detail}`,
      filePath,
    });
    return;
  }

  if (!isRecord(parsed)) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"${filePath}" root value must be a JSON object.`,
      filePath,
    });
    return;
  }

  if (!isNonEmptyString(parsed.project)) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"${filePath}" must define a non-empty string "project".`,
      filePath,
    });
  }

  if (!isNonEmptyString(parsed.description)) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"${filePath}" must define a non-empty string "description".`,
      filePath,
    });
  }

  validateFeatureListRules(ctx, parsed.rules);

  if (!Array.isArray(parsed.features)) {
    ctx.issues.push({
      code: "FEATURE_LIST_INVALID_SCHEMA",
      severity: "error",
      message: `"${filePath}" must define "features" as an array.`,
      filePath,
    });
    return;
  }

  if (ctx.mode !== "project") {
    return;
  }

  const seenNames = new Set<string>();
  const inProgressNames: string[] = [];
  const validatedFeatures: ValidatedFeature[] = [];

  for (let index = 0; index < parsed.features.length; index += 1) {
    const item = parsed.features[index];
    if (!isRecord(item)) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature at index ${String(index)} must be a JSON object.`,
        filePath,
      });
      continue;
    }

    const name = item.name;
    if (!isNonEmptyString(name) || !KEBAB_CASE_REGEX.test(name)) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature at index ${String(index)} must have a valid kebab-case "name".`,
        filePath,
      });
      continue;
    }

    if (seenNames.has(name)) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Duplicate feature name "${name}" in "${filePath}".`,
        filePath,
      });
    } else {
      seenNames.add(name);
    }

    if (!isNonEmptyString(item.title)) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature "${name}" must define a non-empty string "title".`,
        filePath,
      });
    }

    if (!isNonEmptyString(item.description)) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature "${name}" must define a non-empty string "description".`,
        filePath,
      });
    }

    if (typeof item.sdd !== "boolean") {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature "${name}" must define a boolean "sdd" property.`,
        filePath,
      });
    }

    if (typeof item.status !== "string" || !VALID_STATUS_SET.has(item.status)) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature "${name}" has invalid status "${String(item.status)}".`,
        filePath,
      });
      continue;
    }

    if (
      !Array.isArray(item.acceptance_criteria) ||
      item.acceptance_criteria.length === 0 ||
      !item.acceptance_criteria.every((criterion) =>
        isNonEmptyString(criterion),
      )
    ) {
      ctx.issues.push({
        code: "FEATURE_LIST_INVALID_SCHEMA",
        severity: "error",
        message: `Feature "${name}" must define a non-empty "acceptance_criteria" string array.`,
        filePath,
      });
    }

    const status = item.status as FeatureStatus;
    if (status === "in_progress") {
      inProgressNames.push(name);
    }

    if (typeof item.sdd === "boolean") {
      validatedFeatures.push({
        name,
        sdd: item.sdd,
        status,
      });
    }
  }

  if (inProgressNames.length > 1) {
    ctx.issues.push({
      code: "FEATURE_LIST_MULTIPLE_IN_PROGRESS",
      severity: "error",
      message: `At most one feature may be "in_progress" at a time; found ${String(inProgressNames.length)} (${inProgressNames.join(", ")}).`,
      filePath,
    });
  }

  for (const feature of validatedFeatures) {
    if (
      feature.sdd &&
      (feature.status === "spec_ready" ||
        feature.status === "in_progress" ||
        feature.status === "done")
    ) {
      validateFeatureSpec(ctx, feature);
    }
  }
}
