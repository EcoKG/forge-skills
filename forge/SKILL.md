---
name: forge
description: |
  Context-Engineered Autonomous Development System.
  Single /forge command for feature implementation, bug fixes, refactoring, analysis, infrastructure, and design tasks.
  Research + plan + execute + verify pipeline with file-based agent communication and goal-backward verification.

  ALWAYS: feature impl (implement, build, add feature), bug fixes (bug, crash, broken, fix this), refactoring (refactor, clean up, SOLID), perf/code analysis (profiling, optimize, analyze), security (audit, OWASP), architecture (schema, API, design), CI/CD Docker deploy (pipeline, infrastructure), env setup (configure), migrations (upgrade), multi-file ripple effects, /forge

  DO NOT (overrides above): trivial single-line edits (typo, rename one variable, one import), code explanation only, simple commands (git log, npm install), new standalone files from scratch (no integration needed)
---

# Forge v3.2

> Context-Engineered Autonomous Development System — v3.2
> v3.2 "Relentless" — Backpressure system, Ralph Mode + all v3.1 GSD features
> Single entry point. File-based agent communication. Goal-backward verification.
> **If context feels incomplete, re-read this SKILL.md to restore the flow.**

---

## 1. Activation Rules

### 1.1 Always Trigger

**Keywords (EN):**
implement, build, add feature, bug, crash, broken, fix this, refactor, clean up, profiling, optimize, analyze, audit, OWASP, schema, API, infrastructure, configure, upgrade, /forge

**Keywords (KO):**
implement, build, add feature, bug, crash, broken, fix this, refactor, clean up, profiling, optimize, analyze, audit, OWASP, schema, API, infrastructure, configure, upgrade, /forge

**Heuristics:**
- Multi-file changes required
- Non-trivial logic changes (more than a single-line edit)
- Security-sensitive modifications
- Ripple effects across modules or systems
- Domain understanding needed before safe modification
- Chesterton's Fence: removal target's purpose is unclear
- Research cost < rework cost

### 1.2 Never Trigger

- Trivial single-line edits (typo, rename one variable, one import, one env var)
- Code explanation only (no modification requested)
- Simple CLI commands (git log, npm install, docker ps)
- New standalone files from scratch with no integration needed

---

## 2. Command Interface

```
/forge [request] [options]
```

| Flag | Values | Default | Description |
|---|---|---|---|
| `--type` | code, code-bug, code-refactor, docs, analysis, analysis-security, infra, design | auto | Request type (auto-detected from keywords) |
| `--direct` | flag | off | Skip research + plan-check, jump to plan then execute |
| `--no-research` | flag | off | Skip research only |
| `--from` | file path | - | Reuse existing research.md or plan.md |
| `--model` | quality, balanced, budget | balanced | Model selection profile |
| `--review` | strict, normal, light | normal | Review intensity |
| `--scale` | small, medium, large | auto | Override auto-detected scale |
| `--exec` | subagent, team | auto | Execution mode (subagent for small, team for large) |
| `--lang` | language code | auto | Language hint for project detection |
| `--cost` | high, medium, low | medium | Cost tier (influences model selection) |
| `--paradigm` | oop, fp, script, ddd, mixed | auto | Design paradigm override |
| `--skip-tests` | flag | off | Skip test generation/execution |
| `--resume` | flag | - | Resume interrupted execution from meta.json |
| `--ralph` | flag | off | Ralph Mode: iterate until completion promise passes |
| `--max-iterations` | integer | 10 | Max Ralph iterations (only with --ralph) |
| `--completion-promise` | string | auto | Custom completion check command (only with --ralph) |
| `--init` | flag | off | Generate/refresh project profile only |
| `--phase`     | integer | -    | Execute specific roadmap phase N                              |
| `--autonomous`| flag    | off  | Chain all remaining phases automatically                      |
| `--milestone` | integer | -    | Verify and archive milestone N (or current if omitted)        |
| `--status`    | flag    | off  | Show project progress dashboard                               |
| `--discuss`   | integer | -    | Capture decisions for phase N before planning                  |
| `--quick`     | flag    | off  | Quick mode: plan(1 task) → execute → commit. Skips research/plan-check/verify. |
| `--debug`    | flag    | off  | Debug mode: scientific method bug diagnosis (5-step pipeline) |
| `--map`      | flag    | off  | Map codebase: parallel analysis → 7 persistent documents |
| `--retrospective` | flag | off | Run retrospective analysis on current/last milestone |

---

## 3. Type Classification

Eight subtypes with detection heuristics:

| Type | Detection Keywords | Core Flow | Agents |
|---|---|---|---|
| **code** | implement, build, add, create, feature | research > plan > execute > review > QA > verify | implementer, code-reviewer, qa-inspector, verifier |
| **code-bug** | bug, error, crash, broken, not working, fix | research(light) > plan(1 phase) > fix > review > verify(light) | implementer, code-reviewer, verifier |
| **code-refactor** | refactor, clean up, reorganize, SOLID, extract | research > plan(behavior-preserving) > baseline tests > execute > regression > review | implementer, code-reviewer, qa-inspector, verifier |
| **docs** | document, README, guide, tutorial, API docs | research > write > doc-review | implementer, doc-reviewer |
| **analysis** | analyze, audit, review codebase, assess, report | research > report (no code changes) | researcher |
| **analysis-security** | security, vulnerability, OWASP, CVE, auth audit | research(opus) > OWASP report (no code changes) | researcher(opus) |
| **infra** | deploy, pipeline, Docker, CI/CD, Terraform, K8s | research > plan > dry-run > approve > execute | implementer, code-reviewer, qa-inspector, verifier |
| **design** | architecture, design, ADR, RFC, system design | research > design doc > review | researcher |

**Subtype detection priority:** Check specific subtypes first (code-bug, code-refactor, analysis-security) before falling back to base types (code, analysis).

**Quick mode (`--quick`):** Bypasses type classification. Runs a 3-step pipeline:
1. Plan (single task, no research input)
2. Execute (implement + self-check only, no code review)
3. Commit (atomic commit, no verification)

Use for small, well-understood changes within a known codebase. Not for new features or unfamiliar code.

---

## 4. Scale Detection

| Scale | Criteria | Phases | Tasks | Execution Mode | Checkpoint |
|---|---|---|---|---|---|
| **small** | 1-3 files, isolated change, single concern | 1 | 1-5 | subagent | auto-proceed |
| **medium** | 4-10 files, cross-module, multiple concerns | 1-2 | 6-15 | subagent or team | user confirmation |
| **large** | 10+ files, system-wide, architectural impact | 2-5 | 16+ | team (persistent) | user confirmation + per-phase report |

**Auto-detection signals:**
- File count estimated from request scope and grep results
- Module boundary crossings (different directories/packages)
- Number of distinct concerns in the request
- Explicit `--scale` flag overrides auto-detection

---

## 5. Context Engineering Principles

> This is the core innovation of Forge v2. Every rule below exists to prevent **context rot** — the degradation of LLM output quality as the context window fills up.

### 5.1 PM Context Budget: <= 15%

The orchestrator (PM = you, Claude running this skill) must never consume more than 15% of the context window. This means:

- **NEVER** load agent output into your context. Receive file paths only.
- **NEVER** read full file contents when a summary suffices.
- **ALLOWED:** Read file **paths** returned by agents.
- **ALLOWED:** Read **summaries** (<= 20 lines) from artifact files.
- **ALLOWED:** Load files selectively per the Loading Map (Section 6).

### 5.2 File-Based Communication

All agent communication goes through disk files. Agents never communicate directly.

```
PM ---(prompt + file_paths)---> Agent
Agent ---(reads files)--------> Disk
Agent ---(writes output)------> Disk
Agent ---(returns path)-------> PM
PM ---(reads summary only)---> Disk
```

### 5.3 Fresh Context per Agent

Each subagent invocation starts with a clean context window. This is why agents read files directly instead of receiving content from PM.

### 5.4 Plan = Prompt

The plan.md file IS the execution instruction for agents. PM passes the file path; agents read the relevant task section directly.

### 5.5 State Lives on Disk

All state is externalized to `.forge/` artifacts (meta.json, research.md, plan.md, etc.). If PM's context is lost, the pipeline can be reconstructed from these files.

> **Detailed rules:** `references/context-engineering.md` (load only when needed, not now).

---

## 6. Loading Map

**This table defines exactly what PM loads at each step. Follow it strictly to prevent context rot.**

| Step | Load These Files | DO NOT Load |
|---|---|---|
| **1. INIT** | This `SKILL.md` (sections 1-4 for classification). `.forge/project-profile.json` (if cached, < 30 days old). | `execution-flow.md`. Any prompts, checklists, or templates. |
| **2. RESEARCH** | `execution-flow.md` section 2 only. `resources/type-guides.md` (relevant type only). | Other execution-flow sections. Prompts, checklists. |
| **3. PLAN** | `execution-flow.md` section 3 only. `research.md` (Summary section only, <= 20 lines). `templates/plan.md`. `references/questioning.md` (if ambiguous). `.forge/memory/patterns.json` (if exists). | Full research.md. Other execution-flow sections. |
| **4. PLAN-CHECK** | `execution-flow.md` section 4 only. `plan.md` (summary/frontmatter only). Dispatch `test-auditor` after plan-check passes. | research.md. Full plan.md body. Previous step details. |
| **5. CHECKPOINT** | `execution-flow.md` section 5 only. `plan.md` (overview + task count). | Everything else. |
| **6. BRANCH** | `execution-flow.md` section 6 only. | Everything else. |
| **7. EXECUTE** | `execution-flow.md` section 7 only. `plan.md` task checklist (task IDs + status). Agent prompt paths. Checklist paths. `references/model-routing.md` (for complexity calc). Record trace.jsonl after each dispatch. | Completed task details. research.md. Plan rationale. |
| **8. VERIFY** | `execution-flow.md` section 8 only. `plan.md` must_haves section only. | All previous step details. |
| **9. FINALIZE** | `execution-flow.md` section 9 only. `verification.md` (verdict only). `references/learning-system.md` (memory write rules). `.forge/memory/` write. `forge-tools.js metrics-record`. | All previous step details. |
| **10. CLEANUP** | Nothing (internal bookkeeping only). | Everything. |
| **Project Init** | `project-lifecycle.md` §1, `templates/project.json`, `templates/roadmap.md`, `templates/state.md` | All other references |
| **Phase Exec** | `project-lifecycle.md` §2, `.forge/roadmap.md`, `.forge/state.md` | Other lifecycle sections |
| **Autonomous** | `project-lifecycle.md` §3, `.forge/roadmap.md`, `.forge/state.md` | Everything else |
| **Milestone** | `project-lifecycle.md` §4, phase `verification.md` files | Everything else |
| **Status** | `.forge/project.json`, `.forge/roadmap.md`, `.forge/state.md` | Everything else |
| **Debug** | `references/debug-pipeline.md`, `prompts/debugger.md` | Everything else |
| **Map** | `references/codebase-mapping.md` | Everything else |
| **Retrospective** | `references/learning-system.md` §3, milestone report.md files, metrics.json | Everything else |
| **Quick** | `execution-flow.md` Step 3 only (single task). Skip Steps 2,4,5,6,8. | Everything else |
| **Resume** | `meta.json` (from lock file's artifact dir), `execution-flow.md` §7 (resume protocol) | Everything before the interrupted step |
| **Ralph** | `references/ralph-mode.md`, `prompts/ralph-executor.md` | Standard pipeline steps |
| **Backpressure** | `references/backpressure.md` (loaded within Step 7 when backpressure enabled) | — |

**Key rule:** `references/execution-flow.md` is NEVER read in full. Read only the current step's section (from `## Step N:` to the next `---` delimiter).

---

## 7. Execution Pipeline Summary

| Step | Name | Action | Input | Output | Primary Agent |
|---|---|---|---|---|---|
| 1 | **INIT** | Parse request, detect type/scale/paradigm, create artifact directory | User request, project-profile.json (cache) | meta.json (initialized) | PM |
| 2 | **RESEARCH** | Parallel codebase exploration, synthesize findings | Codebase files, type-guide | research.md | researcher(haiku x2-4) > synthesizer(sonnet) |
| 3 | **PLAN** | Generate must_haves + deep work tasks with wave assignments | research.md, plan template, type-guide | plan.md | planner(sonnet/opus) |
| 4 | **PLAN-CHECK** | 8-dimension plan verification (max 3 revision loops) | plan.md, research.md | plan.md (annotated with check results) | plan-checker(sonnet) |
| 5 | **CHECKPOINT** | User approval gate (small: auto-proceed) | plan.md (summary) | User decision (execute/modify/cancel) | PM |
| 6 | **BRANCH** | Create git feature branch | meta.json (slug) | feature/{slug} branch | PM |
| 7 | **EXECUTE** | Wave-based parallel implementation with backpressure gate + per-task review | plan.md (tasks), checklists | Code changes, task-summaries, qa-reports | implementer, code-reviewer, qa-inspector |
| 8 | **VERIFY** | Goal-backward 3-level verification (Exists > Substantive > Wired) | plan.md (must_haves), codebase | verification.md | verifier(sonnet) |
| 9 | **FINALIZE** | Generate report, capture learnings, propose PR | All summaries + verification | report.md | PM |
| 10 | **CLEANUP** | Clean intermediate files, finalize meta.json | meta.json | meta.json (state: completed) | PM |

> **Detailed step instructions:** `references/execution-flow.md` (load per-section as needed).

---

## 8. Agent Architecture

Twelve specialized agents plus two project-level agents. PM dispatches each with file paths; agents read files directly and write output to disk.

(See Section 13.4 for project-level agents: roadmapper, integration-checker)

| # | Agent | Role | Input (files) | Output (file) | Default Model |
|---|---|---|---|---|---|
| 1 | **researcher** | Codebase exploration + domain investigation | Project files (Glob/Grep) | `research.md` (or intermediate `research-*.md`) | haiku (parallel) > sonnet (synthesis) |
| 2 | **planner** | Generate must_haves + deep work task plan | `research.md`, type-guide | `plan.md` | sonnet (or opus for large) |
| 3 | **plan-checker** | 8-dimension plan verification | `plan.md`, `research.md` | Check results appended to `plan.md` | sonnet |
| 4 | **implementer** | Code implementation with deviation rules | `plan.md` (task section), checklists | `task-{N-M}-summary.md`, code changes | sonnet |
| 5 | **code-reviewer** | 10-perspective code review | Code changes, `plan.md` (must_haves), checklists | Review results in `task-{N-M}-summary.md` | sonnet |
| 6 | **qa-inspector** | Build/test verification + anti-pattern scan | task-summaries, build/test results | `qa-report.md` | sonnet |
| 7 | **verifier** | Goal-backward 3-level verification | `plan.md` (must_haves), codebase | `verification.md` | sonnet |
| 8 | **doc-reviewer** | Documentation quality review | Document files | Review results | sonnet |
| 11 | **debugger** | Scientific method bug diagnosis | Bug description, source files | `debug-report.md` | sonnet |
| 12 | **test-auditor** | Nyquist test coverage analysis | plan.md, source files, test files | `validation.md` | sonnet |
| 13 | **ralph-executor** | Fresh-context iteration executor for Ralph Mode | `iteration-log.md`, completion promise, source files | `iteration-{N}-summary.md` | sonnet |

**Agent dispatch format:**
```xml
<agent_dispatch>
  <role>implementer</role>
  <task_id>1-3</task_id>
  <files_to_read>
    .forge/2026-03-15/auth-refactor-1430/plan.md (task [1-3] only)
    src/auth/handler.go
    src/auth/middleware.go
  </files_to_read>
  <checklist>checklists/go.md</checklist>
  <output_path>.forge/2026-03-15/auth-refactor-1430/task-1-3-summary.md</output_path>
</agent_dispatch>
```

**Communication rule:** PM receives only the `output_path` back. PM reads at most a 20-line summary from that file. PM never loads full agent output into its own context.

---

## 9. Model Selection Matrix

### 9.1 Profiles

| Step | quality | balanced | budget |
|---|---|---|---|
| Research (parallel) | sonnet | haiku | haiku |
| Research (synthesis) | opus | sonnet | haiku |
| Planning | opus | sonnet | sonnet |
| Plan-Check | opus | sonnet | haiku |
| Implementation | opus | sonnet | sonnet |
| Code Review | opus | sonnet | haiku |
| QA Inspection | sonnet | sonnet | haiku |
| Verification | opus | sonnet | sonnet |

### 9.2 Adaptive Triggers

| Trigger | Action |
|---|---|
| Plan-checker fails 3 consecutive times | Upgrade planner to opus |
| Code review returns 3 consecutive major revisions | Upgrade implementer to opus |
| 3 consecutive PASS results | Downgrade review model one tier (e.g., sonnet > haiku) |
| analysis-security type detected | Force researcher to opus regardless of profile |

### 9.3 Smart Routing (balanced profile)

When `--model balanced` (default), Forge uses complexity-based model routing instead of the static matrix above.

**Complexity score (0-10)** is calculated per agent dispatch based on: file count, dependency depth, domain novelty, security sensitivity, and prior failure rate.

| Complexity | Model |
|---|---|
| 0-3 (Low) | haiku |
| 4-6 (Medium) | sonnet |
| 7-10 (High) | opus |

Static matrix (Section 9.1) is used as fallback when `--model quality` or `--model budget` is specified.

> Detailed rules: `references/model-routing.md` (load only when needed).

---

## 10. Artifact Structure

### 10.1 Directory Layout

```
.forge/
  project-profile.json              # Project cache (stack, language, paradigm, framework)
  {YYYY-MM-DD}/
    {slug}-{HHMM}/
      meta.json                     # Execution state, config, progress tracking
      execution-lock.json             # Crash recovery lock (removed on clean exit)
      research.md                   # Research findings (severity-tagged: H/M/L)
      plan.md                       # Plan (YAML must_haves + XML deep work tasks)
      task-{N-M}-summary.md         # Per-task execution summary
      qa-report.md                  # QA inspection results
      verification.md               # Goal-backward verification results
      validation.md               # Test coverage gap analysis (Nyquist)
      trace.jsonl                 # Agent dispatch trace log
      report.md                     # Final report
  ralph-{slug}-{HHMM}/               # Ralph Mode artifacts
    iteration-log.md                  # Cross-iteration memory
    iteration-{N}-summary.md          # Per-iteration results
  memory/                           # Learning system (persistent)
    patterns.json                   # Successful implementation patterns
    failures.json                   # Failed approaches + alternatives
    decisions.json                  # Architectural decisions + rationale
  metrics.json                      # Execution metrics (aggregated)
```

### 10.2 meta.json Structure

```json
{
  "version": "2.0.0",
  "created": "2026-03-15T14:30:00Z",
  "request": "Implement JWT authentication middleware",
  "type": "code",
  "scale": "medium",
  "paradigm": "oop",
  "language": "go",
  "state": "executing",
  "current_step": 7,
  "current_wave": 2,
  "options": {
    "model": "balanced",
    "review": "normal",
    "skip_tests": false
  },
  "tasks": {
    "total": 8,
    "completed": 5,
    "completed_tasks": ["1-1", "1-2", "1-3", "1-4", "1-5"],
    "in_progress": 2,
    "failed": 0,
    "skipped": 0
  },
  "waves": {
    "total": 3,
    "current": 2,
    "completed": [1]
  },
  "revisions": {
    "plan": 1,
    "code_minor": 2,
    "code_major": 0,
    "reject": 0,
    "qa_retry": 0
  },
  "git": {
    "branch": "feature/jwt-auth-middleware",
    "commits": ["abc1234", "def5678"]
  }
}
```

---

## 11. Quality System Summary (5-Layer Defense)

| Layer | Name | Where | What It Checks |
|---|---|---|---|
| L1 | **Deep Work** | Planning (Step 3-4) | Every task has `read_first` + `acceptance_criteria` + concrete `action`. 8-dimension plan-checker verification. |
| L2 | **Self-Check** | Implementation (Step 7) | Implementer's 6-item checklist (circular refs, init order, null safety, save/load, event timing, build). Stuck Detection Protocol: read loop (5 warn / 7 force), same-file 3x, error loop 3x. Decision Lock compliance check. |
| L3 | **Peer Review** | Code Review (Step 7) | 10-perspective review: style, bugs, security, performance, plan alignment, TDD, SOLID/paradigm, error handling, goal-backward wiring, anti-pattern scan. Language-specific + general checklists. |
| L4 | **QA Gate** | Wave Boundary (Step 7) | Build verification, test execution, caller impact analysis, anti-pattern scan across all changed files. |
| L5 | **Goal-Backward** | Verification (Step 8) | Level 1: Exists (files present, min lines met). Level 2: Substantive (real code, not stubs). Level 3: Wired (imports used, key_links connected). |

---

## 12. Error Recovery Summary

### 12.1 Three-Tier Escalation

| Tier | Name | When | Action |
|---|---|---|---|
| **1** | Auto-Recover | Build failure, test failure, minor review feedback, file conflict | Analyze error, auto-fix, re-submit. Switch to sequential if parallel conflict. |
| **2** | Alternative Approach | Tier 1 failed | Try different implementation strategy. Try alternative library. Upgrade model tier. |
| **3** | User Intervention | Tier 2 failed, architecture decision needed, external system access | Report problem + options with recommendation. User decides. |

### 12.2 Revision Limits

| Type | Max Attempts | On Exceed |
|---|---|---|
| Plan revision | 3 | Escalate to user for manual plan edit |
| Code minor revision | 5 | Upgrade model, then escalate |
| Code major revision | 3 | Escalate to user |
| Code reject | 2 | Redesign task or escalate to user |
| QA retry | 2 | Escalate to user |
| Deviation auto-fix | 3 per task | Document and move to next task |

### 12.3 Absolute Rules

1. **Never repeat the same failure.** Record failed approaches and try a different method.
2. **3+ identical errors = immediate Tier 3 escalation.**
3. **Deviation Rule R4 (architecture change needed) = immediate stop.** Only the user can authorize architectural changes.

---

## 13. Project Layer

> Project operations wrap the existing task pipeline. The 10-step pipeline is UNCHANGED.
> Project mode activates only when `.forge/project.json` exists or `--init` is used.
> Detailed flows: `references/project-lifecycle.md` (load per-section as needed).

### 13.1 Project Mode Detection

| Condition | Mode | Artifact Location |
|---|---|---|
| No `.forge/project.json` exists | **Task mode** (v2.0 behavior) | `.forge/{date}/{slug}/` |
| project.json exists + project flag used | **Project mode** | `.forge/phases/{NN}-{slug}/` |
| project.json exists + no project flag | **Task mode** (within project context) | `.forge/{date}/{slug}/` |

Project flags: `--init`, `--phase`, `--autonomous`, `--milestone`, `--status`, `--discuss`

### 13.2 Project Commands

| Command | Action | Loads |
|---|---|---|
| `/forge --init` | Create project + roadmap + state | `project-lifecycle.md` §1 |
| `/forge --phase N` | Execute phase N via 10-step pipeline | `project-lifecycle.md` §2 |
| `/forge --autonomous` | Auto-chain all remaining phases | `project-lifecycle.md` §3 |
| `/forge --milestone [N]` | Verify and archive milestone | `project-lifecycle.md` §4 |
| `/forge --status` | Show project progress dashboard | `project-lifecycle.md` §5 |
| `/forge --discuss N` | Capture phase decisions before planning | `project-lifecycle.md` §2 (context step) |

### 13.3 Project Artifact Structure

```
.forge/
  project.json                    # Project identity + config
  roadmap.md                      # Phase sequence with milestones
  state.md                        # Session continuity (≤100 lines)
  project-profile.json            # Stack cache (existing, unchanged)
  phases/
    {NN}-{slug}/                  # Per-phase artifacts
      context.md                  # User decisions (optional)
      meta.json                   # Standard forge execution state
      research.md                 # Standard forge research
      plan.md                     # Standard forge plan
      verification.md             # Standard forge verification
      report.md                   # Standard forge report
  memory/                         # Project-level learning
    patterns.json
    failures.json
    decisions.json
  retrospective-{milestone}.md    # Post-milestone retrospective
  milestones/
    {name}-archive.md             # Completed milestone archive
    {name}-verification.md        # Milestone verification result
  {YYYY-MM-DD}/                   # Non-project tasks (unchanged)
    {slug}-{HHMM}/
```

### 13.4 New Agents

| # | Agent | Role | Dispatched By | Model |
|---|---|---|---|---|
| 9 | **roadmapper** | Creates roadmap from project requirements | `/forge --init` | sonnet |
| 10 | **integration-checker** | Cross-phase verification at milestone boundaries | `/forge --milestone` | sonnet |
| 11 | **debugger** | Scientific method bug diagnosis | Bug description, source files | `debug-report.md` | sonnet |

### 13.5 Session Continuity

On session start, if `.forge/state.md` exists:
1. Read state.md (always ≤100 lines — safe to load)
2. Display current position to user
3. Offer: resume current phase, show status, or start new task

### 13.6 Autonomous Mode Safety

- Max phases per session: 10 (prevents runaway execution)
- Context pressure check after each phase (graceful exit if HIGH/CRITICAL)
- User input during autonomous → pause after current task, respond
- State persisted after every phase → safe to interrupt anytime

---

## 14. Wiring Verification (Self-Check)

> Every feature MUST be connected to the execution pipeline. A reference document or agent prompt that is never loaded by execution-flow.md is dead code.

### 14.1 Verification Matrix

Every reference, prompt, and template file must answer these 3 questions:

| Question | If NO → Dead Code |
|---|---|
| **When does PM load this file?** | Must be listed in Loading Map (Section 6) |
| **Which Step triggers this?** | Must be referenced in execution-flow.md |
| **What is the output?** | Must produce a file listed in Artifact Structure (Section 10) |

### 14.2 Current Wiring Status

| File | Loaded By | Step | Output |
|---|---|---|---|
| `references/execution-flow.md` | Loading Map per-step | Steps 1-10 | — (instructions) |
| `references/context-engineering.md` | On-demand | Any step | — (rules) |
| `references/project-lifecycle.md` | Step 0 (flag routing) | Project commands | project.json, roadmap.md, state.md |
| `references/wave-execution.md` | Step 7 | Execute | — (parallel rules) |
| `references/deviation-rules.md` | Step 7 | Execute | deviation log in summary |
| `references/debug-pipeline.md` | Step 0 (`--debug`) | Debug pipeline | debug-report.md |
| `references/codebase-mapping.md` | Step 0 (`--map`) | Map pipeline | .forge/codebase/*.md |
| `references/questioning.md` | Step 3 (ambiguous requests) | Plan | context.md |
| `references/learning-system.md` | Step 9 (FINALIZE) | Finalize | memory/*.json, metrics.json |
| `references/model-routing.md` | Step 7 (before dispatch) | Execute | — (model selection) |
| `prompts/researcher.md` | Step 2 | Research | research.md |
| `prompts/planner.md` | Step 3 | Plan | plan.md |
| `prompts/plan-checker.md` | Step 4 | Plan-Check | plan.md (annotated) |
| `prompts/implementer.md` | Step 7 | Execute | task-summary.md |
| `prompts/code-reviewer.md` | Step 7 | Execute | task-summary.md (review) |
| `prompts/qa-inspector.md` | Step 7 | Execute | qa-report.md |
| `prompts/verifier.md` | Step 8 | Verify | verification.md |
| `prompts/doc-reviewer.md` | Step 7 (docs type) | Execute | review results |
| `prompts/debugger.md` | Step 0 (`--debug`) | Debug | debug-report.md |
| `prompts/test-auditor.md` | Step 4 (after plan-check) | Plan-Check | validation.md |
| `prompts/roadmapper.md` | Step 0 (`--init`) | Project Init | roadmap.md |
| `prompts/integration-checker.md` | Step 0 (`--milestone`) | Milestone | milestone-verification.md |
| `templates/plan.md` | Step 3 | Plan | plan.md |
| `templates/research.md` | Step 2 | Research | research.md |
| `templates/verification.md` | Step 8 | Verify | verification.md |
| `templates/summary.md` | Step 7 | Execute | task-summary.md |
| `templates/report.md` | Step 9 | Finalize | report.md |
| `templates/output.md` | All steps | All | user display |
| `templates/config.json` | Step 0 (`--init`) or config-init | Project Init | .forge/config.json |
| `templates/metrics.json` | Step 9 | Finalize | .forge/metrics.json |
| `references/deviation-rules.md` §7 | Step 7 | Execute | stuck events in task summary |
| `references/context-engineering.md` §8 | Any step (on compression) | Recovery | — (protocol) |
| `references/context-engineering.md` §9 | Step 9 | Finalize | token summary in report |
| `references/backpressure.md` | Step 7 (within execute) | Execute | backpressure results in task summary |
| `references/ralph-mode.md` | Step 0 (`--ralph`) | Ralph Mode | iteration-log.md, iteration summaries |
| `prompts/ralph-executor.md` | Step 0 (`--ralph`) | Ralph Mode | iteration-{N}-summary.md |
| `templates/retrospective.md` | `--retrospective` | Retrospective | retrospective-{ms}.md |

### 14.3 Rule for New Features

When adding a new reference, prompt, or template:
1. Add the file to the Wiring Verification table above
2. Add a Loading Map entry in Section 6
3. Add the trigger point in execution-flow.md (specific Step)
4. Add the output to Artifact Structure (Section 10)

**If any of these 4 steps is missing, the feature is incomplete.**

---

## Step 1: Quick Start (runs from SKILL.md alone)

Step 1 does NOT require loading execution-flow.md. Execute entirely from this file.

### Procedure

0. **Project flag routing.** Check for project flags (`--init`, `--phase`, `--autonomous`, `--milestone`, `--status`, `--discuss`). If any detected → load `references/project-lifecycle.md` (relevant section only) and follow its flow instead of continuing below. Check for `--debug` → load `references/debug-pipeline.md` and follow its 5-step flow. Check for `--map` → load `references/codebase-mapping.md` and follow its flow.
Check for `--ralph` → load `references/ralph-mode.md` and follow its iteration flow. If no special flag → proceed with standard Step 1.
1. **Parse request.** Extract what the user wants. If unclear, ask a clarifying question.
2. **Detect type** using Section 3 heuristics. Apply `--type` override if provided.
3. **Detect scale** using Section 4 criteria. Apply `--scale` override if provided.
4. **Detect language + paradigm.** Check `.forge/project-profile.json` (use cache if < 30 days old). If no cache, run Glob/Grep to identify stack, then create profile.
5. **Create artifact directory:** `.forge/{YYYY-MM-DD}/{slug}-{HHMM}/`
6. **Initialize meta.json** with version, request, type, scale, paradigm, language, options, state: "init".
7. **Display start banner** to user:
   ```
   Forge v2 | type: {type} | scale: {scale} | lang: {language} | paradigm: {paradigm}
   Artifact: .forge/{date}/{slug}-{HHMM}/
   ```
8. **Set meta.json state to "init_done".**
9. **Proceed to Step 2.** Load `execution-flow.md` section 2 only.

### Core Rules

- **No code before Step 5.** Do not write implementation code until Steps 1-4 are complete (`--direct` exempted).
- **Step order is mandatory.** Never skip ahead (except steps explicitly marked as skippable for a given type).
- **Auto-trigger requires confirmation.** If forge activates on heuristics (not explicit `/forge`), confirm with the user before entering Step 1.
- **Never self-select `--direct`.** Only allowed when the user explicitly passes it.
- **Artifacts are mandatory.** Every execution produces at minimum: meta.json + research.md + report.md.

---

## Type-Based Step Requirements

| Step | code | code-bug | code-refactor | docs | analysis | analysis-security | infra | design | quick |
|---|---|---|---|---|---|---|---|---|---|
| 1. Init | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| 2. Research | Y | Y (light) | Y | Y | Y | Y (opus) | Y | Y | skip |
| 3. Plan | Y | Y (1 phase) | Y (behavior-preserving) | skip | skip | skip | Y | skip | Y (1 task) |
| 4. Plan-Check | Y | simplified (D1,D2,D5,D7) | Y | skip | skip | skip | Y | skip | skip |
| 5. Checkpoint | Y | auto | Y | skip | skip | skip | Y | skip | skip |
| 6. Branch | Y | Y | Y | optional | skip | skip | optional | optional | skip |
| 7. Execute | Y | Y | Y | Y | report only | report only | Y (dry-run first) | report only | Y (no review) |
| 8. Verify | Y | Y (light) | Y | skip | skip | skip | Y | skip | skip |
| 9. Finalize | Y | Y | Y | Y | Y | Y | Y | Y | Y (minimal) |
| 10. Cleanup | Y | Y | Y | Y | Y | Y | Y | Y | skip |

---

## Design Paradigm Rules

Detected from: class ratio, import patterns, framework conventions, file extensions.
Override with `--paradigm`.

| Paradigm | Principles | TDD |
|---|---|---|
| **oop / mixed** | SOLID, DDD boundaries, Ubiquitous Language | Required (Red > Green > Refactor) |
| **fp** | Pure functions, immutable data, composition over inheritance | Required |
| **script** | Readability + safety focus, pragmatic structure | Optional (skip with `--skip-tests`) |
| **ddd** | Bounded contexts, aggregates, domain events, anti-corruption layers | Required |
