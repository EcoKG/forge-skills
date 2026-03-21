---
name: forge
description: |
  Forge Framework v8.0 "Nova" — Skill Execution Framework for Claude Code.
  Universal skill router with Haiku Gatekeeper, workspace sandboxing, pipeline engine, and quality gates.

  ALWAYS use this skill for: feature implementation, bug fixes, refactoring, code analysis, security audits,
  architecture design, CI/CD, infrastructure, deployments, migrations, and any multi-file code changes.

  Also handles: skill routing for any installed skill, workspace scope management, code modification control.

  DO NOT use for: simple code explanations (read-only), git/npm commands, greetings, brainstorming.
---

# Forge Framework v8.0 "Nova"

> Skill Execution Framework for Claude Code.
> Gatekeeper classifies intent → routes to skill → pipeline engine executes → quality gates enforce.
> **You don't manage the pipeline — the engine manages it. You follow its instructions.**

---

## 1. How Forge Framework Works

```
User: /forge "implement JWT auth"
  │
  ▼
Gatekeeper (Haiku subagent)
  → classifies intent: code-modify
  → routes to skill: forge-dev
  → emits config: { mode: "standard", type: "code", scale: "medium" }
  │
  ▼
Skill: forge-dev activated
  → engine-init → creates workspace-context.json + pipeline-state.json
  │
  ▼
Pipeline Engine (pipeline-engine.js)
  → step-by-step execution with gate validation
  → agent dispatch → result recording → transition
  │
  ▼
Gate Guard (PreToolUse hook)
  → 9 gates enforced — 7 hard blocks (exit 2) + 2 warnings
  → workspace-context.json defines allowed file scope
  │
  ▼
... pipeline runs to completion → report.md + git finalize
```

**Architecture shift from v7.0:**
- v7.0: forge = a single skill with its own hooks
- v8.0: Forge Framework = the platform on which skills run

---

## 2. Command Interface

```
/forge [request] [options]
```

| Flag | Values | Description |
|---|---|---|
| `--type` | code, code-bug, code-refactor, docs, analysis, analysis-security, infra, design | Request type (auto-detected) |
| `--scale` | small, medium, large | Override scale (auto-detected) |
| `--model` | quality, balanced, budget | Model profile (default: balanced) |
| `--mode` | standard, quick, trivial, analyze, debug, ralph | Pipeline mode (auto-detected) |
| `--skip-tests` | flag | Skip test execution |
| `--resume` | flag | Resume interrupted execution |
| `--init` | flag | Project initialization |
| `--phase` / `--autonomous` | integer / flag | Execute phase N / auto-chain all phases |
| `--milestone` | integer | Verify milestone |
| `--status` | flag | Project dashboard |
| `--disclosure` | novice, standard, advanced | Output verbosity (default: standard) |

**Scale auto-detection:** small = 1 file ≤50 LOC; medium = 2–5 files ≤300 LOC; large = 6+ files or new APIs/schemas.

---

## 3. Gatekeeper — Intent Classification

The Gatekeeper is a Haiku subagent that runs on every user turn.

**Classification categories:**

| Category | Route | Example |
|---|---|---|
| code-modify | skill routing | "add caching" |
| discuss | PASS | "what do you think of this structure?" |
| question | PASS | "what does this function do?" |
| command | PASS | "git log" |
| skill-task | explicit skill | "/forge implement JWT" |
| meta | PASS | "hello", "/clear" |

**Routing output:** `{ "category": "code-modify", "skill": "forge-dev", "confidence": 0.92, "config": { "mode": "standard", "type": "code", "scale": "medium" } }`

**Defense:** L1 (Soft) Gatekeeper → routing suggestion, fail-open. L2 (Hard) Gate Guard → exit(2), fail-closed. Gatekeeper is an optimization, not a security boundary.

**Session lifecycle:** SessionStart → build skill catalog → init state. First turn: Hook injects "spawn Gatekeeper" → Claude spawns Agent(haiku) → saves agentId. Subsequent turns: Hook injects "resume via SendMessage" → receives classification → acts. Failure → Gate Guard fallback.

---

## 4. Workspace Context — Scope Sandboxing

Defines file access scope per pipeline execution (`workspace-context.json`): `scope`, `readonly`, `ignore`, `external_write`. Priority: ignore > readonly > scope > out-of-scope.

Gate Guard uses context: in-scope files get pipeline gates, out-of-scope files are ignored, readonly files block writes, no active context falls back to v7.0 `isCodeFile` logic.

Auto-scope via `detect-stack`: Express → src/routes/middleware/tests, React → src/pages/components/tests, Flask → app/tests/migrations, Go → cmd/internal/pkg/*_test.go.

---

## 5. Core Modules

| File | Role |
|---|---|
| `core/gatekeeper-init.js` | SessionStart: build skill catalog, init state |
| `core/gatekeeper-router.js` | UserPromptSubmit: inject routing instructions |
| `core/gate-guard.js` | PreToolUse: 9 gates, hard-block violations |
| `core/workspace-context.js` | Scope sandboxing API |
| `core/pipeline-engine.js` | Universal pipeline execution (former forge-tools.js) |
| `core/orchestrator.js` | Inject pipeline state every turn |
| `core/tracker.js` | Trace logging, build/test detection |

---

## 6. Engine Commands

**ALL pipeline logic is in `pipeline-engine.js`.** Set this variable at the start of every session:

```bash
FORGE_ENGINE="$HOME/.claude/skills/forge-framework/core/pipeline-engine.js"
```

```bash
# Pipeline lifecycle
node "$FORGE_ENGINE" engine-init <artifact_dir> <request> <type> <scale> [options_json]
node "$FORGE_ENGINE" engine-state <artifact_dir>
node "$FORGE_ENGINE" engine-transition <artifact_dir> <target_step>

# Agent management
node "$FORGE_ENGINE" engine-dispatch-spec <artifact_dir> <role> [task_id]
node "$FORGE_ENGINE" engine-record-result <artifact_dir> <role> <task_id> <verdict>
node "$FORGE_ENGINE" engine-record-revision <artifact_dir> <type>

# Verification
node "$FORGE_ENGINE" engine-verify-build <artifact_dir> <build_command>
node "$FORGE_ENGINE" engine-verify-tests <artifact_dir> <test_command>
node "$FORGE_ENGINE" engine-reconcile <artifact_dir>

# Utilities: detect-stack, git-state, create-lock, remove-lock, check-lock,
#            engine-wave-info, engine-branch, engine-finalize-git
```

**Every command returns JSON:**
```json
{"allowed": true, "target": "plan", "loads": ["templates/plan.md"], "agent_role": "planner"}
```
Or on failure:
```json
{"allowed": false, "reason": "Missing required artifacts: research.md"}
```

**Read the JSON. Follow its instructions. Don't guess.**

---

## 7. Gate Guard — 9 Gates

`core/gate-guard.js` (PreToolUse). Hard blocks (exit 2): Gate 1 plan.md without research.md, Gate 2/2B code edit before execute step, Gate 3 commit with failed build/test, Gate 4 report.md without verification.md, Gate 5T trivial pipeline oversize, Gate 6 secret detection, Gate 7 push without VPM. Warnings: Gate 5 large edits, Gate 8 commit on protected branch.

**7 hard blocks + 2 warnings. No active pipeline = all code edits blocked.**

---

## 8. Skill API — Framework Contract

Any skill installed under `skills/` gets Gatekeeper routing + Gate Guard protection automatically.

**Minimum skill definition:**
```yaml
---
name: my-skill
description: "what this skill does"
routing:
  triggers: ["deploy", "release", "rollback"]
---
Skill instructions...
```

**Progressive complexity:**
```
Level 0: name + description + routing.triggers     → routing only
Level 1: + framework.pipeline                      → custom pipeline
Level 2: + framework.workspace                     → file scope control
Level 3: + framework.gates + framework.quality     → custom quality gates
Level 4: + agent prompts + templates               → fully autonomous skill
```

Skills cannot disable existing quality layers — only add to them (security principle).

Full manifest schema: see `architecture.md` §3.2.

---

## 9. Installed Skills

| Skill | Path | Purpose |
|---|---|---|
| **forge-dev** | `skills/forge-dev/SKILL.md` | Autonomous development pipeline (code, bugs, refactoring, analysis) |

For the full forge-dev pipeline documentation — research → plan → execute → verify workflow,
17+ agents, 7-layer quality system, and artifact structure — see:

**`skills/forge-dev/SKILL.md`**

---

## 10. Hooks (Auto-Running)

| Hook | Trigger | Role |
|---|---|---|
| `gatekeeper-init.js` | SessionStart | Build skill catalog, init state |
| `gatekeeper-router.js` | UserPromptSubmit | Inject routing instructions |
| `gate-guard.js` | PreToolUse | 9 gates enforcement |
| `orchestrator.js` | UserPromptSubmit | Inject pipeline state |
| `tracker.js` | PostToolUse | Trace logging |

---

## 11. Design Principles

1. **Declaration-Decision-Execution**: Skill declares "what" → Gatekeeper decides "when" → Engine executes
2. **User intent first**: User config overrides framework defaults
3. **Protocol immutability**: Core contracts preserved across versions
4. **Optimization ≠ security boundary**: Gatekeeper removal preserves safety (Gate Guard protects)
5. **Progressive complexity**: 5-line skill → production skill via natural extension
