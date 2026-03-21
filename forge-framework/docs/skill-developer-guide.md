# Forge Framework v8.0 — Skill Developer Guide

**Target audience:** Developers who want to build custom skills on top of Forge Framework v8.0 "Nova".
**Prerequisites:** Basic familiarity with Claude Code and the `/forge` command.

---

## 1. Introduction

### What is a Forge Framework skill?

A skill is a named, declarative unit of behavior that the Forge Framework routes to, executes, and enforces quality gates on. Skills live under `~/.claude/skills/` and are discovered automatically at session start — no registration, no imports.

At its core a skill is just a Markdown file with a YAML front-matter manifest. The manifest tells the framework everything it needs to know: what the skill does, how to route to it, which pipeline to run, and which files it is allowed to touch. The instructions body tells Claude how to behave once routed.

### How does it differ from a plain Claude Code skill?

A plain `~/.claude/skills/my-skill/SKILL.md` is loaded as static context — Claude reads it and acts on it freehand. A Forge Framework skill gets the full platform on top of that:

| Plain skill | Forge Framework skill |
|---|---|
| Loaded as context | Routed by Gatekeeper (Haiku subagent) |
| No file access control | Gate Guard enforces workspace scope |
| No pipeline | Pipeline engine drives step-by-step execution |
| No quality checks | Quality gates block bad commits |
| Single mode | Multiple modes (standard, quick, debug, ...) |

The framework treats skills as **plugins**: declarative metadata drives the infrastructure; the skill's own instructions (and optional agent prompts) handle the logic.

---

## 2. Quick Start (5 minutes)

Create a file at `~/.claude/skills/my-skill/SKILL.md`:

```yaml
---
name: my-skill
description: "What this skill does"
routing:
  triggers: ["keyword1", "keyword2"]
---
Your skill instructions here...
```

That is a complete, valid Forge Framework skill. Five lines of YAML. The framework provides the rest.

### Where to put it

```
~/.claude/skills/
  my-skill/
    SKILL.md          ← required (manifest + instructions)
    templates/        ← optional (pipeline.json, agent prompts)
    agents/           ← optional (custom agent prompt files)
```

The framework scans every subdirectory of `skills/` at `SessionStart`. Any directory containing a `SKILL.md` with a valid `name` and `description` is registered in the skill catalog.

### How the Gatekeeper routes to it

On every user turn, a Haiku subagent (the Gatekeeper) reads the skill catalog and classifies the user's prompt:

```
User prompt → Gatekeeper (Haiku) → { skill: "my-skill", confidence: 0.89, ... }
                                          ↓
                                   Framework routes to my-skill
                                   Pipeline engine initializes
                                   Gate Guard activates
```

The Gatekeeper matches the prompt against each skill's `description` and `routing.triggers`. A skill with a clear, specific description wins over a vague one. High confidence (> 0.85) routes directly; lower confidence falls back to the default `forge-dev` skill.

---

## 3. Level 0: Basic Routing

The minimum viable skill — just triggers and description. No pipeline customization, no workspace scoping. The framework handles everything else using defaults.

```yaml
---
name: docs-writer
description: |
  Writes and updates technical documentation, README files, API docs,
  and changelogs. Use for any documentation creation or update task.
routing:
  triggers:
    - write docs
    - update README
    - API documentation
    - changelog
    - document this
  anti-triggers:
    - code explanation only
    - just describe
  priority: normal
  categories:
    - docs
---

# docs-writer

Write clear, accurate documentation...
```

### How the Gatekeeper classifies prompts

The Gatekeeper produces a classification object:

```json
{
  "category": "docs",
  "skill": "docs-writer",
  "confidence": 0.92,
  "config": { "mode": "standard", "type": "docs", "scale": "small" }
}
```

`category` maps to intent type. `skill` is the resolved skill name. `confidence` drives routing strictness.

### Adding anti-triggers to reduce false positives

Anti-triggers tell the Gatekeeper when **not** to route here, even if the triggers match:

```yaml
routing:
  triggers: ["deploy", "release", "rollback"]
  anti-triggers:
    - "explain deployment"
    - "what is a deployment"
    - "how does deploy work"
```

Use anti-triggers for adjacent domains. If your skill is for running deployments but there is also a separate `docs-writer` skill, add `"deployment docs"` as an anti-trigger on the deploy skill so documentation requests do not accidentally trigger it.

### Setting priority

```yaml
routing:
  priority: high    # high | normal | low
```

When two skills both match a prompt with similar confidence, `priority` breaks the tie. Use `high` sparingly — it should reflect genuinely dominant ownership of a domain, not a desire to capture more prompts. `forge-dev` uses `high` because it owns all code modification work.

---

## 4. Level 1: Custom Pipeline

Add a pipeline definition to change the execution steps for your skill.

### Creating `templates/pipeline.json`

Place a pipeline definition at `~/.claude/skills/my-skill/templates/pipeline.json`:

```json
{
  "name": "my-skill-pipeline",
  "steps": [
    { "name": "init",       "actor": "pm",    "gate": null,                "produces": ["meta.json"] },
    { "name": "research",   "actor": "agent", "gate": "meta.json",         "produces": ["research.md"] },
    { "name": "execute",    "actor": "agent", "gate": "research.md",       "produces": ["output/"] },
    { "name": "finalize",   "actor": "pm",    "gate": "execute:done",      "produces": ["report.md"] }
  ]
}
```

Then declare it in your manifest:

```yaml
framework:
  pipeline: my-skill-pipeline
```

### Defining steps with gates and produces

Each step has four fields:

| Field | Purpose |
|---|---|
| `name` | Step identifier, used in engine commands |
| `actor` | `"pm"` (Claude directly) or `"agent"` (dispatched subagent) |
| `gate` | Artifact or condition that must exist before this step runs |
| `produces` | Artifacts this step must create (engine validates after completion) |

Gates are the pipeline's integrity mechanism. The engine will refuse to transition to a step whose gate condition is not satisfied. This prevents the common failure mode of executing code before a plan exists.

### Using framework-provided steps

You do not have to define every step from scratch. The framework provides reusable step implementations for:

- `init` — creates `meta.json` and `workspace-context.json`
- `checkpoint` — pauses for user approval before code changes
- `finalize` — writes `report.md`, runs git finalize, cleans up locks

Reference them by name in your pipeline definition and they execute their built-in logic automatically.

### Inheriting from existing pipelines

To extend an existing pipeline instead of defining one from scratch:

```yaml
framework:
  pipeline: forge-dev-standard   # inherit the standard pipeline
```

This gives your skill the full `research → plan → execute → verify → finalize` flow with all its gates, using your skill's manifest to override routing and workspace scope on top.

---

## 5. Level 2: Workspace Scoping

Declare which files your skill is allowed to read or write. Gate Guard (`core/gate-guard.js`) enforces this at the `PreToolUse` hook — any file access outside the declared scope is hard-blocked before the tool even runs.

### scope, readonly, ignore arrays

```yaml
framework:
  workspace:
    scope:
      - "src/"
      - "tests/"
      - "package.json"
    readonly:
      - "docs/"
      - "CHANGELOG.md"
    ignore:
      - "src/generated/"
      - "*.lock"
```

Priority order (highest to lowest): `ignore` > `readonly` > `scope` > out-of-scope.

- `scope` — files the skill can read and write
- `readonly` — files the skill can read but not write
- `ignore` — files the skill cannot touch at all (not read, not written)

The framework always adds these defaults to `ignore` regardless of your declaration:

```
node_modules/**
.git/**
dist/**
.forge/**
```

### How Gate Guard enforces scope

Gate Guard runs on every `Edit`, `Write`, and `Bash` tool call. It loads `workspace-context.json` from the current pipeline artifact directory and calls `classifyFile(absFilePath, context)`, which returns one of:

- `"scope"` — allowed, pipeline gates apply
- `"readonly"` — reads allowed, writes blocked (exit 2)
- `"ignore"` — all access blocked (exit 2)
- `"out-of-scope"` — blocked if an active context exists (exit 2)

If there is no active pipeline context, Gate Guard falls back to a conservative `isCodeFile` check. Any code modification without an active pipeline is blocked.

### Workspace Context API

The framework provides these functions in `core/workspace-context.js`:

| Function | Purpose |
|---|---|
| `createContext(root, stackProfile, artifactDir)` | Creates `workspace-context.json` during `engine-init` |
| `loadContext(artifactDir, cwd)` | Reads workspace context for an active pipeline |
| `classifyFile(absFilePath, context)` | Returns `"scope"`, `"readonly"`, `"ignore"`, `"external"`, or `"out-of-scope"` |
| `expandScope(artifactDir, cwd, pattern, reason, step)` | Appends to `scope_expansions` at runtime |

You typically don't call these directly — the pipeline engine and Gate Guard use them internally. But they're useful for debugging:

```bash
# Expand scope at runtime (e.g., skill needs to create migration files)
node core/pipeline-engine.js engine-expand-scope .forge/2026-03-21/my-session "migrations/**" "new migration needed" "execute"
```

### Auto-scope from detect-stack

You can skip manual scope declaration and let the engine detect it:

```yaml
framework:
  workspace:
    auto_scope: true
```

`engine-init` calls `detect-stack` internally, which maps known project layouts to default scopes:

| Stack | Auto-scope |
|---|---|
| Express | `src/routes/`, `src/middleware/`, `tests/` |
| React | `src/pages/`, `src/components/`, `tests/` |
| Flask | `app/`, `tests/`, `migrations/` |
| Go | `cmd/`, `internal/`, `pkg/`, `*_test.go` |

Auto-scope is a reasonable default. Override specific paths when your project layout deviates from convention.

---

## 6. Level 3: Quality Checks

The quality system runs verification layers after execution and before finalization. A failed quality check blocks the `finalize` step.

### Inheriting quality layers

Set `inherit: true` to get the framework's default quality layers (build verification, test verification, lint):

```yaml
framework:
  quality:
    inherit: true
```

This is the recommended default. It ensures your skill does not bypass the quality gates that `forge-dev` enforces.

### Adding custom verification layers

Add layers on top of the inherited set:

```yaml
framework:
  quality:
    inherit: true
    add_layers:
      - { name: "security-scan", after: "build" }
      - { name: "schema-validate", after: "test" }
```

Each layer runs in order after the step named in `after`. The engine calls `engine-verify-build` or `engine-verify-tests` with the command specified in the layer definition; the result is recorded in `pipeline-state.json`.

### Build/test verification

The engine provides two verification commands you call explicitly in your pipeline's `verify` step:

```bash
node "$FORGE_ENGINE" engine-verify-build <artifact_dir> "npm run build"
node "$FORGE_ENGINE" engine-verify-tests <artifact_dir> "npm test"
```

Both return `{ "passed": true }` or `{ "passed": false, "reason": "..." }`. A `false` result prevents the engine from transitioning to `finalize` (Gate 3: hard block on commit with failed build/test).

---

## 7. Level 4: Agent Prompts

A fully autonomous skill dispatches specialized subagents for each pipeline step. The pipeline engine manages spawning and coordination; your skill provides the agent prompt files.

### Creating agent prompt files

Place agent prompts under `agents/` in your skill directory:

```
~/.claude/skills/my-skill/
  agents/
    researcher.md     ← prompt for the research step
    executor.md       ← prompt for the execute step
    verifier.md       ← prompt for the verify step
```

The engine loads the right prompt file based on the `actor` role declared in your pipeline step. The agent receives the prompt plus injected context (workspace-context.json, pipeline-state.json, previous step artifacts).

### Model routing (haiku / sonnet / opus)

Declare the model profile per step to control cost vs. quality:

```yaml
framework:
  model_routing:
    research: haiku       # fast, cheap — scanning and summarizing
    plan:     sonnet      # balanced — planning and structuring
    execute:  sonnet      # balanced — code generation
    verify:   sonnet      # balanced — checking correctness
```

Or use the global `--model` flag at invocation time:

```
/forge implement JWT auth --model quality   # forces opus for all steps
/forge fix typo --model budget              # forces haiku for all steps
```

The model flag maps to: `budget` = Haiku, `balanced` = Sonnet (default), `quality` = Opus.

### Agent dispatch via pipeline engine

The PM (Claude in the top-level turn) drives dispatch:

```bash
# Get next step and what to load
node "$FORGE_ENGINE" engine-transition <artifact_dir> research

# Get the agent spec for that step
node "$FORGE_ENGINE" engine-dispatch-spec <artifact_dir> researcher

# ... dispatch the agent, agent runs, produces research.md ...

# Record the result
node "$FORGE_ENGINE" engine-record-result <artifact_dir> researcher task-001 PASS
```

Every command returns JSON. Read it. Follow it. Do not guess what step comes next — the engine knows the gate dependencies, and guessing will trigger Gate Guard blocks.

---

## 8. Skill Manifest Reference

Complete YAML schema with all supported fields:

```yaml
---
# Required
name: my-skill                      # unique identifier, kebab-case
description: |                      # used by Gatekeeper for routing — be specific
  One or two sentences describing exactly what this skill does.
  Mention key nouns and verbs the user would say when they want this skill.

# Routing (all fields optional except triggers)
routing:
  triggers:                         # keywords/phrases that activate this skill
    - keyword1
    - "multi word phrase"
  anti-triggers:                    # phrases that should NOT activate this skill
    - "just explain"
    - "what is"
  modes:                            # named sub-modes with descriptions
    standard: "Full pipeline"
    quick: "Lightweight version"
  priority: normal                  # high | normal | low (default: normal)
  categories:                       # intent categories: code-modify, docs, analysis, command
    - code-modify

# Framework integration (all fields optional)
framework:
  pipeline: pipeline-name           # pipeline definition to use (default: forge-dev-standard)
  gates:                            # additional gate names to enforce
    - build-pass
    - test-pass
  workspace:
    scope:                          # paths the skill can read and write
      - "src/"
      - "tests/"
    readonly:                       # paths the skill can read but not write
      - "docs/"
    ignore:                         # paths the skill cannot touch
      - "src/generated/"
    auto_scope: false               # set true to use detect-stack auto-scope
  quality:
    inherit: true                   # inherit framework default quality layers
    add_layers:                     # append custom verification layers
      - { name: "security-scan", after: "build" }
  model_routing:                    # per-step model overrides
    research: haiku
    execute: sonnet
---

Skill instructions body — this is what Claude reads when the skill is active.
Write clear, imperative instructions. Reference the pipeline steps. Tell Claude
what artifacts to produce and what quality bar to meet.
```

---

## 9. Best Practices

**Keep descriptions specific and keyword-rich.**
The Gatekeeper matches on the `description` field first. A vague description like "does various code tasks" loses to a specific one like "implements features, fixes bugs, refactors code." Include the exact verbs and nouns users say.

**Write triggers in both English and the languages your users write in.**
The Gatekeeper handles multilingual prompts. If your users write in Korean, add Korean triggers alongside English ones:

```yaml
triggers:
  - deploy
  - 배포
  - release
  - 릴리즈
```

**Use anti-triggers for adjacent domains.**
If two skills share vocabulary (e.g., a `deploy` skill and a `docs-writer` skill both match "deployment"), add anti-triggers on each to carve out the boundary cleanly. Anti-triggers are cheaper than tuning confidence thresholds.

**Prefer convention over configuration.**
A skill at `skills/security-audit/SKILL.md` with `name: security-audit` is auto-discovered with zero configuration. Only add `framework.pipeline` when the default `forge-dev-standard` pipeline genuinely does not fit your skill's workflow. Every custom configuration field is a maintenance burden.

**Start at Level 0, promote to higher levels only when needed.**
Add workspace scoping when you know the skill will operate outside the project root. Add quality layers when the domain has specific verification requirements (e.g., a database migration skill should verify schema integrity). Do not add fields speculatively.

**Test with varied prompt styles.**
The Gatekeeper sees natural language, not structured commands. Test your skill with short prompts ("fix the deploy script"), long prompts, typos, and mixed languages. If it fails to route in any of these cases, strengthen the description or add triggers.

**Validate with `engine-state` before production use.**

```bash
node "$FORGE_ENGINE" engine-state <artifact_dir>
```

This prints the current pipeline state as JSON, showing which steps have run, which artifacts exist, and what the engine expects next. Use it to verify your pipeline definition behaves as intended before deploying the skill to others.

---

## 10. Troubleshooting

### Skill not triggering

The Gatekeeper did not route to your skill.

1. Check that `SKILL.md` is in a subdirectory of `skills/` (not directly in `skills/`).
2. Check that `name` and `description` are both present in the front-matter.
3. Make the description more specific — generic descriptions lose to specific ones.
4. Add more triggers, including synonyms and phrases users actually type.
5. Check `core/gatekeeper-init.js` output at session start — it logs the skill catalog it built. A skill missing from the catalog was not discovered.

### Gate Guard blocking file access

```
Gate Guard: BLOCKED — file out of scope: src/config/secrets.js
```

1. Add the file or its parent directory to `framework.workspace.scope`.
2. If the file should be read but not written, add it to `readonly` instead.
3. If the block is on a file you did not intend to touch, the agent prompt is too permissive — tighten the instructions.
4. Run `engine-state` to confirm the workspace-context.json was written correctly.

### Pipeline stuck — step not advancing

```
{"allowed": false, "reason": "Missing required artifacts: research.md"}
```

The engine refused to transition because a gate artifact is missing.

1. Run `engine-state <artifact_dir>` to see which artifacts exist.
2. Check that the previous step's agent actually wrote the expected artifact to the artifact directory.
3. Check `produces` in your pipeline definition — the filename must match exactly (case-sensitive).
4. If resuming an interrupted run, use `/forge --resume` to let the engine reconcile state.

### Quality gate failing on finalize

Gate 3 (commit with failed build) or Gate 4 (report without verification) is blocking.

1. Run `engine-verify-build` and `engine-verify-tests` manually to see the error output.
2. Fix the underlying build or test failure before attempting finalize.
3. Do not set `inherit: false` on quality to work around this — fix the root cause.

### Two skills both triggering (routing conflict)

1. Add anti-triggers to the skill that should **not** win.
2. Set `priority: high` on the skill that should **always** win in this domain.
3. If the overlap is fundamental (two skills genuinely do the same thing), merge them into one skill with `modes`.
