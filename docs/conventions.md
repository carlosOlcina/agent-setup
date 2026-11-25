# Code Conventions

> Extreme consistency. Both humans and AI agents work faster and more reliably
> when the entire repository follows the same conventions everywhere.

## Language and Communication

- **Code, identifiers, comments, SDD templates, specs (`AGENTS.md`, `docs/`, `specs/`, `progress/`), and commit messages:** strictly in **English**.
- **Commits:** **Conventional Commits** format (`<type>[scope]: <imperative description>`).

## TypeScript / JavaScript

- **Base configuration:** `packages/typescript-config/base.json` (`ES2022`, `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`, `NodeNext`).
- **Formatting:** Prettier (`pnpm format`) respecting the repository's configured rules.
- **Linting:** shared ESLint (`@repo/eslint-config`) with `--max-warnings 0`. Never disable rules without explicit justification.
- **Typing:** explicit types on public functions, contracts, and shared interfaces. `any` is forbidden (use `unknown` and type narrowing where needed).
- **Constants:** extract repeated or meaningful literals into descriptive named constants; avoid magic numbers and strings.

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| React components (`packages/ui`, `apps/*/`) | PascalCase (or kebab-case matching local directory pattern; keep local consistency) | `Button.tsx` / `button.tsx` |
| React hooks | `use*.ts` / `use*.tsx` | `useFeatureFlag.ts` |
| Services / domain modules | `*.service.ts` or descriptive kebab-case | `auth.service.ts` |
| Pure utilities | `*.util.ts` or descriptive kebab-case | `date-format.util.ts` |
| Types / DTOs / schemas | PascalCase with clear suffix | `CreateUserSchema`, `UserProfile` |
| Unit / integration tests | `*.test.ts`, `*.test.tsx`, or `*.spec.ts` (consistent with workspace runner) | `cli.test.ts` |

## Recommended React Component Structure

```tsx
import type { ReactNode } from "react";

export interface CardProps {
  title: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

## Tests

- Every new public function, service, or stateful component must have concrete tests validating both happy paths and relevant error or edge cases.
- Use descriptive test names expressing expected behavior (`rejects invalid input with explicit error`).
- For `"sdd": true` features, every test maps to an `R<n>` requirement in `specs/<name>/requirements.md`.

## Error Handling

- Validate external inputs and potentially `null`/`undefined` values at system boundaries.
- Handle errors explicitly and consistently; never swallow exceptions silently or expose internal stack traces to end users.
