# Code Conventions

> Extreme consistency. Both humans and AI agents work faster and more reliably
> when the entire repository follows the same conventions everywhere.

## Language and Communication

- **Code, identifiers, comments, specs, and commit messages:** always in **{{CODE_LANGUAGE}}** (English by default).
- **Harness documentation (`AGENTS.md`, `docs/`, `specs/`, `progress/`):** {{DOCS_LANGUAGE}}.
- **Commits:** **Conventional Commits** format (`<type>[scope]: <imperative description>`).

## Language, Style, and Formatting

- **Primary stack and version:** {{PRIMARY_STACK}}
- **Formatting:** `{{FORMAT_COMMAND}}` following the repository's configured rules.
- **Static analysis / lint:** `{{LINT_COMMAND}}` without disabling rules unless explicitly justified.
- **Typing and contracts:** {{TYPING_CONVENTIONS}}
- **Constants:** extract repeated or meaningful literals into descriptive named constants; avoid magic numbers and strings.

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Domain modules / services | {{MODULE_NAMING_STYLE}} | `{{MODULE_NAMING_EXAMPLE}}` |
| Pure utilities | {{UTIL_NAMING_STYLE}} | `{{UTIL_NAMING_EXAMPLE}}` |
| Types / models / contracts | {{TYPE_NAMING_STYLE}} | `{{TYPE_NAMING_EXAMPLE}}` |
| Unit / integration tests | {{TEST_FILE_PATTERN}} | `{{TEST_FILE_EXAMPLE}}` |

## Tests

- Every new public function, domain module, or stateful unit must have concrete tests covering both happy paths and error or edge cases.
- Use descriptive test names expressing expected behavior (`{{TEST_CASE_EXAMPLE}}`).
- For `"sdd": true` features, every test must map to an `R<n>` requirement in `specs/<name>/requirements.md`.

## Error Handling

- Validate external inputs and potentially missing or null values at system boundaries.
- Handle errors explicitly and consistently; never swallow exceptions silently or expose internal stack traces to end users.
- {{PROJECT_ERROR_HANDLING_NOTES}}
