# Specs (Spec Driven Development)

Every new feature marked with `"sdd": true` in `feature_list.json` creates its
English specification directory here:

```text
specs/<feature-name>/
├── requirements.md   # Requirements in strict English EARS notation (R1, R2, ...)
├── design.md         # Technical decisions and affected files
└── tasks.md          # Executable checklist traceable to R<n>
```

Consult `docs/specs.md` before authoring or implementing any spec.
