# Verificación — Cómo demostrar que el trabajo funciona

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda feature termina con evidencia ejecutable, no con afirmaciones.
> Este archivo es la fuente única de verdad para los comandos de verificación del proyecto.

## Comandos del proyecto (`Olcina-IA`)

| Verificación | Comando | Estado en el template inicial |
|---|---|---|
| **Lint** | `pnpm lint` (`turbo run lint`) | Obligatorio, activo (`eslint --max-warnings 0`) |
| **Typecheck** | `pnpm check-types` (`turbo run check-types`) | Obligatorio, activo (`next typegen && tsc --noEmit`) |
| **Build** | `pnpm build` (`turbo run build`) | Obligatorio cuando se modifiquen rutas, configs o bundling |
| **Tests** | `pnpm test` (`turbo run test`) | **Pendiente de configurar** en el starter base (ver nota abajo) |

> **Nota sobre tests en el starter base:** el `package.json` raíz y `turbo.json` iniciales todavía no incluyen una tarea `test` ni un runner (Vitest/Jest/Playwright). Al añadir la primera feature con lógica testeable o una tarea específica de infraestructura de tests, se debe configurar el runner, añadir el script `"test"` al `package.json` y `turbo.json`, y actualizar esta tabla. **Nunca** afirmes que los tests pasan si no existe runner configurado o si no se ejecutaron tras tu última edición.

## Niveles de verificación

### Nivel 1 — Tests unitarios e integración (obligatorio)

Toda función pública nueva, hook o componente con lógica debe tener al menos un test que:
1. Cubra el camino feliz y verifique el resultado concreto.
2. Cubra al menos un camino de error o caso borde relevante.

```bash
pnpm test
```

### Nivel 2 — Lint y Typecheck (obligatorio)

```bash
pnpm lint
pnpm check-types
```

Deben terminar con `0` errores y `0` warnings (`--max-warnings 0`).

### Nivel 3 — Build (cuando aplique o antes de cierre de release)

```bash
pnpm build
```

### Nivel 4 — Trazabilidad de requirements (obligatorio para features con `"sdd": true`)

Cada `R<n>` de `specs/<name>/requirements.md` debe poder mapearse a al menos un test concreto en la suite del proyecto. El `reviewer` rechaza la feature si falta cobertura.

## Anti-patrones (no hacer)

- ❌ "He añadido la funcionalidad, debería funcionar." → falta evidencia ejecutable.
- ❌ Test que solo comprueba que no lanza excepción → debe afirmar el resultado o efecto esperado.
- ❌ Reportar tests en verde cuando `pnpm test` no existe o se ejecutó con filtros parciales sin aclararlo.
- ❌ Marcar una feature como `done` con lint, typecheck o tests en rojo.

## Verificación final antes de cerrar una sesión

```bash
pnpm lint && pnpm check-types
```

(Y `pnpm test` una vez configurado el runner en el proyecto, además de `pnpm build` si hubo cambios de build/rutas/configuración.)

Si alguna comprobación falla o falta la infraestructura necesaria para verificar un requisito, **no** marques nada como `done`. Documenta el bloqueo en `progress/current.md` y marca `"status": "blocked"` en `feature_list.json`.
