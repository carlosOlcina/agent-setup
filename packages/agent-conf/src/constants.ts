export const SDD_AGENTS = [
  "leader",
  "spec_author",
  "implementer",
  "reviewer",
  "commiter",
] as const;

export const AGENT_PLATFORMS = ["agents", "claude", "codex"] as const;

export const VALID_FEATURE_STATUSES = [
  "pending",
  "spec_ready",
  "in_progress",
  "done",
  "blocked",
] as const;

export const VALIDATION_RULE_CODES = [
  "HARNESS_MISSING_PATH",
  "HARNESS_EMPTY_FILE",
  "NON_ENGLISH_CONTENT",
  "TEMPLATE_FORBIDDEN_DOT_DIR",
  "TEMPLATE_FORBIDDEN_SKILLS_DIR",
  "TEMPLATE_STACK_COUPLED_CONTENT",
  "TEMPLATE_MISSING_PLACEHOLDER",
  "ADAPTER_UNRESOLVED_PLACEHOLDER",
  "ADAPTER_MISSING_SECTION",
  "VERIFICATION_INVALID_TABLE",
  "VERIFICATION_EMPTY_COMMAND",
  "AGENT_UNEXPECTED_FILE",
  "AGENT_MISSING_FILE",
  "AGENT_INVALID_SYNTAX",
  "AGENT_INVALID_CONTRACT",
  "AGENT_ROLE_TOOL_VIOLATION",
  "AGENT_FORBIDDEN_REFERENCE",
  "AGENT_PARITY_MISMATCH",
  "CANONICAL_SYNC_MISMATCH",
  "FEATURE_LIST_INVALID_JSON",
  "FEATURE_LIST_INVALID_SCHEMA",
  "FEATURE_LIST_MULTIPLE_IN_PROGRESS",
  "SPEC_MISSING_FILE",
  "SPEC_INVALID_EARS",
  "SPEC_INVALID_DESIGN",
  "SPEC_INVALID_TASKS",
  "SPEC_ORPHAN_REQUIREMENT",
  "SPEC_UNCHECKED_DONE_TASK",
] as const;

export const BASE_HARNESS_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CHECKPOINTS.md",
  "docs/architecture.md",
  "docs/conventions.md",
  "docs/specs.md",
  "docs/verification.md",
  "feature_list.json",
  "progress/current.md",
  "progress/history.md",
  "specs/README.md",
] as const;

export const ADAPTER_FILES = [
  "docs/architecture.md",
  "docs/conventions.md",
  "docs/verification.md",
  "feature_list.json",
] as const;

export const CANONICAL_CORE_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CHECKPOINTS.md",
  "docs/specs.md",
  "specs/README.md",
] as const;

export const CORE_NO_SKILL_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CHECKPOINTS.md",
  "docs/specs.md",
] as const;

export const TEMPLATE_FORBIDDEN_DOT_DIRS = [
  ".agents",
  ".claude",
  ".codex",
] as const;

export const FORBIDDEN_CLI_SUBCOMMANDS = [
  "init",
  "update",
  "install",
  "sync",
  "upgrade",
] as const;

export const PLACEHOLDER_REGEX = /\{\{[A-Z0-9_]+\}\}/g;
export const TODO_ADAPTER_REGEX = /TODO\(agent-conf\)/g;
export const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface NamedPattern {
  readonly label: string;
  readonly pattern: RegExp;
}

export const STACK_COUPLED_PATTERNS: readonly NamedPattern[] = [
  { label: "Olcina-IA", pattern: /\bOlcina-IA\b/i },
  { label: "Turborepo", pattern: /\bTurborepo\b/i },
  { label: "turbo.json", pattern: /\bturbo\.json\b/i },
  { label: "pnpm", pattern: /\bpnpm\b/i },
  { label: "Next.js", pattern: /\bNext\.js\b/i },
  { label: "React", pattern: /\bReact\b/i },
  { label: "TypeScript", pattern: /\bTypeScript\b/i },
  { label: "ESLint", pattern: /\bESLint\b/i },
  { label: "Prettier", pattern: /\bPrettier\b/i },
  { label: "Vercel", pattern: /\bVercel\b/i },
  { label: "@repo/", pattern: /@repo\//i },
];

export const FORBIDDEN_AGENT_REFERENCE_PATTERNS: readonly NamedPattern[] = [
  { label: "SKILL.md", pattern: /SKILL\.md/i },
  {
    label: ".agents/skills",
    pattern: /(?:^|[^a-z0-9_])\.?agents[/\\]skills\b/i,
  },
  {
    label: ".claude/skills",
    pattern: /(?:^|[^a-z0-9_])\.?claude[/\\]skills\b/i,
  },
  { label: ".codex/skills", pattern: /(?:^|[^a-z0-9_])\.?codex[/\\]skills\b/i },
  {
    label: "cargar skills",
    pattern: /\bcarg(?:a|ar)\b[^\n]{0,30}\bskills\b/i,
  },
  { label: "load skills", pattern: /\bload\b[^\n]{0,30}\bskills\b/i },
  { label: "secure-auditer", pattern: /\bsecure-auditer\b/i },
  { label: "skill-generator", pattern: /\bskill-generator\b/i },
];

export const REQUIRED_OUTPUT_CONTRACTS = {
  leader: [
    "spec_ready -> specs/<name>/",
    "done -> progress/impl_<name>.md",
    "APPROVED -> progress/review_<name>.md",
    "CHANGES_REQUESTED -> progress/review_<name>.md",
    "pr -> progress/pr_<name>.md",
  ],
  spec_author: [
    "spec_ready -> specs/<name>/",
    "blocked -> progress/spec_<name>.md",
  ],
  implementer: [
    "done -> progress/impl_<name>.md",
    "blocked -> progress/impl_<name>.md",
  ],
  reviewer: [
    "APPROVED -> progress/review_<name>.md",
    "CHANGES_REQUESTED -> progress/review_<name>.md",
  ],
  commiter: ["pr -> progress/pr_<name>.md", "blocked -> progress/pr_<name>.md"],
} as const;

export const LEADER_CLAUDE_SUBAGENTS = [
  "spec_author",
  "implementer",
  "reviewer",
  "commiter",
] as const;

export const NON_ENGLISH_DIACRITICS_REGEX = /[¡¿áéíóúñüÁÉÍÓÚÑÜ]/;

export const NON_ENGLISH_SPANISH_KEYWORDS_REGEX =
  /\b(eres|debe|deben|cuando|mientras|donde|entonces|arquitectura|convenciones|requisitos|tareas|bitacora|ninguna|proyecto|reglas|flujo|agente|agentes|subagente|subagentes|archivo|archivos|carpeta|carpetas|obligatorio|opcional|pendiente|criterios|humano|humana)\b/i;

export const EARS_NON_ENGLISH_KEYWORD_REGEX =
  /\b(DEBE|CUANDO|MIENTRAS|DONDE|ENTONCES)\b/;

export const EARS_WEAK_VERB_REGEX =
  /\b(can|could|may|might|should|support|supports|puede|pueden|podría|podrían|debería|deberían|soporta|soportan)\b/i;

export const EARS_SHALL_REGEX = /\bSHALL\b/g;
export const EARS_SHALL_CASE_INSENSITIVE_REGEX = /\bSHALL\b/gi;

export const EARS_PATTERNS: readonly RegExp[] = [
  /^The system (?:SHALL NOT|SHALL)\b/,
  /^WHEN\b.+,\s*the system (?:SHALL NOT|SHALL)\b/,
  /^WHILE\b.+,\s*the system (?:SHALL NOT|SHALL)\b/,
  /^WHERE\b.+,\s*the system (?:SHALL NOT|SHALL)\b/,
  /^IF\b.+?,?\s+THEN the system (?:SHALL NOT|SHALL)\b/,
];

export const VERIFICATION_PENDING_MARKERS: readonly RegExp[] = [
  /pending configuration/i,
  /not configured/i,
  /pendiente de configurar/i,
  /\btbd\b/i,
  /\btodo\b/i,
  /^n\/a$/i,
  /^-+$/,
];
