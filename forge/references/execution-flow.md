# Forge v7.0 Execution Flow — Engine-Driven

> **Core rule:** You don't control the pipeline. The engine does.
> Call `forge-tools.js engine-*` commands and follow the returned JSON.
> The gate guard hook will hard-block if you violate pipeline state.

---

## Step 0: Router

Check for special flags before entering the standard pipeline:

| Flag | Action |
|---|---|
| `--init` | Load `references/project-lifecycle.md` §1 |
| `--phase N` | Load `references/project-lifecycle.md` §2 |
| `--autonomous` | Load `references/project-lifecycle.md` §3 |
| `--milestone` | Load `references/project-lifecycle.md` §4 |
| `--status` | Load `references/project-lifecycle.md` §5 |
| `--discuss N` | Load `references/project-lifecycle.md` §2 |
| `--debug` | Load `references/debug-pipeline.md` |
| `--map` | Load `references/codebase-mapping.md` |
| `--ralph` | Load `references/ralph-mode.md` |
| `--quick` | Validate quick eligibility, then skip to Step 1 with quick pipeline |

**Quick mode validation** (before accepting `--quick`):
1. Check scope: request must target ≤1 file and ≤50 LOC
2. Check clarity: request must be unambiguous (no "figure out", "investigate", "explore")
3. Check risk: no API/schema/interface changes implied
4. If validation fails → downgrade to `--direct` (skip research only) and warn user

If no special flag → proceed to Step 1.

---

## Step 1: INIT

```bash
# 1. Parse request → detect type, scale, language, paradigm
# 2. Create artifact directory
mkdir -p .forge/{date}/{slug}-{HHMM}

# 3. Initialize engine
node "$FORGE_TOOLS" engine-init {artifact_dir} "{request}" {type} {scale}
# Returns: { initialized: true, pipeline: "standard", skipped_steps: [...] }

# 4. Create execution lock
node "$FORGE_TOOLS" create-lock {artifact_dir}

# 5. Display banner
# Forge v7.0 | type: {type} | scale: {scale} | lang: {lang}
```

---

## Step 2: RESEARCH

```bash
# Check transition
node "$FORGE_TOOLS" engine-can-transition {dir} research
# → { allowed: true, loads: ["resources/type-guides.md"], agent_role: "researcher" }

# Transition
node "$FORGE_TOOLS" engine-transition {dir} research

# Get dispatch spec
node "$FORGE_TOOLS" engine-dispatch-spec {dir} researcher
# → { role, prompt_path, model, output_path, ... }

# Dispatch researcher agent with the spec
# Agent reads codebase, writes research.md

# Record result
node "$FORGE_TOOLS" engine-record-result {dir} researcher research PASS
```

**Research agent details:** `prompts/researcher.md`
**Skip conditions:** `--direct`, `--no-research`, `--quick`

---

## Step 2.5: ARCHITECT GUIDE

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} architect_guide
node "$FORGE_TOOLS" engine-transition {dir} architect_guide
node "$FORGE_TOOLS" engine-dispatch-spec {dir} architect
# Dispatch architect in guide mode → analyzes codebase patterns → writes design-guide.md
node "$FORGE_TOOLS" engine-record-result {dir} architect architect_guide PASS
```

**Architect guide details:** `prompts/architect.md` (Guide Mode)
**Skip conditions:** `--direct`, `--quick`, docs/analysis/design types
**Produces:** `design-guide.md` — contains identified pattern, directory rules, dependency rules

The planner (Step 3) reads design-guide.md to ensure the implementation plan follows the project's architecture pattern.

---

## Step 3: PLAN

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} plan
node "$FORGE_TOOLS" engine-transition {dir} plan
node "$FORGE_TOOLS" engine-dispatch-spec {dir} planner
# Dispatch planner → writes plan.md
node "$FORGE_TOOLS" engine-record-result {dir} planner plan PASS
```

**Planner details:** `prompts/planner.md`
**Plan template:** `templates/plan.md`
**Planner reads:** research.md (summary), design-guide.md (if exists), type-guides.md, patterns.json

---

## Step 4: PLAN-CHECK

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} plan_check
node "$FORGE_TOOLS" engine-transition {dir} plan_check
node "$FORGE_TOOLS" engine-dispatch-spec {dir} plan-checker
# Dispatch plan-checker → annotates plan.md
node "$FORGE_TOOLS" engine-record-result {dir} plan-checker plan_check {PASS|FAIL}
```

**If FAIL:** engine handles revision loop (max 3, defined in pipeline.json)
```bash
node "$FORGE_TOOLS" engine-record-revision {dir} plan
# → { recorded: true, count: 1, limit: 3, exceeded: false }
# Re-dispatch planner with feedback, then re-check
```

**After plan-check PASS:** dispatch test-strategist
```bash
node "$FORGE_TOOLS" engine-dispatch-spec {dir} test-strategist
# → writes test-strategy.md
```

---

## Step 5: CHECKPOINT

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} checkpoint
node "$FORGE_TOOLS" engine-transition {dir} checkpoint
```

- **small scale:** auto-proceed (pipeline.json `auto_proceed_when`)
- **medium/large:** present plan summary, ask user: Execute / Modify / Cancel

---

## Step 6: BRANCH

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} branch
node "$FORGE_TOOLS" engine-transition {dir} branch
git checkout -b feature/{slug}
```

---

## Step 7: EXECUTE

The most complex step. Wave-based parallel execution with backpressure.

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} execute
node "$FORGE_TOOLS" engine-transition {dir} execute
```

### Design Type — Architect Dispatch

When `type == design`, the execute step dispatches the **architect** agent instead of implementer:

```bash
# Subagent mode (default)
node "$FORGE_TOOLS" engine-dispatch-spec {dir} architect
# → { role: "architect", prompt_path: "prompts/architect.md", model: "opus", ... }
# Dispatch architect agent with mode (design|analyze|adr)
# Agent writes architecture output (architecture.md, analysis.md, or adr.md)
node "$FORGE_TOOLS" engine-record-result {dir} architect execute PASS

# Team mode (for --init projects with iterative design)
# 1. TeamCreate({slug}-arch)
# 2. SendMessage(architect, initial design request)
# 3. Review output → SendMessage(architect, refinement feedback)
# 4. Repeat 2-3 until design is satisfactory
# 5. Record result + TeamDelete
```

Architect agent supports 3 modes:
- **design**: Create new system architecture from requirements
- **analyze**: Analyze existing codebase architecture health
- **adr**: Document architecture decisions with options and rationale

### Per-Task Cycle

For each task in each wave:

```bash
# 1. Get implementer spec
node "$FORGE_TOOLS" engine-dispatch-spec {dir} implementer {task_id}
# Dispatch implementer → writes code + task-summary.md

# 2. Atomic commit (engine-record-result will reject PASS without commit)
# Implementer must: git add {task_files} && git commit -m "{type}({slug}/{task_id}): {name}"
# Engine checks: git log -1 must contain task_id
# Non-git repos: commit check skipped automatically
git add {task_files}
git commit -m "{type}({slug}/{task_id}): {task_name}"

# 3. Record result (rejects if no commit in git repo)
node "$FORGE_TOOLS" engine-record-result {dir} implementer {task_id} {PASS|REVISION}

# 4. Code review
node "$FORGE_TOOLS" engine-dispatch-spec {dir} code-reviewer {task_id}
# Dispatch reviewer → appends to task-summary.md

# 5. Record final result
node "$FORGE_TOOLS" engine-record-result {dir} code-reviewer {task_id} {PASS|REVISION}
```

### Wave Boundary

After all tasks in a wave:
```bash
# QA inspection
node "$FORGE_TOOLS" engine-dispatch-spec {dir} qa-inspector
# Dispatch QA → writes qa-report.md

# UI review (if UI files changed)
node "$FORGE_TOOLS" engine-dispatch-spec {dir} ui-reviewer

# VPM cross-check (after QA, before git commit)
node "$FORGE_TOOLS" engine-dispatch-spec {dir} verification-pm {wave_number}
# Dispatch VPM in wave_check mode → writes vpm-wave-{N}.md
# If ISSUES_FOUND: create fix tasks, re-execute, re-check (max 2 re-checks)
# If PASS: proceed to git commit
```

### Revision Handling

```bash
node "$FORGE_TOOLS" engine-record-revision {dir} code_minor
# → { count: 2, limit: 5, exceeded: false }
# If exceeded: { exceeded: true, action: "escalate_to_user" }
```

### Deviation Rules

Same as before: R1 (bug fix), R2 (missing feature), R3 (blocker), R4 (architecture stop).
Details: `references/deviation-rules.md`

---

## Step 8: VERIFY (VPM Final Verify Mode)

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} verify
node "$FORGE_TOOLS" engine-transition {dir} verify
node "$FORGE_TOOLS" engine-dispatch-spec {dir} verification-pm
# Dispatch VPM in final_verify mode (goal-backward 3-level verification)
# VPM writes verification.md
node "$FORGE_TOOLS" engine-record-result {dir} verification-pm verify {VERIFIED|GAPS_FOUND|FAILED}
```

**If GAPS_FOUND (max 2 fix cycles):** create fix tasks, return to execute step, re-dispatch VPM
**If still failing after 2 cycles:** auto-enter Ralph Mode (defined in pipeline.json `gap_fix.on_exhausted`)

```bash
# Verify artifacts with code
node "$FORGE_TOOLS" verify-artifacts {dir}/plan.md
node "$FORGE_TOOLS" verify-key-links {dir}/plan.md
```

---

## Step 9: FINALIZE

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} finalize
node "$FORGE_TOOLS" engine-transition {dir} finalize
```

1. Generate `report.md` using `templates/report.md`
2. Record metrics: `node "$FORGE_TOOLS" metrics-record '{...}'`
3. Write memory: patterns.json, failures.json, decisions.json
4. Knowledge transfer (if quality > 0.8): write to `~/.forge/knowledge/{stack}/`
5. Propose PR if on feature branch

---

## Step 10: CLEANUP

```bash
node "$FORGE_TOOLS" engine-can-transition {dir} cleanup
node "$FORGE_TOOLS" engine-transition {dir} cleanup

# Team cleanup (if team mode was used in Step 7)
# Check meta.json options.exec_mode — if "team" or "hybrid":
#   1. Send shutdown request to all teammates
#   2. Wait for shutdown responses
#   3. TeamDelete to destroy the team
# This prevents "Already leading team" errors in subsequent forge runs.

node "$FORGE_TOOLS" remove-lock {dir}
# → pipeline-state.json: current_step = "completed"
```

---

## Error Recovery

| Situation | Action |
|---|---|
| Build fails | `engine-verify-build` records fail → gate blocks commit → fix and retry |
| Test fails | `engine-verify-tests` records fail → gate blocks commit → fix and retry |
| Agent times out | Retry once, then escalate |
| Plan-check fails 3x | `engine-record-revision` returns exceeded → escalate to user |
| Code review rejects 2x | `engine-record-revision` returns exceeded → redesign task |
| Verification GAPS after 2 fix cycles | Auto-Ralph (pipeline.json config) |
| Context pressure critical | forge-tracker warns → start new session, use --resume |

---

## Reconciliation

At any point, check if actual state matches desired state:

```bash
node "$FORGE_TOOLS" engine-reconcile {dir}
# → { status: "CONSISTENT" } or { status: "DRIFT_DETECTED", drift: [...] }
```

If drift detected, fix the identified issues before proceeding.

---

## Reference Files

| File | When to Load |
|---|---|
| `references/context-engineering.md` | On demand (context management) |
| `references/wave-execution.md` | Step 7 (parallel execution rules) |
| `references/deviation-rules.md` | Step 7 (deviation handling) |
| `references/backpressure.md` | Step 7 (backpressure details) |
| `references/ralph-mode.md` | --ralph or auto-Ralph |
| `references/plugin-system.md` | Step 1 (plugin discovery) |
| `references/learning-system.md` | Step 9 (memory + knowledge) |
| `references/model-routing.md` | Step 7 (model selection) |
| `references/project-lifecycle.md` | Project commands |
| `references/debug-pipeline.md` | --debug |
| `references/codebase-mapping.md` | --map |
