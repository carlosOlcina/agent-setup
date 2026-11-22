# CHECKPOINTS — Evaluación del estado final

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede usar
> para decidir si el proyecto está sano.

## C1 — El arnés está completo

- [ ] Existen los archivos base: `AGENTS.md`, `CLAUDE.md`, `feature_list.json`,
      `progress/current.md`, `progress/history.md`.
- [ ] Existen los 4 docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/specs.md`, `docs/verification.md`.
- [ ] Los comandos de lint configurados en `docs/verification.md` terminan sin errores.

## C2 — El estado es coherente

- [ ] Como mucho una feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature `done` tiene tests asociados que pasan (según `docs/verification.md`).
- [ ] `progress/current.md` está en plantilla vacía o describe únicamente la sesión activa
      (no contiene restos de sesiones anteriores).

## C3 — El código respeta la arquitectura

- [ ] El código respeta la estructura, límites entre capas/paquetes y dependencias
      definidas en `docs/architecture.md`.
- [ ] El código sigue las convenciones de estilo, nombres y errores de `docs/conventions.md`.
- [ ] No hay dependencias circulares, `console.log()` de debug ni TODOs sin contexto.

## C4 — La verificación es real

- [ ] Existen tests unitarios y/o de integración para los módulos o componentes añadidos o modificados.
- [ ] Todos los comandos obligatorios de `docs/verification.md` (lint, typecheck, tests y build cuando aplique) pasan en verde.

## C5 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`*.tmp`, artefactos temporales o secretos sin ignorar).
- [ ] `progress/history.md` tiene una entrada para la última sesión cerrada.
- [ ] La última feature trabajada está reflejada con su estado correcto en `feature_list.json`.
- [ ] Si se cerró la feature tras aceptación humana, la PR y commits quedaron registrados en `progress/pr_<name>.md`.

## C6 — Spec Driven Development

- [ ] Toda feature con `"sdd": true` en estado `spec_ready`, `in_progress`
      o `done` tiene su carpeta `specs/<name>/` con los 3 archivos:
      `requirements.md`, `design.md`, `tasks.md`.
- [ ] `requirements.md` usa EARS estricto (ver `docs/specs.md`).
- [ ] Toda feature `done` con `"sdd": true` tiene todas sus tasks marcadas
      `[x]` en `tasks.md` (o desviación justificada documentada en `progress/impl_<name>.md`).
- [ ] Cada `R<n>` de `requirements.md` está cubierto por al menos un test
      concreto en la suite del proyecto.

---

**Cómo usar este archivo:** el agente revisor (`reviewer`) recorre cada checkbox,
marca `[x]` o `[ ]` en `progress/review_<name>.md`, y rechaza el cierre de sesión
si quedan requisitos incumplidos en C1–C6.
