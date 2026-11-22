# Spec Driven Development (SDD)

> Este proyecto sigue un flujo Kiro-style: requirements → design → tasks → code.
> El código no se escribe hasta que el spec está aprobado por un humano.

## Estructura

Cada feature nueva (`"sdd": true` en `feature_list.json`) tiene una carpeta
dedicada en cuanto deja `pending`:

```text
specs/<feature-name>/
├── requirements.md   # QUÉ se necesita (EARS notation)
├── design.md         # CÓMO se construirá (decisiones técnicas)
└── tasks.md          # PASOS concretos a implementar
```

El `feature-name` coincide con el campo `name` de `feature_list.json`.

## Estados de una feature

| Estado | Significado |
|---|---|
| `pending` | Sin spec. El `spec_author` es el primero en actuar. |
| `spec_ready` | Spec redactado. Esperando aprobación humana. NO se toca código. |
| `in_progress` | Spec aprobado. `implementer`/`reviewer` trabajando, o pendiente del OK humano. |
| `done` | Verificación verde, `reviewer` aprobó, humano aceptó y se cerró con PR. |
| `blocked` | Atascado. Razón documentada en `progress/current.md`. |

## Las puertas de aprobación humana

El flujo automático se detiene **dos veces**:

1. **Aprobación del spec.** Cuando el `spec_author` termina sus tres
   archivos, marca la feature como `spec_ready` y para. El humano lee
   `specs/<feature>/` y dice "aprobado" (o pide cambios).
2. **Aceptación tras el reviewer.** Cuando el `reviewer` da `APPROVED`
   (`progress/review_<feature>.md`), el `leader` presenta el veredicto y
   pregunta si todo está OK o se quiere modificar algo. Si se piden
   cambios, se ajusta la feature (`implementer`/`reviewer`, o `spec_author` +
   nueva aprobación del spec si cambia el alcance) y se repite la
   revisión. Solo con el OK humano el `implementer` marca `done`.

Tras el OK humano, el `leader` lanza al `commiter`, que crea la rama
`feat/<name>`, hace commits atómicos, push y abre la PR contra `main`
(deja el resumen en `progress/pr_<feature>.md`).

```text
pending → [spec_author] → spec_ready → ⏸ HUMANO APRUEBA → in_progress
       → [implementer → reviewer] → ⏸ HUMANO ACEPTA
       → [implementer: done] → [commiter: commits + PR]
```

## requirements.md — EARS estricto

Las requirements se redactan en **EARS** (Easy Approach to Requirements
Syntax). Cada requirement es un párrafo numerado con uno de estos cinco
patrones:

| Patrón | Plantilla |
|---|---|
| **Ubicuo** | `El sistema DEBE <acción>.` |
| **Evento** | `CUANDO <disparador>, el sistema DEBE <acción>.` |
| **Estado** | `MIENTRAS <estado>, el sistema DEBE <acción>.` |
| **Opcional** | `DONDE <feature opcional>, el sistema DEBE <acción>.` |
| **No deseado** | `SI <evento no deseado> ENTONCES el sistema DEBE <acción>.` |

Reglas duras:

- Cada requirement tiene un id estable: `R1`, `R2`, ...
- Cada requirement DEBE ser verificable por al menos un test concreto.
- No mezcles varios `DEBE` en un mismo requirement. Si hay más de uno, parte.
- No uses verbos blandos ("podría", "puede", "soporta"). Solo `DEBE` / `NO DEBE`.

## design.md — decisiones técnicas

Captura **antes** de tocar código:

- Qué archivos se crean o modifican.
- Qué firmas, contratos o tipos nuevos aparecen (funciones, clases, endpoints, componentes).
- Qué errores o excepciones se reutilizan o añaden.
- Qué alternativa se descartó y por qué (mínimo una).

NO es ingeniería desde primeros principios — apóyate en
`docs/architecture.md` y `docs/conventions.md`.

## tasks.md — checklist ejecutable

Pasos discretos en orden, cada uno con checkbox (`- [ ] T1 ...`). Cada task
referencia al menos un `R<n>` que cubre.

El `implementer` marca `[x]` cada task al completarla. El `reviewer`
rechaza si queda alguna `[ ]` sin justificación documentada.

## Trazabilidad (regla dura)

- Cada test añadido o modificado para la feature debe poder mapearse a un `R<n>` de su spec.
- Cada `R<n>` debe tener al menos un test concreto en la suite de tests del proyecto.
- El `reviewer` comprueba esta correspondencia explícitamente y rechaza si falta.
