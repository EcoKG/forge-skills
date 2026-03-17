---
name: forge
description: |
  Context-Engineered Autonomous Development System.
  Single /forge command for feature implementation, bug fixes, refactoring, analysis, infrastructure, and design tasks.
  Research + plan + execute + verify pipeline with file-based agent communication and goal-backward verification.

  ALWAYS: feature impl (implement, build, add feature), bug fixes (bug, crash, broken, fix this), refactoring (refactor, clean up, SOLID), perf/code analysis (profiling, optimize, analyze), security (audit, OWASP), architecture (schema, API, design), CI/CD Docker deploy (pipeline, infrastructure), env setup (configure), migrations (upgrade), multi-file ripple effects, /forge

  DO NOT (overrides above): trivial single-line edits (typo, rename one variable, one import), code explanation only, simple commands (git log, npm install), new standalone files from scratch (no integration needed)
---

# Forge v6.0 "Ironclad"

> Code-enforced autonomous development engine.
> Pipeline defined in `pipeline.json`. State managed by `forge-tools.js`. Gates enforced by hooks.
> **You don't memorize the pipeline — you call the engine and follow its instructions.**

---

## 1. How Forge Works (v6.0)

Forge v6.0 is ENGINE-DRIVEN, not prompt-driven.

```
User: /forge "implement JWT auth"
  │
  ▼
PM calls: forge-tools.js init → creates pipeline-state.json
  │
  ▼
HOOK (every turn): injects current step + allowed actions
  │
  ▼
PM calls: forge-tools.js dispatch-spec → gets agent spec
PM calls: Agent tool with spec → agent runs
PM calls: forge-tools.js record-result → records outcome
  │
  ▼
PM calls: forge-tools.js can-transition → checks if gate passes
PM calls: forge-tools.js transition → moves to next step
  │
  ▼
GATE GUARD (PreToolUse): blocks if pipeline state is violated
  │
  ▼
... repeat until completed ...
```

**You NEVER skip steps manually.** The engine decides what's allowed. The gate guard BLOCKS violations.

---

## 2. Command Interface

```
/forge [request] [options]
```

| Flag | Values | Default | Description |
|---|---|---|---|
| `--type` | code, code-bug, code-refactor, docs, analysis, analysis-security, infra, design | auto | Request type |
| `--scale` | small, medium, large | auto | Override scale |
| `--model` | quality, balanced, budget | balanced | Model profile |
| `--direct` | flag | off | Skip research + plan-check |
| `--quick` | flag | off | 3-step: plan → execute → finalize |
| `--skip-tests` | flag | off | Skip test execution |
| `--resume` | flag | off | Resume interrupted execution |
| `--ralph` | flag | off | Ralph Mode: iterate until tests pass |
| `--disclosure` | novice, standard, advanced | standard | Output verbosity |
| `--init` | flag | off | Project initialization |
| `--phase` | integer | - | Execute project phase N |
| `--autonomous` | flag | off | Auto-chain all remaining phases |
| `--milestone` | integer | - | Verify milestone |
| `--status` | flag | off | Project dashboard |
| `--discuss` | integer | - | Capture phase decisions |
| `--debug` | flag | off | Scientific debug pipeline |
| `--map` | flag | off | Codebase mapping |

---

## 3. Engine Commands (the core of v6.0)

**ALL pipeline logic is in forge-tools.js.** Call via Bash tool:

```bash
# Pipeline lifecycle
node hooks/forge-tools.js engine-init <artifact_dir> <request> <type> <scale> [options_json]
node hooks/forge-tools.js engine-state <artifact_dir>
node hooks/forge-tools.js engine-can-transition <artifact_dir> <target_step>
node hooks/forge-tools.js engine-transition <artifact_dir> <target_step>

# Agent management
node hooks/forge-tools.js engine-dispatch-spec <artifact_dir> <role> [task_id]
node hooks/forge-tools.js engine-record-result <artifact_dir> <role> <task_id> <verdict>
node hooks/forge-tools.js engine-record-revision <artifact_dir> <type>

# Verification
node hooks/forge-tools.js engine-verify-build <artifact_dir> <build_command>
node hooks/forge-tools.js engine-verify-tests <artifact_dir> <test_command>
node hooks/forge-tools.js engine-reconcile <artifact_dir>

# Existing tools (unchanged)
node hooks/forge-tools.js detect-stack
node hooks/forge-tools.js git-state
node hooks/forge-tools.js create-lock <dir>
node hooks/forge-tools.js remove-lock <dir>
```

### Engine Response Format

Every engine command returns JSON:
```json
{"allowed": true, "target": "plan", "loads": ["templates/plan.md"], "agent_role": "planner"}
```
Or on failure:
```json
{"allowed": false, "reason": "Missing required artifacts: research.md"}
```

**Read the JSON. Follow its instructions. Don't guess.**

---

## 4. Standard Execution Flow

### Step 1: INIT
```
1. Parse user request → detect type, scale, language
2. Create artifact directory: .forge/{date}/{slug}-{HHMM}/
3. Call: engine-init <dir> <request> <type> <scale>
4. Engine creates pipeline-state.json + meta.json
5. Display start banner
```

### Steps 2-10: Engine-Driven Loop
```
for each step in pipeline:
    1. Call: engine-can-transition <dir> <next_step>
       → if allowed: proceed
       → if not: engine tells you what's missing

    2. Call: engine-transition <dir> <next_step>
       → engine updates state, returns what to load

    3. If step has agent:
       Call: engine-dispatch-spec <dir> <role> [task_id]
       → returns: prompt_path, model, files, output_path
       → Dispatch Agent with the spec
       → Call: engine-record-result <dir> <role> <task_id> <verdict>

    4. If step is PM-driven (checkpoint, finalize):
       Do the work directly

    5. Repeat until engine says "completed"
```

### Key Rules
- **Never write pipeline-state.json directly** — only engine writes it
- **Never skip a step** — engine-can-transition will reject it
- **Gate guard will hard-block** if you try to violate (exit code 1)
- **Always call engine-record-result** after agent dispatch

---

## 5. Pipeline Definition

Pipeline is defined in `templates/pipeline.json` (machine-readable, declarative).

### Standard Pipeline Steps
| # | Step | Actor | Gate | Produces |
|---|---|---|---|---|
| 1 | init | PM | — | meta.json |
| 2 | research | agent (researcher) | meta.json exists | research.md |
| 3 | plan | agent (planner) | research.md exists | plan.md |
| 4 | plan_check | agent (plan-checker) | plan.md exists | plan.md (verified) |
| 5 | checkpoint | PM | plan_check PASS | user approval |
| 6 | branch | PM | approved | git branch |
| 7 | execute | agent (implementer + reviewer + QA + VPM) | plan.md exists | code + summaries + vpm-wave-{N}.md |
| 8 | verify | agent (verification-pm, final_verify mode) | execution done | verification.md |
| 9 | finalize | PM | verified | report.md |
| 10 | cleanup | PM | finalized | completed |

### Variants
- **quick**: init → plan → execute → finalize (no research, plan-check, verify)
- **debug**: reproduce → hypothesize → test → fix → verify_fix
- **ralph**: init → iterate (loop until completion promise passes)

---

## 6. Code Enforcement (6 Gates)

`hooks/forge-gate-guard.js` (PreToolUse) enforces:

| Gate | What It Blocks | How |
|---|---|---|
| **Gate 1** | plan.md Write without research.md | exit(1) — hard block |
| **Gate 2** | Source code Edit/Write before plan_check PASS | exit(1) — hard block |
| **Gate 3** | git commit with failed build/test | exit(1) — hard block |
| **Gate 4** | report.md Write without verification.md | exit(1) — hard block |
| **Gate 5** | Large edits (>500 chars) or overwrites (>100 lines) | warning (non-blocking) |
| **Gate 6** | Secret/credential detection in code content | exit(1) — hard block |

**Gates 1-4 and 6 are hard blocks. You cannot bypass them. Gate 5 is a warning only.**

---

## 7. Hooks (Auto-Running)

| Hook | Trigger | What It Does |
|---|---|---|
| **forge-orchestrator** | UserPromptSubmit | Injects pipeline state every turn |
| **forge-gate-guard** | PreToolUse | 6 gates (5 hard blocks + 1 warning) |
| **forge-tracker** | PostToolUse | Trace logging + build/test detection |
| **forge-statusline** | Notification | IDE status display |

---

## 8. Agents (17 + custom)

| # | Role | Prompt | When |
|---|---|---|---|
| 1 | researcher | prompts/researcher.md | Step 2 |
| 2 | planner | prompts/planner.md | Step 3 |
| 3 | plan-checker | prompts/plan-checker.md | Step 4 |
| 4 | implementer | prompts/implementer.md | Step 7 |
| 5 | code-reviewer | prompts/code-reviewer.md | Step 7 |
| 6 | qa-inspector | prompts/qa-inspector.md | Step 7 (wave boundary) |
| 7 | verifier | prompts/verifier.md | Step 8 (legacy, replaced by VPM) |
| 7.5 | verification-pm | prompts/verification-pm.md | Step 7 (wave boundary) + Step 8 (final verify) |
| 8 | doc-reviewer | prompts/doc-reviewer.md | Step 7 (docs type) |
| 9 | roadmapper | prompts/roadmapper.md | --init |
| 10 | integration-checker | prompts/integration-checker.md | --milestone |
| 11 | debugger | prompts/debugger.md | --debug |
| 12 | test-auditor | prompts/test-auditor.md | Step 4 (after plan-check) |
| 13 | ralph-executor | prompts/ralph-executor.md | --ralph |
| 14 | ui-reviewer | prompts/ui-reviewer.md | Step 7 (UI files) |
| 15 | test-strategist | prompts/test-strategist.md | Step 4 |
| 16 | custom:{name} | .forge/agents/{name}.md | Per pipeline.json |

**Get dispatch spec from engine:** `engine-dispatch-spec <dir> <role> [task_id]`

---

## 9. Context Engineering (Unchanged)

- **PM budget: ≤15%** of context window
- **File-based communication**: PM sends paths, agents read files
- **Fresh context**: each agent gets clean 200k window
- **State on disk**: pipeline-state.json is the source of truth

Detailed rules: `references/context-engineering.md` (load only when needed)

---

## 10. Quality System (7-Layer, Code-Enforced)

| Layer | Type | What |
|---|---|---|
| L1 Deep Work | Prompt | 8-dimension plan verification |
| L2 Self-Check | Prompt | Implementer 6-item checklist + stuck detection |
| L3 Peer Review | Prompt | 11-perspective code review |
| L3.5 Backpressure | **Code** | Build/test MUST pass (engine-verify-build/tests) |
| L4 QA Gate | Prompt | Wave boundary inspection |
| L4.5 VPM Cross-Check | Prompt | Independent verification at wave boundary + final verify (goal-backward) |
| L5 Goal-Backward | Prompt + **Code** | verifyArtifacts() + verifyKeyLinks() |
| L6 Auto-Ralph | **Code** | Auto-enter Ralph on verify failure |
| **L7 Gate Guard** | **Code** | 6 gates — 5 hard blocks + 1 warning (PreToolUse) |

---

## 11. Artifact Structure

```
.forge/
  {YYYY-MM-DD}/{slug}-{HHMM}/
    pipeline-state.json    # ENGINE-MANAGED (source of truth)
    meta.json              # Execution metadata
    execution-lock.json    # Crash recovery lock
    research.md, plan.md, verification.md, report.md
    task-{N-M}-summary.md, qa-report.md, trace.jsonl
  memory/
    patterns.json, failures.json, decisions.json
  metrics.json

~/.forge/knowledge/{stack}/
    conventions.md, pitfalls.md
```

---

## 12. Quick Reference: "What Do I Do?"

**Starting a forge execution:**
```
1. Parse request, detect type/scale
2. mkdir .forge/{date}/{slug}
3. Bash: forge-tools.js engine-init {dir} {request} {type} {scale}
4. Show banner
5. Bash: forge-tools.js engine-transition {dir} research
6. Read what engine returns → dispatch agent → record result
7. Repeat: engine-can-transition → engine-transition → dispatch → record
8. Until engine says "completed"
```

**When in doubt:** `forge-tools.js engine-state {dir}` — tells you exactly where you are and what to do next.
