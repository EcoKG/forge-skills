# Changelog

All notable changes to the Forge Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [8.0.0] - 2026-03-21

### Added
- **Gatekeeper** — Haiku-based intent classifier replacing 14-file activation system
  - `core/gatekeeper-router.js`: UserPromptSubmit hook for prompt classification
  - `core/gatekeeper-init.js`: SessionStart hook for skill catalog scanning
  - `prompts/gatekeeper.md`: LLM classification prompt (optional Haiku fallback)
  - 6 categories: code-modify, discuss, question, command, skill-task, meta
  - Cross-category suppression to prevent false positives
  - Korean + English keyword support
  - Rollback switch: `GATEKEEPER_ENABLED=false`

- **Workspace Context** — Docker-like file scoping for pipelines
  - `core/workspace-context.js`: createContext, classifyFile, loadContext, expandScope
  - Precedence: ignore > readonly > scope > out-of-scope
  - Auto-scope from detect-stack (7 languages, framework markers)
  - Runtime scope expansion via `engine-expand-scope`

- **Gate Guard enhancements**
  - `isProjectFile()`: stops blocking files outside project root
  - Shell variable resolution in `detectBashWriteTarget()` ($HOME, $PWD)
  - Context-aware file classification when workspace context exists
  - Gatekeeper-aware meta-workflow exclusion

- **Framework structure**
  - `forge-framework/` directory with core/, shared/, prompts/, skills/forge-dev/
  - Framework SKILL.md (entry point) + forge-dev SKILL.md (development pipeline)
  - Universal skill routing architecture

- **Ecosystem**
  - `docs/skill-developer-guide.md`: Level 0-4 tutorial (529 lines)
  - 3 example skills: deploy, review, release
  - Skill template with placeholders
  - README.md with installation guide

### Removed
- 14 activation files (~3,293 LOC): skill-activation.js, skill-activation-guard.js,
  skill-activation-stop.js, rules-matcher.js, semantic-analyzer.js, intent-classifier.js,
  context-accumulator.js, adaptive-engine.js, user-profile.js, batch-calibrator.js,
  session-tracker.js, types.js, skill-rules.json, package.json

### Changed
- `forge-tools.js` → `core/pipeline-engine.js` (generalized)
- `forge-gate-guard.js` → `core/gate-guard.js` (context-aware)
- `forge-orchestrator.js` → `core/orchestrator.js` (Gatekeeper routing injection)
- `install.js` → `core/install.js` (new hooks, legacy cleanup)

## [7.0.0] - 2026-03-20

### Note
v7.0 "Bastion" was the last version before the framework transition.
See `forge/SKILL.md` for the original v7.0 documentation.
