<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

---

# Harness Engineering — Spec Driven Development

> Este archivo es el **punto de entrada** para cualquier agente que trabaje en este
> repositorio. NO es una biblia de reglas: es un **mapa**. Lee solo lo que
> necesites cuando lo necesites (divulgación progresiva).

## 1. Antes de empezar (obligatorio)

1. Ejecuta los comandos de verificación base definidos en `docs/verification.md` (lint y typecheck) para comprobar el estado del repositorio.
2. Lee `progress/current.md` para entender en qué estado quedó la última sesión.
3. Lee `feature_list.json`. Toda feature nueva (`"sdd": true`) pasa por **Spec Driven Development** — ver `docs/specs.md` y §4.
4. Lee `docs/specs.md` antes de redactar o implementar cualquier spec o feature `"sdd": true`.

## 2. Mapa del repositorio

| Archivo / carpeta | Qué contiene | Cuándo leerlo |
|---|---|---|
| `feature_list.json` | Lista de tareas con estado (`pending` / `spec_ready` / `in_progress` / `done` / `blocked`) | Siempre, al empezar |
| `progress/current.md` | Estado de la sesión actual | Siempre, al empezar |
| `progress/history.md` | Bitácora append-only de sesiones anteriores | Si necesitas contexto histórico |
| `specs/<feature>/` | `requirements.md` + `design.md` + `tasks.md` (Kiro-style) | Antes de implementar cualquier feature `"sdd": true` |
| `docs/architecture.md` | Arquitectura del proyecto, rutas reales de apps/packages y criterios de calidad | Antes de diseñar o implementar |
| `docs/conventions.md` | Convenciones de estilo, nombres, estructura y tests | Antes de escribir código |
| `docs/specs.md` | Proceso SDD: notación EARS, los 3 archivos, puertas humanas y cierre con PR | Antes de redactar o revisar un spec |
| `docs/verification.md` | Comandos exactos de verificación y trazabilidad de requirements | Antes de declarar una tarea como `done` |
| `CHECKPOINTS.md` | Criterios objetivos C1–C6 de estado final correcto | Para autoevaluar y revisar |
| `.agents/agents/` | Subagentes para Antigravity (`leader`, `spec_author`, `implementer`, `reviewer`, `commiter`, `secure-auditer`, `skill-generator`) | Si orquestas trabajo en Antigravity |
| `.codex/config.toml` y `.codex/agents/` | Configuración y subagentes para OpenAI Codex | Si orquestas trabajo en Codex |
| `.claude/agents/` y `CLAUDE.md` | Configuración, memoria e import para Claude Code | Si orquestas trabajo en Claude Code |
| `.agents/skills/` | Skills reutilizables compartidos del repositorio | Antes de tocar un dominio cubierto por una skill |

Consulta `docs/architecture.md` para ver la estructura concreta de aplicaciones, paquetes y capas de este proyecto.

## 3. Reglas duras (no negociables)

- **Una sola feature a la vez.** No mezcles cambios de varias tareas en la misma sesión.
- **No declares una tarea `done` sin verificación verde.** Ejecuta todos los comandos obligatorios de `docs/verification.md` y asegúrate de que pasan.
- **No saltes la fase de spec.** Toda feature con `"sdd": true` debe pasar por `spec_author` y obtener aprobación humana antes de tocar código.
- **No saltes las puertas de aprobación humana.** El `leader` detiene el flujo en `spec_ready` (aprobación del spec) y tras el `APPROVED` del `reviewer` (aceptación de la feature), y espera.
- **No cierres una feature sin commits atómicos y PR.** Tras el OK humano, el `leader` lanza al `commiter`, que crea la rama `feat/<name>`, hace commits atómicos, push y abre la PR contra `main`.
- **Documenta lo que haces** en `progress/current.md` en tiempo real mientras trabajas, no al final.
- **Deja el repositorio limpio** antes de cerrar la sesión (ver §5).
- **Si no sabes algo, busca en `docs/`** antes de inventarlo.

## 4. Flujo de trabajo (SDD)

```text
pending → [spec_author] → spec_ready → ⏸ HUMANO APRUEBA → in_progress
       → [implementer → reviewer] → ⏸ HUMANO ACEPTA
       → [implementer: done] → [commiter: commits + PR]
```

1. El `leader` detecta la primera feature `pending` con `"sdd": true` (o coordina según el estado en `feature_list.json`).
2. El `leader` lanza `spec_author`, que crea `specs/<name>/{requirements,design,tasks}.md` y marca el estado como `spec_ready`.
3. **Pausa.** El humano lee `specs/<name>/` y aprueba (o pide cambios).
4. Una vez aprobado, el `leader` cambia el estado a `in_progress` y lanza `implementer`.
5. El `implementer` ejecuta `tasks.md` en orden, marcando `[x]` cada task completada.
6. El `reviewer` verifica la trazabilidad `R<n>` ↔ tests, las tasks completas y `CHECKPOINTS.md`; aprueba o rechaza. Si rechaza, el `leader` relanza al `implementer` con el feedback y repite el ciclo.
7. Si aprueba, **pausa de nuevo**: el `leader` presenta el veredicto y pregunta al humano si todo está OK o quiere modificar algo. Si pide cambios, se ajusta la feature (`implementer` dentro del spec, o `spec_author` + nueva aprobación si cambia el alcance) y se repite el paso 6.
8. Con el OK humano, el `implementer` marca `done` y mueve el resumen a `progress/history.md`.
9. El `leader` lanza al `commiter`, que crea la rama `feat/<name>`, hace commits atómicos, push y abre la PR contra `main` (`progress/pr_<name>.md`).

Además del ciclo SDD principal, el `leader` o el usuario pueden invocar bajo demanda a `secure-auditer` (auditoría de seguridad en solo lectura) y `skill-generator` (creación de nuevas skills). Los subagentes comunican artefactos por archivo (`specs/<name>/`, `progress/*.md`), no volcando diffs o specs largos en chat.

## 5. Cierre de sesión (lifecycle)

Antes de terminar:

1. Ejecuta todos los comandos de verificación obligatorios de `docs/verification.md` — todo verde.
2. Si la tarea está acabada y el humano ha dado el OK: el `implementer` marca `status: "done"` en `feature_list.json` y el `leader` lanza al `commiter` para rama `feat/<name>`, commits atómicos, push y PR contra `main`.
3. Mueve el resumen de `progress/current.md` al final de `progress/history.md`.
4. Vacía `progress/current.md` dejando solo la plantilla.
5. No dejes archivos temporales, ni `console.log()` de debug, ni TODOs sin contexto.

## 6. Si te bloqueas

- Relee la sección relevante de `docs/`.
- Si una herramienta o verificación falla de forma inesperada, **no inventes un workaround silencioso**: documenta el bloqueo en `progress/current.md` (y marca `blocked` si corresponde) y para la sesión.

## 7. Reglas generales de ingeniería y estilo

- Usa siempre **inglés** en código, identificadores, comentarios y mensajes de commit.
- Prioriza la simplicidad sobre la complejidad (KISS), evita duplicación (DRY) y aplica SOLID cuando aporte claridad.
- Escribe código autoexplicativo; evita comentarios innecesarios que repitan qué hace el código.
- Usa nombres descriptivos para variables, funciones, clases y archivos; evita abreviaturas salvo las estándar.
- Mantén funciones pequeñas con una única responsabilidad y evita números o cadenas mágicas (usa constantes).
- Respeta el formateo (Prettier) y las reglas de linting del proyecto sin deshabilitarlas sin justificación.
- No introduzcas dependencias nuevas sin beneficio claro; reutiliza utilidades y componentes existentes antes de crear otros nuevos.
- Prefiere composición frente a herencia, elimina código muerto o comentado y evita optimizaciones prematuras.
- Maneja errores de forma explícita y consistente; no asumas valores nulos o indefinidos sin validar.
- Usa tipado fuerte y explícito (evita `any`, prefiere `unknown` cuando el tipo no pueda determinarse con seguridad).
- No modifiques archivos no relacionados con la tarea ni cambies APIs públicas sin justificación; entrega soluciones completas sin TODOs pendientes.
- Antes de empezar a trabajar en una tarea, carga todas las skills relevantes disponibles en `.agents/skills/` (o `.claude/skills/`).

