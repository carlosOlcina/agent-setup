# Convenciones de código

> Homogeneidad extrema. La IA y el equipo trabajan mejor cuando todo el repositorio
> sigue las mismas convenciones en todas partes.

## Idioma y comunicación

- **Código, identificadores, comentarios y mensajes de commit:** siempre en **inglés**.
- **Documentación del arnés y specs (`AGENTS.md`, `docs/`, `specs/`, `progress/`):** español o el idioma acordado en el proyecto, manteniendo consistencia por archivo.
- **Commits:** formato **Conventional Commits** (`<type>[scope]: <imperative description>`).

## TypeScript / JavaScript

- **Configuración base:** `packages/typescript-config/base.json` (`ES2022`, `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`, `NodeNext`).
- **Formateo:** Prettier (`pnpm format`) respetando las reglas del proyecto.
- **Linting:** ESLint compartido (`@repo/eslint-config`) con `--max-warnings 0`. No deshabilitar reglas sin justificación explícita.
- **Tipado:** explícito en funciones públicas, firmas y contratos compartidos. Prohibido `any` (usar `unknown` y narrowing cuando corresponda).
- **Constantes:** extraer valores y cadenas repetidas o significativas en constantes con nombre descriptivo; evitar números y strings mágicos.

## Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes React (`packages/ui`, `apps/*/`) | PascalCase (o kebab-case si sigue el patrón del directorio existente; mantener coherencia local) | `Button.tsx` / `button.tsx` |
| Hooks React | `use*.ts` / `use*.tsx` | `useFeatureFlag.ts` |
| Servicios / módulos de dominio | `*.service.ts` o kebab-case descriptivo | `auth.service.ts` |
| Utilidades puras | `*.util.ts` o nombre descriptivo en kebab-case | `date-format.util.ts` |
| Tipos / DTOs / Schemas | PascalCase para tipos, sufijo claro | `CreateUserSchema`, `UserProfile` |
| Tests unitarios / integración | `*.test.ts`, `*.test.tsx` o `*.spec.ts` (coherente con el runner del workspace) | `button.test.tsx` |

## Estructura recomendada de un componente React

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

- Toda función pública nueva, servicio o componente con comportamiento debe contar con tests concretos que validen tanto el camino feliz como casos de error o borde.
- Nombres descriptivos que expresen comportamiento esperado (`should return error when input is invalid`).
- Para features con `"sdd": true`, cada test debe ser trazable a un `R<n>` de `specs/<name>/requirements.md`.

## Manejo de errores

- Validar entradas externas y valores potencialmente `null`/`undefined` en los límites del sistema.
- Manejar los errores de forma explícita y consistente; nunca tragar excepciones en silencio ni exponer stack traces internos al usuario final.
