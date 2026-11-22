# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define la estructura técnica y el estándar de calidad del repositorio.
> Los agentes (`spec_author`, `implementer`, `reviewer`) consultan y evalúan contra este archivo.
> Si adaptas este arnés a otro proyecto, actualiza este archivo (junto con `docs/conventions.md` y `docs/verification.md`) sin necesidad de tocar las definiciones genéricas de los agentes.

## Estructura del monorepo (Olcina-IA)

Este repositorio es un monorepo gestionado con **Turborepo** y **pnpm** (`package.json`, `pnpm-workspace.yaml`, `turbo.json`), preparado para despliegue multi-servicio en Vercel (`vercel.json`):

```text
apps/
├── web/                  # Aplicación web principal (Next.js 16 + React 19)
└── docs/                 # Aplicación de documentación (Next.js 16 + React 19, bajo /docs)

packages/
├── ui/                   # @repo/ui — librería compartida de componentes React
├── eslint-config/        # @repo/eslint-config — configuración compartida de ESLint
└── typescript-config/    # @repo/typescript-config — base tsconfig compartida
```

## Principios arquitectónicos

1. **Orquestación de tareas con Turborepo y pnpm.**
   Ejecuta las tareas del workspace mediante `pnpm` y `turbo` (ver comandos exactos en `docs/verification.md`), evitando invocar binarios locales sin pasar por los scripts definidos.

2. **Separación clara entre aplicaciones y paquetes compartidos:**
   - `apps/web/` y `apps/docs/` contienen rutas, páginas, layouts y lógica propia de cada app Next.js.
   - `packages/ui/` aloja únicamente componentes y primitivas UI reutilizables entre aplicaciones, sin acoplarse a rutas ni secretos de una app concreta.
   - `packages/eslint-config/` y `packages/typescript-config/` centralizan las reglas de tooling para todo el monorepo.

3. **Fronteras limpias de dependencias:**
   - Las aplicaciones dependen de `packages/*`, nunca una app de otra app (`web` ↔ `docs`).
   - No crear dependencias circulares entre paquetes del workspace.

4. **TypeScript estricto:**
   - Mantener compatibilidad con `packages/typescript-config/base.json` (`strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`).
   - No usar `any`; tipar explícitamente las APIs públicas y props de componentes.

5. **Enrutamiento y composición:**
   - Respetar las reglas de composición de `vercel.json` (`/docs` y `/docs/(.*)` → `docs`, `/(.*)` → `web`).

6. **Verificación y testing:**
   - Toda nueva funcionalidad con lógica de negocio o UI interactiva debe ir acompañada de pruebas automatizadas y mantener lint, typecheck y build en verde.

## Qué NO hacer

- ❌ No usar `console.log()` de debug ni para gestión de errores; usa manejo explícito de errores.
- ❌ No duplicar componentes entre `apps/web` y `apps/docs` cuando pertenezcan a `@repo/ui`.
- ❌ No introducir dependencias circulares entre workspaces.
- ❌ No saltar la verificación de tipos, lint ni tests al cerrar una feature.
