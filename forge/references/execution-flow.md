# Forge v6.0 Execution Flow — Engine-Driven

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
| `--quick` | Skip to Step 1 with quick pipeline |

If no special flag → proceed to Step 1.

---

## Step 1: INIT

```bash
# 1. Parse request → detect type, scale, language, paradigm
# 2. Create artifact directory
mkdir -p .forge/{date}/{slug}-{HHMM}

# 3. Initialize engine
node hooks/forge-tools.js engine-init {artifact_dir} "{request}" {type} {scale}
# Returns: { initialized: true, pipeline: "standard", skipped_steps: [...] }

# 4. Create execution lock
node hooks/forge-tools.js create-lock {artifact_dir}

# 5. Display banner
# Forge v6.0 | type: {type} | scale: {scale} | lang: {lang}
```

---

## Step 2: RESEARCH

```bash
# Check transition
node hooks/forge-tools.js engine-can-transition {dir} research
# → { allowed: true, loads: ["resources/type-guides.md"], agent_role: "researcher" }

# Transition
node hooks/forge-tools.js engine-transition {dir} research

# Get dispatch spec
node hooks/forge-tools.js engine-dispatch-spec {dir} researcher
# → { role, prompt_path, model, output_path, ... }

# Dispatch researcher agent with the spec
# Agent reads codebase, writes research.md

# Record result
node hooks/forge-tools.js engine-record-result {dir} researcher research PASS
```

**Research agent details:** `prompts/researcher.md`
**Skip conditions:** `--direct`, `--no-research`, `--quick`

---

## Step 3: PLAN

```bash
node hooks/forge-tools.js engine-can-transition {dir} plan
node hooks/forge-tools.js engine-transition {dir} plan
node hooks/forge-tools.js engine-dispatch-spec {dir} planner
# Dispatch planner → writes plan.md
node hooks/forge-tools.js engine-record-result {dir} planner plan PASS
```

**Planner details:** `prompts/planner.md`
**Plan template:** `templates/plan.md`
**Planner reads:** research.md (summary), type-guides.md, patterns.json

---

## Step 4: PLAN-CHECK

```bash
node hooks/forge-tools.js engine-can-transition {dir} plan_check
node hooks/forge-tools.js engine-transition {dir} plan_check
node hooks/forge-tools.js engine-dispatch-spec {dir} plan-checker
# Dispatch plan-checker → annotates plan.md
node hooks/forge-tools.js engine-record-result {dir} plan-checker plan_check {PASS|FAIL}
```

**If FAIL:** engine handles revision loop (max 3, defined in pipeline.json)
```bash
node hooks/forge-tools.js engine-record-revision {dir} plan
# → { recorded: true, count: 1, limit: 3, exceeded: false }
# Re-dispatch planner with feedback, then re-check
```

**After plan-check PASS:** dispatch test-strategist
```bash
node hooks/forge-tools.js engine-dispatch-spec {dir} test-strategist
# → writes test-strategy.md
```

---

## Step 5: CHECKPOINT

```bash
node hooks/forge-tools.js engine-can-transition {dir} checkpoint
node hooks/forge-tools.js engine-transition {dir} checkpoint
```

- **small scale:** auto-proceed (pipeline.json `auto_proceed_when`)
- **medium/large:** present plan summary, ask user: Execute / Modify / Cancel

---

## Step 6: BRANCH

```bash
node hooks/forge-tools.js engine-can-transition {dir} branch
node hooks/forge-tools.js engine-transition {dir} branch
git checkout -b feature/{slug}
```

---

## Step 7: EXECUTE

The most complex step. Wave-based parallel execution with backpressure.

```bash
node hooks/forge-tools.js engine-can-transition {dir} execute
node hooks/forge-tools.js engine-transition {dir} execute
```

### Per-Task Cycle

For each task in each wave:

```bash
# 1. Get implementer spec
node hooks/forge-tools.js engine-dispatch-spec {dir} implementer {task_id}
# Dispatch implementer → writes code + task-summary.md

# 2. Backpressure gate (if enabled in pipeline.json)
node hooks/forge-tools.js engine-verify-build {dir} "{build_command}"
# → { result: "pass" } or { result: "fail", error: "..." }
node hooks/forge-tools.js engine-verify-tests {dir} "{test_command}"
# → { result: "pass" } or { result: "fail", error: "..." }
# Gate guard will block git commit if these fail

# 3. Code review
node hooks/forge-tools.js engine-dispatch-spec {dir} code-reviewer {task_id}
# Dispatch reviewer → appends to task-summary.md

# 4. Record result
node hooks/forge-tools.js engine-record-result {dir} implementer {task_id} {PASS|REVISION}

# 5. Atomic commit (if backpressure passed)
git add {task_files}
git commit -m "{type}({slug}/{task_id}): {task_name}"
```

### Wave Boundary

After all tasks in a wave:
```bash
# QA inspection
node hooks/forge-tools.js engine-dispatch-spec {dir} qa-inspector
# Dispatch QA → writes qa-report.md

# UI review (if UI files changed)
node hooks/forge-tools.js engine-dispatch-spec {dir} ui-reviewer
```

### Revision Handling

```bash
node hooks/forge-tools.js engine-record-revision {dir} code_minor
# → { count: 2, limit: 5, exceeded: false }
# If exceeded: { exceeded: true, action: "escalate_to_user" }
```

### Deviation Rules

Same as before: R1 (bug fix), R2 (missing feature), R3 (blocker), R4 (architecture stop).
Details: `references/deviation-rules.md`

---

## Step 8: VERIFY

```bash
node hooks/forge-tools.js engine-can-transition {dir} verify
node hooks/forge-tools.js engine-transition {dir} verify
node hooks/forge-tools.js engine-dispatch-spec {dir} verifier
# Dispatch verifier → writes verification.md
node hooks/forge-tools.js engine-record-result {dir} verifier verify {VERIFIED|GAPS_FOUND|FAILED}
```

**If GAPS_FOUND (max 2 fix cycles):** create fix tasks, return to execute step
**If still failing after 2 cycles:** auto-enter Ralph Mode (defined in pipeline.json `gap_fix.on_exhausted`)

```bash
# Verify artifacts with code
node hooks/forge-tools.js verify-artifacts {dir}/plan.md
node hooks/forge-tools.js verify-key-links {dir}/plan.md
```

---

## Step 9: FINALIZE

```bash
node hooks/forge-tools.js engine-can-transition {dir} finalize
node hooks/forge-tools.js engine-transition {dir} finalize
```

1. Generate `report.md` using `templates/report.md`
2. Record metrics: `node hooks/forge-tools.js metrics-record '{...}'`
3. Write memory: patterns.json, failures.json, decisions.json
4. Knowledge transfer (if quality > 0.8): write to `~/.forge/knowledge/{stack}/`
5. Propose PR if on feature branch

---

## Step 10: CLEANUP

```bash
node hooks/forge-tools.js engine-can-transition {dir} cleanup
node hooks/forge-tools.js engine-transition {dir} cleanup
node hooks/forge-tools.js remove-lock {dir}
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
node hooks/forge-tools.js engine-reconcile {dir}
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
