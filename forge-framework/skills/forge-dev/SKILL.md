---
name: forge-dev
description: |
  Autonomous development pipeline for code implementation, bug fixes, refactoring, and analysis.
  Part of the Forge Framework. Uses research → plan → execute → verify pipeline with quality gates.
routing:
  triggers:
    - implement, build, add feature, create
    - bug, crash, broken, fix this, error
    - refactor, clean up, SOLID
    - analyze, profile, optimize
    - audit, OWASP, security
    - architecture, schema, API design
    - deploy, Docker, CI/CD, pipeline
  anti-triggers:
    - code explanation only
    - simple git/npm commands
  modes:
    standard: "Full pipeline with research, planning, and verification"
    quick: "Lightweight: plan → execute → verify (single file, ≤50 LOC)"
    trivial: "Minimal: init → execute (1-line fix, no plan/verify)"
    analyze: "Read-only analysis (no code changes)"
    debug: "Scientific debug pipeline (reproduce → hypothesize → test → fix)"
    ralph: "Iterate until tests pass"
  priority: high
  categories:
    - code-modify
---

# forge-dev — Autonomous Development Pipeline

> Part of the Forge Framework v8.0 "Nova".
> Engine-driven pipeline: research → plan → execute → verify → finalize.
> **You don't memorize the pipeline — you call the engine and follow its instructions.**

---

## 1. Pipeline Overview

forge-dev is ENGINE-DRIVEN, not prompt-driven.

```
User request (routed by Gatekeeper)
  │
  ▼
PM calls: engine-init → creates workspace-context.json + pipeline-state.json
  │
  ▼
Framework orchestrator: injects pipeline state every turn
  │
  ▼
PM calls: engine-transition → gets next step + what to load
PM calls: engine-dispatch-spec → gets agent spec
PM dispatches: Agent with spec → agent runs → produces artifact
PM calls: engine-record-result → records outcome
  │
  ▼
Gate Guard (PreToolUse): blocks violations before they happen
  │
  ▼
... repeat until engine says "completed" ...
```

**You NEVER skip steps manually.** The engine decides what's allowed.

---

## 2. Pipeline Modes

| Mode | Flag | Steps | When to Use |
|---|---|---|---|
| **standard** | (default) | research → plan → plan_check → checkpoint → branch → execute → verify → finalize | Multi-file changes, unclear scope, any risk |
| **quick** | `--mode quick` | plan → execute → verify → finalize | Single file, ≤50 LOC, unambiguous request |
| **trivial** | `--mode trivial` | init → execute → cleanup | 1-line fix, no plan/verify needed |
| **analyze** | `--mode analyze` | init → analyze_search → finalize | Read-only analysis, no code changes |
| **debug** | `--mode debug` | reproduce → hypothesize → test → fix → verify_fix | Bug with unclear root cause |
| **ralph** | `--mode ralph` | init → iterate loop | Iterate until tests pass |

**Quick mode conditions — ALL must be met:**
1. Single-file change (or tightly coupled pair: component + test)
2. Clear scope — no research needed to understand what to do
3. No integration risk — does not affect APIs, schemas, or shared interfaces
4. Small scale — ≤50 lines of code

If ANY condition is NOT met, use standard mode.

---

## 3. Standard Pipeline Steps

| # | Step | Actor | Gate | Produces |
|---|---|---|---|---|
| 1 | init | PM | — | meta.json, workspace-context.json |
| 2 | research | agent (researcher) | meta.json exists | research.md |
| 2.5 | architect_guide | agent (architect) | research.md exists | design-guide.md |
| 3 | plan | agent (planner) | research.md exists | plan.md |
| 4 | plan_check | agent (plan-checker) | plan.md exists | plan.md (verified) |
| 4.5 | test_strategy | agent (test-strategist) | plan_check PASS | test strategy |
| 5 | checkpoint | PM | plan_check PASS | user approval |
| 5.5 | branch | PM (engine-branch) | approved | git checkout -b forge/{slug} |
| 6 | execute | agent (implementer + reviewer + QA + VPM) | plan.md exists | code + summaries + vpm-wave-{N}.md |
| 7 | verify | agent (verification-pm, final_verify mode) | execution done | verification.md |
| 8 | finalize | PM | verified | report.md + git finalize + cleanup |

---

## 4. Engine Commands

**Set FORGE_ENGINE at the start of every session:**

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

# Utilities
node "$FORGE_ENGINE" detect-stack
node "$FORGE_ENGINE" git-state
node "$FORGE_ENGINE" engine-wave-info <artifact_dir>
node "$FORGE_ENGINE" engine-branch <artifact_dir>
node "$FORGE_ENGINE" engine-finalize-git <artifact_dir>
node "$FORGE_ENGINE" create-lock <dir>
node "$FORGE_ENGINE" remove-lock <dir>
node "$FORGE_ENGINE" check-lock <dir>
```

**Every command returns JSON:**
```json
{"allowed": true, "target": "plan", "loads": ["templates/plan.md"], "agent_role": "planner"}
```
Or on failure:
```json
{"allowed": false, "reason": "Missing required artifacts: research.md"}
```

**When in doubt:** `engine-state <dir>` — tells you exactly where you are and what to do next.

---

## 5. Standard Execution Flow

### Step 1: INIT
```
1. Parse request → detect type, scale, language
2. Create artifact directory: .forge/{YYYY-MM-DD}/{slug}-{HHMM}/
3. Call: engine-init <dir> <request> <type> <scale>
4. Engine creates pipeline-state.json + meta.json + workspace-context.json
5. Display start banner
```

### Steps 2–8: Engine-Driven Loop
```
for each step in pipeline:
    1. Call: engine-transition <dir> <next_step>
       → if allowed: engine updates state, returns what to load
       → if not: engine tells you what's missing

    2. If step has agent:
       Call: engine-dispatch-spec <dir> <role> [task_id]
       → returns: prompt_path, model, files, output_path
       → Dispatch Agent with the spec
       → Call: engine-record-result <dir> <role> <task_id> <verdict>

    3. If step is PM-driven (checkpoint, finalize):
       Do the work directly

    4. Repeat until engine says "completed"
```

### Key Rules
- **Never write pipeline-state.json directly** — only the engine writes it
- **Never skip a step** — engine-transition will reject it
- **Gate Guard will hard-block** violations (exit code 2)
- **Always call engine-record-result** after every agent dispatch

---

## 6. Agents (17 + custom)

| # | Role | Prompt | When |
|---|---|---|---|
| 1 | researcher | prompts/researcher.md | Step 2 |
| 2 | planner | prompts/planner.md | Step 3 |
| 3 | plan-checker | prompts/plan-checker.md | Step 4 |
| 4 | implementer | prompts/implementer.md | Step 6 |
| 5 | code-reviewer | prompts/code-reviewer.md | Step 6 |
| 6 | qa-inspector | prompts/qa-inspector.md | Step 6 (wave boundary) |
| 7 | verification-pm | prompts/verification-pm.md | Step 6 (wave boundary) + Step 7 (final verify) |
| 8 | doc-reviewer | prompts/doc-reviewer.md | Step 6 (docs type) |
| 9 | roadmapper | prompts/roadmapper.md | --init |
| 10 | integration-checker | prompts/integration-checker.md | --milestone |
| 11 | debugger | prompts/debugger.md | --debug |
| 12 | test-auditor | prompts/test-auditor.md | Step 4 (after plan-check) |
| 13 | ralph-executor | prompts/ralph-executor.md | --ralph |
| 14 | ui-reviewer | prompts/ui-reviewer.md | Step 6 (UI files) |
| 15 | test-strategist | prompts/test-strategist.md | Step 4.5 |
| 16 | architect | prompts/architect.md | Step 2.5 (guide), Step 6 (design), --init |
| 17 | analyzer | prompts/analyzer.md | --analyze (adaptive search) |
| 18 | custom:{name} | .forge/agents/{name}.md | Per pipeline.json |

**Get dispatch spec from engine:** `engine-dispatch-spec <dir> <role> [task_id]`

**Model routing:**

| Role | Model | Rationale |
|---|---|---|
| Researcher | Sonnet | Balanced exploration |
| Planner / Architect | Opus | Deep design thinking |
| Implementer | Sonnet | Code generation efficiency |
| Reviewer / QA | Sonnet | Analytical capability |
| VPM (Verification) | Opus | Independent verification |

---

## 7. Quality System (7-Layer)

Provided by the framework. forge-dev uses all layers; custom layers can be added.

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
| L7 Gate Guard | **Code** | 9 gates — 7 hard blocks + 2 warnings (PreToolUse) |

Skills cannot disable existing layers — only add to them.

---

## 8. Scale Detection

When `--scale` is not provided, auto-detect from the request:

| Scale | Criteria |
|---|---|
| **small** | 1 file, ≤50 LOC, no new dependencies, no API changes |
| **medium** | 2–5 files, ≤300 LOC, minor interface changes, ≤2 tasks |
| **large** | 6+ files, >300 LOC, new APIs/schemas, cross-cutting concerns, 3+ tasks |

Scale affects:
- **Checkpoint behavior**: small auto-proceeds, medium/large asks user
- **Model selection**: large uses higher-quality models for planning
- **Wave structure**: medium uses 1 wave, large uses 2+ waves

---

## 9. Artifact Structure

```
.forge/
  {YYYY-MM-DD}/{slug}-{HHMM}/
    pipeline-state.json     # ENGINE-MANAGED (source of truth)
    workspace-context.json  # Scope definition (v8.0)
    meta.json               # Execution metadata
    execution-lock.json     # Crash recovery lock
    research.md             # Step 2 output
    design-guide.md         # Step 2.5 output
    plan.md                 # Step 3 output
    verification.md         # Step 7 output
    report.md               # Step 8 output
    task-{N-M}-summary.md   # Per-task implementation summaries
    qa-report.md            # QA inspection report
    vpm-wave-{N}.md         # VPM verification per wave
    trace.jsonl             # Full tool trace log
  memory/
    patterns.json, failures.json, decisions.json
  metrics.json

~/.forge/knowledge/{stack}/
    conventions.md, pitfalls.md
```

---

## 10. Context Engineering

- **PM budget: ≤15%** of context window — PM stays lean, agents do the work
- **File-based communication**: PM sends file paths, agents read files directly
- **Fresh context**: each agent gets a clean 200k window
- **State on disk**: `pipeline-state.json` is the single source of truth

Detailed rules: `references/context-engineering.md` (load only when needed)

---

## 11. Request Type Reference

| Type | Description | Key Agents |
|---|---|---|
| `code` | Feature implementation | researcher, planner, implementer, reviewer |
| `code-bug` | Bug fix | debugger (--debug) or standard pipeline |
| `code-refactor` | Refactoring | planner, implementer, code-reviewer |
| `docs` | Documentation | planner, implementer, doc-reviewer |
| `analysis` | Code/perf analysis | analyzer (--analyze mode) |
| `analysis-security` | Security audit | analyzer, OWASP focus |
| `infra` | CI/CD, Docker, infrastructure | planner, implementer |
| `design` | Architecture, schema, API design | architect, planner |

---

## 12. Quick Reference: Starting a Session

```
1. Parse request → detect type, scale
2. mkdir .forge/{date}/{slug}-{HHMM}
3. node "$FORGE_ENGINE" engine-init {dir} {request} {type} {scale}
4. Display start banner
5. node "$FORGE_ENGINE" engine-transition {dir} research
6. Read what engine returns → dispatch agent → record result
7. Repeat: engine-transition → dispatch → record
8. Until engine says "completed"
```

**When stuck:** `engine-state <dir>` — current step, allowed transitions, missing artifacts.
