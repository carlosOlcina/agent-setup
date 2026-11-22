@AGENTS.md

## Claude Code

- Los subagentes del proyecto viven en `.claude/agents/` (`leader`, `spec_author`, `implementer`, `reviewer`, `commiter`, `secure-auditer`, `skill-generator`).
- Para iniciar una sesión orquestada con el flujo SDD completo, ejecuta `claude --agent leader` o pide delegar en el subagente correspondiente.
- Las skills compartidas del proyecto viven en `.agents/skills/`; las skills exclusivas de Claude Code pueden ubicarse en `.claude/skills/<name>/SKILL.md`.
