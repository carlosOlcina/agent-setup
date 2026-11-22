# Specs (Spec Driven Development)

Cada feature nueva marcada con `"sdd": true` en `feature_list.json` genera aquí su carpeta:

```text
specs/<feature-name>/
├── requirements.md   # Requisitos en notación EARS (R1, R2, ...)
├── design.md         # Decisiones técnicas y archivos afectados
└── tasks.md          # Checklist ejecutable trazable a R<n>
```

Consulta `docs/specs.md` antes de redactar o implementar cualquier spec.
