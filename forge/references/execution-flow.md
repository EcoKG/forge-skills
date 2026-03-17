# Forge v2 Execution Flow

> **Loading Rule:** PM loads ONLY the current step section using markers like `STEP_N_START` / `STEP_N_END`.
> Never load the entire file at once. Each section is self-contained.

---

<!-- STEP_0_START -->
## Step 0: Project Router

**This step runs BEFORE Step 1 only when project flags are detected.**
**If no project flag → skip entirely and proceed to Step 1.**

### Load
- SKILL.md Section 13 (Project Layer) — already loaded from skill entry

### Prerequisites
- PM detected a project flag: `--init`, `--phase N`, `--autonomous`, `--milestone [N]`, `--status`, `--discuss N`, `--debug`, `--map`, `--quick`, `--retrospective`

### Actions

1. **Identify operation** from the flag:
   | Flag | Operation | Load Section |
   |---|---|---|
   | `--init` | Project initialization | `project-lifecycle.md` §1 (PROJECT_INIT) |
   | `--phase N` | Phase execution | `project-lifecycle.md` §2 (PHASE_EXEC) |
   | `--autonomous` | Autonomous multi-phase | `project-lifecycle.md` §3 (AUTONOMOUS) |
   | `--milestone [N]` | Milestone verification | `project-lifecycle.md` §4 (MILESTONE) |
   | `--status` | Status dashboard | `project-lifecycle.md` §5 (STATUS) |
   | `--discuss N` | Phase context capture | `project-lifecycle.md` §2 (PHASE_EXEC, context substep) |
   | `--debug` | Debug pipeline | `debug-pipeline.md` (DEBUG_PIPELINE) |
   | `--map` | Codebase mapping | `codebase-mapping.md` (CODEBASE_MAP) |
   | `--quick` | Quick 3-step pipeline | Skip to Step 3 (single task plan) |
   | `--retrospective` | Milestone retrospective | `learning-system.md` (RETROSPECTIVE) |
   | `--ralph` | Ralph iteration loop | `ralph-mode.md` (RALPH_MODE) |

2. **Load the relevant section** from `references/project-lifecycle.md`
   - Use section markers (e.g., `PROJECT_INIT_START` to `PROJECT_INIT_END`)
   - Do NOT load the entire file

3. **Execute the project-lifecycle flow**
   - For `--phase N`: the flow will eventually invoke Step 1 with phase context injection
   - For `--status`: display and return (no pipeline execution)
   - For `--init`: create project, then optionally invoke `--phase 1`

4. **Ralph Mode routing** (if `--ralph` detected):
   - Load `references/ralph-mode.md` §4 (Iteration Flow)
   - Create artifact directory: `.forge/{date}/ralph-{slug}-{HHMM}/`
   - Initialize `meta.json` with `mode: "ralph"`, `max_iterations` from flag or config
   - Create empty `iteration-log.md`
   - Run completion promise check to capture initial state
   - Record initial failures in `iteration-log.md` §Initial State
   - Enter iteration loop:
     ```
     for iteration in 1..max_iterations:
         dispatch ralph-executor (fresh subagent) with:
           - iteration-log.md path
           - completion promise command
           - iteration number
           - relevant source files

         run completion promise check
         append result to iteration-log.md

         if PASS → success, exit loop, generate report
         if FAIL + no progress for 3 iterations → stuck, escalate
         if iteration == max_iterations → exhausted, present options
     ```
   - On completion: generate `report.md`, update `meta.json` state
   - **Do NOT enter the standard 10-step pipeline**

5. **Return control**
   - If the operation invokes the pipeline (--phase, --autonomous): proceed to Step 1 with injected context
   - If the operation is self-contained (--status, --milestone, --init): return to user

### Output
- Depends on operation (see project-lifecycle.md for each)

### User Output
- Operation-specific (see project-lifecycle.md)

### Error Handling
- Project flag used but no project.json → helpful error message
- Invalid phase/milestone number → list valid options

---

<!-- STEP_0_END -->

<!-- STEP_1_START -->
## Step 1: INIT

### Load
- `SKILL.md` (sections 1-4: Activation, Command Interface, Type Classification, Scale Detection)
- `.forge/project-profile.json` (if exists and < 30 days old)

### Prerequisites
- User has invoked `/forge [request]` or a matching activation keyword was detected.
- No other Forge execution is currently in progress for this project.

### Actions
1. **Parse user request**
   - Extract the natural-language goal from the user's message.
   - If the request is ambiguous or incomplete, ask the user a clarifying question with concrete options before proceeding.

**1b. Phase Context Injection (project mode only)**

If this Step 1 was invoked by `project-lifecycle.md` Phase Execution (Step 0 → --phase N):
- `request` = phase goal from roadmap.md (already set by project-lifecycle flow)
- `phase_context` is available: `{phase_number, success_criteria, requirements, context_md_path}`
- Seed `must_haves.truths` with `success_criteria` (will be passed to planner in Step 3)
- Set `artifact_dir` = `.forge/phases/{NN}-{slug}/` (not the date-based directory)
- Include `context.md` path in planner's `<files_to_read>` if it exists
- Set `meta.json.phase_ref` = `{phase_number, phase_name, milestone}`

If NOT in project mode: skip this step entirely.

2. **Detect type**
   - Match the request against the 8 type definitions in SKILL.md: `code | code-bug | code-refactor | docs | analysis | analysis-security | infra | design`.
   - If the user provided `--type`, use it as an override.
   - Record the detected type in meta.json.

3. **Detect scale**
   - Estimate the number of files and scope of changes:
     - `small` (1-5 tasks, single phase)
     - `medium` (6-15 tasks, 1-2 phases)
     - `large` (16+ tasks, 2-5 phases)
   - If the user provided `--scale`, use it as an override.

4. **Detect language and paradigm**
   - Check `.forge/project-profile.json` cache first (valid if < 30 days).
   - If no cache: use Glob/Grep to scan for package.json, go.mod, Cargo.toml, requirements.txt, etc.
   - Detect paradigm: `oop | fp | script | ddd | mixed`.
   - If the user provided `--lang` or `--paradigm`, use as override.
   - Create or update `.forge/project-profile.json` with: language, framework, paradigm, test_framework, build_tool, project_type.

5. **Create artifact directory**
   - Generate slug from the request (lowercase, hyphenated, max 30 chars).
   - Create: `.forge/{YYYY-MM-DD}/{slug}-{HHMM}/`
   - Initialize `meta.json`:
     ```json
     {
       "version": "2.0.0",
       "created": "{ISO timestamp}",
       "request": "{user request}",
       "type": "{detected type}",
       "scale": "{detected scale}",
       "paradigm": "{detected paradigm}",
       "language": "{detected language}",
       "state": "init",
       "current_step": 1,
       "options": { ... },
       "tasks": { "total": 0, "completed": 0, "in_progress": 0, "failed": 0, "skipped": 0 },
       "waves": { "total": 0, "current": 0, "completed": [] },
       "revisions": { "plan": 0, "code_minor": 0, "code_major": 0, "reject": 0, "qa_retry": 0 },
       "git": { "branch": "", "commits": [] }
     }
     ```

6. **Determine type-based routing**
   - Consult `resources/type-guides.md` for the detected type.
   - Determine which steps to skip:
     - `docs` -> skip Plan-Check (Step 4), QA, Verify (Step 8)
     - `analysis` / `analysis-security` -> skip Plan (Step 3), Plan-Check (Step 4), Execute (Step 7), Verify (Step 8)
     - `design` -> skip Plan-Check (Step 4), Execute (Step 7), Verify (Step 8)
   - Record skip list in meta.json `options.skip_steps`.

7. **Mark forge as invoked** (for pretool gate):
   - Run: `node forge-tools.js mark-invoked {session_id}`
   - This writes a flag file so the PreToolUse gate knows forge is active.

### File-Based Communication
```
No agent dispatch in this step.
PM performs all actions directly.
```

### Output
- `.forge/{date}/{slug}-{HHMM}/meta.json` (initialized)
- `.forge/project-profile.json` (created or updated)

### User Output
```
--- Forge v2 ---
Request:  {user request}
Type:     {type}
Scale:    {scale}
Language: {language} ({paradigm})
Artifact: .forge/{date}/{slug}-{HHMM}/
---
```

### Error Handling
- If project-profile.json fails to detect language: ask the user to specify `--lang`.
- If artifact directory already exists (slug collision): append `-2`, `-3`, etc.
- If user request is empty: prompt user for a request description.

### 1.8 Crash Recovery Check

**If `--resume` flag is provided:**
1. Scan `.forge/` date directories for `execution-lock.json` files using `forge-tools.js check-lock`
2. If lock found: read `meta.json` from that artifact directory
3. Display to user:
   ```
   Found interrupted execution: {slug} at step {current_step}, task {completed}/{total}.
   Resume? [Y/n]
   ```
4. If user confirms: set artifact_dir to the interrupted execution's directory, restore meta.json state, skip to the interrupted step
5. If no lock found: warn "No interrupted execution found. Starting fresh." and proceed normally

**On normal init (no --resume):**
1. After creating artifact directory and meta.json, run `forge-tools.js create-lock {artifact_dir}`
2. This creates `execution-lock.json` — removed at Step 10 on clean completion
3. If the process crashes, the lock file remains for detection by `forge-session-init.js`

### Next
Proceed to **Step 2: RESEARCH** (unless `--direct`, `--no-research`, or `--from` is set, in which case skip to Step 3 or Step 6).
<!-- STEP_1_END -->

---

<!-- STEP_2_START -->
## Step 2: RESEARCH

### Load
- `references/execution-flow.md` (this section only)
- `resources/type-guides.md` (section for the detected type)

### Prerequisites
- meta.json `state` is `"init"` and `current_step` is 1.
- Artifact directory exists.
- Skip conditions NOT met: no `--direct`, `--no-research`, `--from` flags.

### Actions
0. **Check codebase cache**
   - If `.forge/codebase/` exists and is < 30 days old:
     - Pass `.forge/codebase/STACK.md`, `.forge/codebase/CONVENTIONS.md` paths to researcher agents
     - This reduces duplicate exploration significantly
   - If not: researchers explore from scratch (existing behavior)

1. **Check for reusable research**
   - If `--from <path>` points to an existing research.md: copy it to the artifact directory, skip to Step 3.
   - If a research.md exists in `.forge/` for the same module within the last 30 days: offer to reuse it.

2. **Dispatch parallel exploration agents (haiku)**
   - Number of agents by scale: small=2, medium=3, large=4.
   - Each agent explores one dimension:
     - **Agent 1 (Architecture):** directory structure, module boundaries, dependency flow
     - **Agent 2 (Stack):** language, frameworks, build tools, test frameworks
     - **Agent 3 (Patterns):** code patterns, conventions, naming rules (medium/large only)
     - **Agent 4 (Risks):** tech debt, conflict zones, complexity hotspots (large only)
   - Dispatch format for each:
     ```xml
     <agent_dispatch>
       <role>researcher</role>
       <task_id>research-arch</task_id>
       <files_to_read>
         {relevant project directories and files}
       </files_to_read>
       <focus>Architecture: directory structure, module boundaries, dependency flow</focus>
       <output_path>.forge/{date}/{slug}/research-arch.md</output_path>
     </agent_dispatch>
     ```

3. **Dispatch synthesis agent (sonnet)**
   - After all exploration agents return their output paths:
     ```xml
     <agent_dispatch>
       <role>researcher</role>
       <task_id>research-synthesis</task_id>
       <files_to_read>
         .forge/{date}/{slug}/research-arch.md
         .forge/{date}/{slug}/research-stack.md
         .forge/{date}/{slug}/research-patterns.md
         .forge/{date}/{slug}/research-risks.md
       </files_to_read>
       <focus>Synthesize all exploration results into a single research report</focus>
       <output_path>.forge/{date}/{slug}/research.md</output_path>
     </agent_dispatch>
     ```

4. **Validate references**
   - PM reads only the References section of research.md (not the full file).
   - For each file path in References, run Glob to confirm it exists.
   - Remove any references that do not resolve.

5. **Update meta.json**
   - Set `state: "researched"`, `current_step: 2`.

### File-Based Communication
```
PM ──(dispatch)──> researcher-1 (haiku) ──(writes)──> research-arch.md
PM ──(dispatch)──> researcher-2 (haiku) ──(writes)──> research-stack.md
PM ──(dispatch)──> researcher-3 (haiku) ──(writes)──> research-patterns.md
PM ──(dispatch)──> researcher-4 (haiku) ──(writes)──> research-risks.md
                        │
PM ──(dispatch)──> synthesizer (sonnet)
                   reads: research-arch.md, research-stack.md, ...
                   writes: research.md
PM <──(path)────── synthesizer returns: ".forge/.../research.md"
PM reads: research.md summary section only (<=20 lines)
```

### Output
- `.forge/{date}/{slug}/research.md` (final synthesized report, <=300 lines)
- Intermediate files: `research-arch.md`, `research-stack.md`, etc. (kept for traceability)

### User Output
```
Research complete.
  HIGH findings: {N}
  MEDIUM findings: {N}
  LOW findings: {N}
  Key issue: {title of H1 finding}
```

### Error Handling
- If an exploration agent times out: proceed with remaining agents' results.
- If synthesis agent fails: attempt synthesis with a fallback model (haiku with combined prompt).
- If zero HIGH findings for a code-type request: flag as unusual, proceed with a warning to planner.

### Next
Proceed to **Step 3: PLAN**.
<!-- STEP_2_END -->

---

<!-- STEP_3_START -->
## Step 3: PLAN

### Load
- `references/execution-flow.md` (this section only)
- `research.md` (summary section only, <=20 lines — DO NOT load the full file)
- `templates/plan.md` (template structure)

### Prerequisites
- meta.json `state` is `"researched"` and `current_step` is 2.
- `research.md` exists in the artifact directory.
- Skip conditions NOT met: no `--direct`, no `--from plan.md`.

### Actions
0. **Model selection for planner**
   - If scale is medium or large: use opus (not sonnet)
   - If `--model quality`: use opus
   - If `--model budget`: use sonnet
   - Otherwise: apply Smart Routing (`references/model-routing.md`) — calculate complexity score

1. **Dispatch planner agent (sonnet or opus)**
   - Model selection determined by action 0 above.
   ```xml
   <agent_dispatch>
     <role>planner</role>
     <task_id>plan</task_id>
     <files_to_read>
       .forge/{date}/{slug}/research.md
       resources/type-guides.md ({type} section only)
       templates/plan.md
     </files_to_read>
     <type>{detected type}</type>
     <scale>{detected scale}</scale>
     <paradigm>{detected paradigm}</paradigm>
     <output_path>.forge/{date}/{slug}/plan.md</output_path>
   </agent_dispatch>
   ```

1b. **Check memory for relevant patterns**
   - If `.forge/memory/patterns.json` exists:
     - Read patterns matching the current domain/tags
     - Pass relevant pattern entries to planner as additional context
   - If `.forge/memory/failures.json` exists:
     - Read failures matching the current domain
     - Pass as "avoid these approaches" context to planner

2. **Verify plan structure** (PM reads plan.md summary, not full content)
   - Confirm YAML frontmatter contains `must_haves` (truths, artifacts, key_links).
   - Confirm all tasks have the Deep Work structure: `<read_first>`, `<action>`, `<acceptance_criteria>`.
   - Confirm wave numbers are assigned.
   - Confirm `[REF:Hx,Mx]` tags are present linking back to research findings.
   - If any structural issue: send feedback to planner for immediate correction (not counted as plan revision).

2b. **Questioning methodology**
   - If the request has ambiguous aspects AND `--discuss` was used (or `auto_discuss` config is true):
     - Load `references/questioning.md`
     - Apply dream extraction principles to clarify requirements
     - Write `context.md` with locked decisions before planning
   - If neither `--discuss` nor `auto_discuss`: skip (existing behavior)

3. **Update meta.json**
   - Set `state: "planned"`, `current_step: 3`.
   - Record task count, wave count, phase count.

### File-Based Communication
```
PM ──(dispatch)──> planner (sonnet/opus)
                   reads: research.md, type-guide, plan template
                   writes: plan.md
PM <──(path)────── planner returns: ".forge/.../plan.md"
PM reads: plan.md YAML frontmatter + task count only
```

### Output
- `.forge/{date}/{slug}/plan.md` (complete plan with must_haves + deep work tasks)

### User Output
```
Plan created.
  Phases: {N}
  Tasks:  {N} (across {W} waves)
  Must-haves: {N} truths, {N} artifacts, {N} key_links
```

### Error Handling
- If planner produces an empty or malformed plan: retry once with opus model.
- If planner cannot create tasks from research (e.g., analysis type with no actionable findings): report to user and suggest switching to `analysis` type.

### Next
Proceed to **Step 4: PLAN-CHECK** (unless `--direct` is set, in which case skip to Step 5).
<!-- STEP_3_END -->

---

<!-- STEP_4_START -->
## Step 4: PLAN-CHECK

### Load
- `references/execution-flow.md` (this section only)

### Prerequisites
- meta.json `state` is `"planned"` and `current_step` is 3.
- `plan.md` exists in the artifact directory.
- Skip conditions NOT met: no `--direct` flag.

### Actions
1. **Dispatch plan-checker agent (sonnet)**
   ```xml
   <agent_dispatch>
     <role>plan-checker</role>
     <task_id>plan-check</task_id>
     <files_to_read>
       .forge/{date}/{slug}/plan.md
       .forge/{date}/{slug}/research.md
     </files_to_read>
     <scale>{detected scale}</scale>
     <output_path>.forge/{date}/{slug}/plan.md</output_path>
     <output_mode>append</output_mode>
   </agent_dispatch>
   ```

2. **Handle result (PM reads only the verdict line, not the full check details)**
   - **PASS** (8/8 or 7/8 with 1 warning): proceed to Step 5.
   - **NEEDS_REVISION**: enter revision loop.
   - **FAIL** (3+ dimensions failed): escalate to user.

3. **Revision loop (max 3 iterations)**
   ```
   Iteration 1:
     plan-checker returns NEEDS_REVISION with specific feedback
     PM dispatches planner with feedback + plan.md path
     planner rewrites plan.md
     PM dispatches plan-checker again
     Increment revisions.plan in meta.json

   Iteration 2: same as above
   Iteration 3: if still NEEDS_REVISION, escalate to user
   ```

4. **Scale-based simplification**
   - `small` scale: only check D1 (Requirement Coverage), D2 (Task Completeness), D5 (Scope Sanity), D7 (Deep Work Compliance).
   - `medium/large` scale: full 8-dimension check.

5. **Update meta.json**
   - Set `state: "plan_checked"`, `current_step: 4`.
   - Record `revisions.plan` count.

5b. **Test coverage audit (if not `--skip-tests`)**
   - Dispatch test-auditor agent:
     ```xml
     <agent_dispatch>
       <role>test-auditor</role>
       <task_id>test-audit</task_id>
       <files_to_read>
         .forge/{date}/{slug}/plan.md
         {relevant source file paths from plan}
         {existing test file paths}
       </files_to_read>
       <output_path>.forge/{date}/{slug}/validation.md</output_path>
     </agent_dispatch>
     ```
   - If **CRITICAL_GAPS** found: add test tasks to plan (revision loop)
   - If **IMPORTANT_GAPS** found: add as warnings in plan.md
   - If **PASS**: proceed

### File-Based Communication
```
PM ──(dispatch)──> plan-checker (sonnet)
                   reads: plan.md, research.md
                   writes: verdict appended to plan.md
PM <──(path)────── plan-checker returns: ".forge/.../plan.md"
PM reads: verdict line only ("Overall: PASS/NEEDS_REVISION/FAIL")

[If NEEDS_REVISION]:
PM ──(dispatch)──> planner (sonnet)
                   reads: plan.md (with feedback appended), research.md
                   writes: revised plan.md
PM ──(dispatch)──> plan-checker (sonnet)  [repeat]
```

### Output
- `plan.md` (verified, with plan-check results appended at the bottom)

### User Output
```
Plan verification (8D):
  D1 Requirements: {status}  D5 Scope:    {status}
  D2 Completeness: {status}  D6 Verify:   {status}
  D3 Dependencies: {status}  D7 DeepWork: {status}
  D4 Key Links:    {status}  D8 Tests:    {status}
  Overall: {PASS|NEEDS_REVISION} (revisions: {N}/3)
```

### Error Handling
- If plan-checker agent times out: retry once, then proceed with a warning.
- If revision loop exhausts 3 attempts: notify user with the specific failing dimensions and ask for manual plan adjustments.
- If plan-checker returns FAIL on first check: present the failure details to the user before attempting any revision.

### Next
Proceed to **Step 5: CHECKPOINT**.
<!-- STEP_4_END -->

---

<!-- STEP_5_START -->
## Step 5: CHECKPOINT

### Load
- `references/execution-flow.md` (this section only)
- `plan.md` (summary: task count, wave count, phase names only)

### Prerequisites
- meta.json `state` is `"plan_checked"` (or `"planned"` if `--direct` skipped plan-check).
- `plan.md` exists and has passed verification (or verification was skipped).

### Actions
1. **Small scale: auto-proceed**
   - Display a brief summary and proceed to Step 6 without user confirmation.
   - Log: "Auto-proceeding (small scale)."

2. **Medium/Large scale: present choices**
   - Display plan summary to user:
     ```
     --- Execution Plan Summary ---
     Phases:    {N}
     Tasks:     {N} (across {W} waves)
     Est. mode: {subagent|team}
     Paradigm:  {paradigm}

     [1] Execute  -- proceed with this plan
     [2] Modify   -- revise the plan (returns to Step 3)
     [3] Cancel   -- abort this Forge execution
     ```
   - Wait for user selection.

3. **Handle user choice**
   - **Execute**: update meta.json, proceed to Step 6.
   - **Modify**: collect user feedback, return to Step 3 (planner re-runs with feedback). Increment `revisions.plan`.
   - **Cancel**: update meta.json `state: "cancelled"`, display cancellation message, stop.

4. **Update meta.json**
   - Set `state: "checkpoint_passed"`, `current_step: 5`.

### File-Based Communication
```
No agent dispatch in this step.
PM communicates directly with the user.
```

### Output
- User decision recorded in meta.json.

### User Output
- Plan summary + choice prompt (medium/large).
- Brief summary only (small).

### Error Handling
- If user provides unclear input: re-present the 3 options.
- If user requests modifications: collect specific feedback before returning to Step 3.

### Next
Proceed to **Step 6: BRANCH**.
<!-- STEP_5_END -->

---

<!-- STEP_6_START -->
## Step 6: BRANCH

### Load
- `references/execution-flow.md` (this section only)

### Prerequisites
- meta.json `state` is `"checkpoint_passed"` and `current_step` is 5.

### Actions
1. **Check git status**
   - Run `git status` to confirm working tree is clean.
   - If uncommitted changes exist: warn the user and ask whether to stash, commit, or proceed anyway.

2. **Determine branch strategy**
   - If already on a feature branch: ask user whether to use the current branch or create a new one.
   - If on main/master: create `feature/{slug}`.
   - If the user declines branch creation: skip and proceed on current branch.

3. **Create branch**
   - Run `git checkout -b feature/{slug}`.
   - Update meta.json `git.branch`.

4. **Update meta.json**
   - Set `state: "branched"`, `current_step: 6`.

### File-Based Communication
```
No agent dispatch in this step.
PM executes git commands directly.
```

### Output
- New git branch (if created).
- meta.json updated with branch name.

### User Output
```
Branch: feature/{slug} (created)
```
Or:
```
Using current branch: {current_branch}
```

### Error Handling
- If `git checkout -b` fails (branch exists): append timestamp, e.g., `feature/{slug}-1430`.
- If git is not initialized: skip branch creation, warn user.

### Next
Proceed to **Step 7: EXECUTE**.
<!-- STEP_6_END -->

---

<!-- STEP_7_START -->
## Step 7: EXECUTE (Wave-Based Parallel Execution)

### Load
- `references/execution-flow.md` (this section only)
- `references/wave-execution.md` (full reference for wave rules)
- `references/deviation-rules.md` (full reference for deviation handling)

### Prerequisites
- meta.json `state` is `"branched"` (or `"checkpoint_passed"` if branch was skipped).
- `plan.md` exists with verified tasks and wave assignments.

### Actions

#### 7.1 Wave Loop (outer loop)
```
for wave_number in 1..total_waves:
    wave_tasks = tasks where wave == wave_number
    parallel_batches = split wave_tasks into batches of max 3

    for batch in parallel_batches:
        execute batch tasks in parallel (see 7.2)

    run wave boundary QA (see 7.3)
    commit wave changes (see 7.4)
    report wave progress to user (see 7.5)

    update meta.json: waves.current, waves.completed
```

#### 7.2 Per-Task Execution Cycle (runs in parallel within a batch, max 3 concurrent)

**Phase A: Implementation**
```xml
<agent_dispatch>
  <role>implementer</role>
  <task_id>{N-M}</task_id>
  <files_to_read>
    .forge/{date}/{slug}/plan.md (task [{N-M}] section only)
    {task.read_first files}
    {task.files}
    checklists/{lang}.md
    checklists/general.md
  </files_to_read>
  <deviation_rules>references/deviation-rules.md</deviation_rules>
  <output_path>.forge/{date}/{slug}/task-{N-M}-summary.md</output_path>
</agent_dispatch>
```
- Implementer reads the specified files directly (PM does NOT load them).
- Implementer follows Deep Work structure: read `<read_first>` files, then execute `<action>` items, then verify `<acceptance_criteria>`.
- Implementer writes `task-{N-M}-summary.md` with: Changes Made, Deviations, Self-Check Results, Acceptance Criteria Status.

**Phase A.5: Backpressure Gate**

> Load `references/backpressure.md` for detailed rules.
> Skip if: type is docs/analysis/design, or --quick mode, or config backpressure.enabled=false.

After the implementer returns, before dispatching code-reviewer:

1. **Build Check:**
   - Run the project's build command
   - If FAIL → dispatch fresh implementer with build error → retry (max 3)
   - If 3 fails → strategy change: dispatch with all failure summaries → retry (max 3 more)
   - If 6 total fails → mark task BACKPRESSURE_FAILED, escalate to user

2. **Test Check** (skip if --skip-tests):
   - Identify tests related to task's changed files
   - Run identified tests
   - If FAIL → dispatch fresh implementer with test failures → retry (same loop as build)

3. **Lint Check** (only if config backpressure.checks.lint=true):
   - Run linter on changed files
   - If FAIL → dispatch fresh implementer with lint errors → retry

4. **Completion Promise fulfilled** → proceed to Phase B (Code Review)

**Backpressure recording:**
- Append to trace.jsonl: `{"agent":"implementer","task_id":"{id}","result":"BACKPRESSURE_FAIL","check":"{build|test|lint}","attempt":{N}}`
- Record final results in task-summary.md under `## Backpressure Results`

**Phase B: Deviation Handling (within implementer)**
- **R1 (Bug found):** Auto-fix, record `[DEVIATION:R1]` in summary. Continue.
- **R2 (Missing feature):** Auto-add, record `[DEVIATION:R2]` in summary. Continue.
- **R3 (Blocking issue):** Auto-resolve, record `[DEVIATION:R3]` in summary. Continue.
- **R4 (Architecture change needed):** STOP immediately. Record `[DEVIATION:R4:BLOCKED]`. Return to PM.
- Auto-fix limit per task: 3 attempts. If exceeded, document and move on.
- Scope boundary: only fix issues directly caused by the current task.

**Phase B2: Self-Reflection Verification (after implementer returns, before code-review)**
- PM reads implementer's `task-{N-M}-summary.md` Self-Reflection section.
- If any `acceptance_criteria` scores < 0.7 AND marked `[LOW_CONFIDENCE]`:
  - Flag to code-reviewer with extra scrutiny instruction
- If overall confidence < 0.5:
  - Do NOT send to code-reviewer yet
  - Ask user: "Implementer reports low confidence on task {id}. Review partial work or retry?"

**Phase B3: Smart Model Routing (before each agent dispatch)**
- If `--model balanced` (default):
  1. Calculate complexity score per `references/model-routing.md`:
     - `files_count` from task `<files>` tag
     - `depends_on` count
     - `domain_novelty`: check `.forge/memory/patterns.json` for matching patterns (no match = novel)
     - `security_sensitive`: auth/crypto/payment keywords in task name or files
  2. Apply per-agent adjustment (planner +1, researcher -2, debugger +2, etc.)
  3. Select model: 0-3=haiku, 4-6=sonnet, 7-10=opus
- If `--model quality`: always opus
- If `--model budget`: always haiku

**Phase C: Code Review**
```xml
<agent_dispatch>
  <role>code-reviewer</role>
  <task_id>{N-M}-review</task_id>
  <files_to_read>
    .forge/{date}/{slug}/task-{N-M}-summary.md
    .forge/{date}/{slug}/plan.md (must_haves section only)
    {changed files from summary}
    checklists/{lang}.md
    checklists/general.md
  </files_to_read>
  <output_path>.forge/{date}/{slug}/task-{N-M}-summary.md</output_path>
  <output_mode>append</output_mode>
</agent_dispatch>
```
- Code reviewer performs 10-perspective review (style, bugs, security, perf, plan alignment, TDD, SOLID, error handling, goal-backward wiring, anti-pattern scan).

**Phase D: Review Result Handling**
```
if PASS:
    mark task as complete in meta.json
    stage and commit: "{type}({scope}): {task description}"

if NEEDS_REVISION (minor):
    send reviewer feedback to implementer
    implementer revises (fresh agent invocation with feedback)
    re-run code review
    max 5 minor revision cycles
    if exceeded: upgrade model and try once more, then escalate

if NEEDS_REVISION (major):
    send reviewer feedback to implementer
    implementer revises with expanded context
    re-run code review
    max 3 major revision cycles
    if exceeded: escalate to user

if REJECT:
    max 2 reject cycles
    if exceeded: mark task as blocked, escalate to user
    user chooses: redesign task / skip task / manual intervention
```

**Phase E: Trace Recording (after each agent returns)**
- Append to `trace.jsonl` after every agent dispatch completes:
  ```
  echo '{"timestamp":"{ISO}","execution_id":"{slug}","step":7,"wave":{N},"agent":"{role}","task_id":"{N-M}","model":"{model}","input_files":[...],"output_file":"{path}","verdict":"{PASS|NEEDS_REVISION|REJECT}","revision":{cycle},"duration_ms":{ms},"error":null}' >> .forge/{date}/{slug}/trace.jsonl
  ```
- Trace covers all agents: implementer, code-reviewer, qa-inspector, verifier, etc.
- Used by `forge-tools.js metrics-summary` for cost analysis and adaptive routing.

#### 7.3 Wave Boundary QA Gate
After all tasks in a wave are complete (or blocked):
```xml
<agent_dispatch>
  <role>qa-inspector</role>
  <task_id>qa-wave-{wave_number}</task_id>
  <files_to_read>
    .forge/{date}/{slug}/task-{N-M}-summary.md (all tasks in this wave)
    {all files modified in this wave}
  </files_to_read>
  <output_path>.forge/{date}/{slug}/qa-report-wave-{wave_number}.md</output_path>
</agent_dispatch>
```
- QA inspector runs: build verification, test execution, caller impact analysis, anti-pattern scan.
- Result handling:
  - **PASS:** proceed to next wave.
  - **GAPS_FOUND:** create targeted fix tasks, execute them, re-run QA (max 2 retries).
  - **BUILD_FAILED:** apply Tier 1 recovery (error analysis, auto-fix). If fails, Tier 2 (alternative approach). If fails, Tier 3 (user intervention).

#### 7.4 Wave Commit
- After QA passes: create a wave-level commit if individual task commits already exist, no additional commit needed.
- If task-level commits are not yet made (batch mode): create a single commit for the wave: `feat({slug}): complete wave {N}`.
- Update meta.json `git.commits`.

#### 7.5 Wave Progress Report to User
```
--- Wave {N}/{total} Complete ---
Tasks:     {completed}/{total_in_wave}
Revisions: {minor}m {major}M {reject}R
Deviations: {count} (R1:{n} R2:{n} R3:{n})
QA:        {PASS|GAPS_FOUND}
Cumulative: {total_completed}/{total_tasks} tasks done
---
```

#### 7.6 R4 Deviation Handling (Architecture Change Needed)
If any implementer reports `[DEVIATION:R4:BLOCKED]`:
1. PM pauses the affected task (other tasks in the wave continue).
2. PM reads the task summary to understand the blocking issue.
3. PM presents the situation to the user with options:
   ```
   [1] Approve the architecture change (PM adds a new task)
   [2] Skip this task
   [3] Provide alternative approach
   [4] Cancel execution
   ```
4. Based on user choice, PM either creates a new task, skips, or stops.

#### 7.7 Overall Execution Limits
| Limit | Threshold | Action on Exceed |
|---|---|---|
| Minor revisions per task | 5 | Upgrade model, try once more, then escalate |
| Major revisions per task | 3 | Escalate to user |
| Rejects per task | 2 | Escalate to user |
| QA retries per wave | 2 | Escalate to user |
| Deviation auto-fixes per task | 3 | Document and proceed to next task |
| Deviation auto-fixes per execution | 10 | Warn user, continue with documentation |

### 7.8 Resume Protocol

**Applies when meta.json `tasks.completed_tasks[]` is non-empty (resumed execution).**

1. Read `completed_tasks` array from meta.json
2. For each completed task ID: mark as `<done>true</done>` in the task tracking
3. When building wave assignments: skip all completed tasks
4. Identify the first incomplete task and its wave number
5. Start execution from that wave (all earlier waves are already done)
6. Display:
   ```
   Resuming execution from task {first_incomplete_id} (wave {wave_N}).
   {completed_count}/{total_count} tasks already completed.
   Commits from previous run: {git.commits from meta.json}
   ```
7. Resume the wave loop from the identified wave

**Resume safety rules:**
- If a completed task's files have been modified since the last commit: warn the user
- If plan.md has been modified since the lock was created: ask user to confirm
- Re-run QA gate on the last completed wave before continuing (quick check only)

---

### 7.9 Per-Task Atomic Commit

**After each task passes code review (or self-check in quick/no-review mode):**

1. **Stage files:** Run `git add` on only the files listed in the task's `<files>` section
2. **Commit** with the format:
   - `feat({slug}/{task_id}): {task_name}` — for type: code
   - `fix({slug}/{task_id}): {task_name}` — for type: code-bug
   - `refactor({slug}/{task_id}): {task_name}` — for type: code-refactor
   - `docs({slug}/{task_id}): {task_name}` — for type: docs
   - `chore({slug}/{task_id}): {task_name}` — for type: infra
3. **Record** commit hash in meta.json `git.commits[]`
4. **Track** task ID in meta.json `tasks.completed_tasks[]`
5. **Handle failures:**
   - If `git add` finds nothing to stage: log "No file changes for task {id}" in trace.jsonl, skip commit
   - If commit fails: log warning, do NOT block execution — wave-level commit at boundary will catch it

**Atomic commit benefits:**
- `git bisect` identifies exactly which task introduced a regression
- Individual tasks revertable: `git revert {commit_hash}`
- meta.json `completed_tasks[]` enables resume from any point
- Commit history documents implementation sequence

**Disabling:** Set `config.json: atomic_commits.enabled: false` to skip per-task commits. Falls back to wave-level commit at boundary.

---

### 7.10 Dispatch Tracing

**After each agent dispatch (implementer, code-reviewer, qa-inspector), append to trace.jsonl:**

```json
{"agent":"{role}","task_id":"{id}","model":"{model}","timestamp":"{ISO}","result":"{PASS|REVISION|BLOCKED|STUCK}","wave":{N}}
```

**Tracing rules:**
- One line per dispatch (JSONL format, not JSON array)
- Include revision dispatches (same task_id, incremented attempt)
- Record STUCK events as result type
- At Step 9 (FINALIZE): aggregate trace.jsonl for the Token/Cost section in report.md
- trace.jsonl is append-only — never truncate during execution

### File-Based Communication
```
Per task cycle:
  PM ──(dispatch)──> implementer ──(writes)──> task-{N-M}-summary.md + code changes
  PM ──(dispatch)──> code-reviewer ──(appends)──> task-{N-M}-summary.md
  PM reads: review verdict only (PASS/NEEDS_REVISION/REJECT)

Per wave boundary:
  PM ──(dispatch)──> qa-inspector ──(writes)──> qa-report-wave-{N}.md
  PM reads: QA verdict only (PASS/GAPS_FOUND/BUILD_FAILED)
```

### Output
- `task-{N-M}-summary.md` for each task (implementation details + review results)
- `qa-report-wave-{N}.md` for each wave
- Git commits (per task or per wave)
- meta.json updated with progress

### User Output
- Per-wave progress report (see 7.5).
- Per-task status updates during execution: `[{N-M}] implementing... | reviewing... | done | blocked`.
- R4 deviation prompts when they occur.

### Error Handling
- If an implementer agent times out: retry once with the same model, then escalate.
- If a code-reviewer agent times out: retry once, then mark as PASS with a warning.
- If git commit fails: retry once, then warn user and continue.
- If all tasks in a wave fail: stop execution, report to user.
- Follow the 3-tier escalation: Tier 1 (auto-recover) -> Tier 2 (alternative approach) -> Tier 3 (user intervention).

### Next
After all waves complete, proceed to **Step 8: VERIFY**.
<!-- STEP_7_END -->

---

<!-- STEP_8_START -->
## Step 8: VERIFY (Goal-Backward Verification)

### Load
- `references/execution-flow.md` (this section only)
- `plan.md` (must_haves section only — YAML frontmatter)

### Prerequisites
- meta.json `state` is `"executing"` and all waves are completed.
- All tasks are either `complete` or `blocked/skipped`.
- Skip conditions: `docs`, `analysis`, `design` types skip this step.

### Actions
1. **Dispatch verifier agent (sonnet)**
   ```xml
   <agent_dispatch>
     <role>verifier</role>
     <task_id>verify</task_id>
     <files_to_read>
       .forge/{date}/{slug}/plan.md
       {all files listed in must_haves.artifacts[].path}
       {all files listed in must_haves.key_links[].from}
       {all files listed in must_haves.key_links[].to}
     </files_to_read>
     <output_path>.forge/{date}/{slug}/verification.md</output_path>
   </agent_dispatch>
   ```

2. **Verifier executes 3-level check:**
   - **Level 1 (EXISTS):** Do all `must_haves.artifacts` files exist? Do they meet `min_lines`?
   - **Level 2 (SUBSTANTIVE):** Do `exports` actually exist in those files? Are there stub patterns (TODO, placeholder, empty return)?
   - **Level 3 (WIRED):** Do `key_links` patterns match in the `from` files? Are imports actually used (not just declared)?
   - **Truths verification:** Are `must_haves.truths` supported by code and/or passing tests?

3. **Handle verifier result (PM reads verdict line only)**
   - **VERIFIED:** proceed to Step 9.
   - **GAPS_FOUND:** create gap-fix tasks, return to Step 7 for a targeted mini-execution (max 2 cycles).
   - **FAILED:** escalate to user with the specific failures.

4. **Update meta.json**
   - Set `state: "verified"`, `current_step: 8`.

### File-Based Communication
```
PM ──(dispatch)──> verifier (sonnet)
                   reads: plan.md (must_haves), artifact files, key_link files
                   writes: verification.md
PM <──(path)────── verifier returns: ".forge/.../verification.md"
PM reads: verdict line only ("Verdict: VERIFIED/GAPS_FOUND/FAILED")

[If GAPS_FOUND]:
PM creates gap-fix tasks in plan.md
PM returns to Step 7 for targeted execution
PM re-dispatches verifier after fixes
```

### Output
- `.forge/{date}/{slug}/verification.md` (3-level verification results)

### User Output
```
--- Goal-Backward Verification ---
Level 1 (Exists):      {N}/{N} passed
Level 2 (Substantive): {N}/{N} passed
Level 3 (Wired):       {N}/{N} passed
Truths:                {N}/{N} passed
Verdict: {VERIFIED|GAPS_FOUND|FAILED}
---
```

### Error Handling
- If verifier agent times out: retry once, then run a simplified check (Level 1 only) directly.
- If gap-fix cycle exceeds 2 iterations: escalate to user with remaining gaps.
- If FAILED on Level 1 (files missing): this is critical — do not attempt automatic recovery, escalate immediately.

### Next
Proceed to **Step 9: FINALIZE**.
<!-- STEP_8_END -->

---

<!-- STEP_9_START -->
## Step 9: FINALIZE

### Load
- `references/execution-flow.md` (this section only)
- `templates/report.md` (report template)
- `references/learning-system.md` (LEARNING and MEMORY sections — for metrics + memory writes)

### Prerequisites
- meta.json `state` is `"verified"` (or `"executing"` if verification was skipped for docs/analysis/design types).
- All execution steps are complete.

### Actions
1. **Generate final report**
   - Read `templates/report.md` for the output structure.
   - Aggregate data from:
     - All `task-{N-M}-summary.md` files (file paths only, read as needed).
     - `qa-report-wave-{N}.md` files.
     - `verification.md`.
     - meta.json (task stats, revision counts).
   - Write `report.md` to artifact directory.
   - Report sections:
     - Overview (request, type, scale, paradigm)
     - Task Results (per-task status table)
     - Traceability Matrix (research finding -> task -> verification)
     - Wave Execution Summary (per-wave stats)
     - Deviations Log (all [DEVIATION:Rx] entries)
     - Verification Summary (Level 1/2/3 results)
     - Lessons Learned (repeated issues, model upgrades triggered)

2. **Update project-profile.json**
   - If new patterns or conventions were discovered: update the cache.
   - If model upgrades were triggered: record for future reference.

3. **Mark plan tasks as complete**
   - In plan.md: update `<done>false</done>` to `<done>true</done>` for completed tasks.

4. **Suggest PR (code/infra types only)**
   - If a feature branch was created: suggest creating a pull request.
   - Display: branch name, total commits, changed files summary.
   - User can accept (PM creates PR) or decline.

5. **Update meta.json**
   - Set `state: "completed"`, `current_step: 9`.
   - Record final statistics.

6. **Record execution metrics**
   - Calculate `quality_score`:
     ```
     quality_score = 1.0
       - (minor_revisions * 0.02)
       - (major_revisions * 0.10)
       - (deviations_R1 * 0.01)
       - (deviations_R2 * 0.02)
       - (deviations_R3 * 0.03)
       - (deviations_R4 * 0.15)
       + (verification == "VERIFIED" ? 0.05 : 0)
       clamp to [0.0, 1.0]
     ```
   - Run: `node forge-tools.js metrics-record '{"id":"{slug}","date":"{date}","type":"{type}","scale":"{scale}","tasks":{N},"revisions":{"minor":{N},"major":{N}},"deviations":{"R1":{N},"R2":{N},"R3":{N},"R4":{N}},"verification":"{verdict}","quality_score":{score}}'`

7. **Update memory (learning system)**
   - a. If verification == `"VERIFIED"` AND `quality_score > 0.8`:
     - Extract successful patterns from plan.md (approach, architecture choices)
     - Append to `.forge/memory/patterns.json` via `forge-tools.js` or direct write
   - b. If any deviation R4 occurred:
     - Record the blocked approach and why it failed
     - Append to `.forge/memory/failures.json`
   - c. If architectural decisions were made during execution:
     - Extract from `context.md` or plan.md frontmatter
     - Append to `.forge/memory/decisions.json`
   - d. Initialize memory files if they don't exist:
     ```bash
     mkdir -p .forge/memory
     # If patterns.json missing: write {"patterns":[]}
     # If failures.json missing: write {"failures":[]}
     # If decisions.json missing: write {"decisions":[]}
     ```

8. **Retrospective trigger (project mode only)**
   - If this execution completed the last phase in a milestone:
     - Display: "Milestone complete. Run `/forge --retrospective` for analysis."
     - If in autonomous mode: auto-trigger retrospective (load `references/learning-system.md` §3 RETROSPECTIVE)
   - If not the last phase: skip

### File-Based Communication
```
PM reads task-summary and QA report file paths from meta.json.
PM reads templates/report.md for structure.
PM writes report.md directly (no agent dispatch needed for small/medium).

For large scale: dispatch a sonnet agent to compile the report:
  PM ──(dispatch)──> reporter (sonnet)
                     reads: all task summaries, QA reports, verification.md
                     writes: report.md
```

### Output
- `.forge/{date}/{slug}/report.md` (final comprehensive report)
- `.forge/{date}/{slug}/trace.jsonl` (execution trace from Step 7)
- `.forge/metrics.json` (updated with execution metrics)
- `.forge/memory/patterns.json` (updated if quality > 0.8)
- `.forge/memory/failures.json` (updated if R4 deviations occurred)
- `.forge/memory/decisions.json` (updated if architectural decisions made)
- Updated `plan.md` (tasks marked as done)
- Updated `project-profile.json` (if changes detected)

### User Output
```
--- Forge Complete ---
Tasks: {completed}/{total} completed, {failed} failed, {skipped} skipped
Waves: {total_waves} executed
Revisions: {plan}P {minor}m {major}M {reject}R
Deviations: {total} (R1:{n} R2:{n} R3:{n} R4:{n})
Verification: {VERIFIED|GAPS_FOUND|N/A}

Report: .forge/{date}/{slug}/report.md
Branch: feature/{slug} ({N} commits)

Create PR? [Y/n]
---
```

### Error Handling
- If report generation fails: create a minimal report with just the task status table.
- If PR creation fails: display the error and provide the manual command.
- If plan.md update fails: non-critical, continue.

### Next
Proceed to **Step 10: CLEANUP**.
<!-- STEP_9_END -->

---

<!-- STEP_10_START -->
## Step 10: CLEANUP

### Load
- Nothing. This step requires no external file loading.

### Prerequisites
- meta.json `state` is `"completed"` and `current_step` is 9.

### Actions

### 10.1 Lock Cleanup

1. Run `forge-tools.js remove-lock {artifact_dir}` to delete execution-lock.json
2. If removal fails: log warning "Lock cleanup failed: {error}" — do NOT fail the cleanup step
3. Lock removal signals clean completion — future sessions will not detect a crashed execution

1. **Clean up intermediate files**
   - Remove exploration-phase intermediate files: `research-arch.md`, `research-stack.md`, `research-patterns.md`, `research-risks.md`.
   - Keep all final artifacts: `meta.json`, `research.md`, `plan.md`, `task-*-summary.md`, `qa-report-*.md`, `verification.md`, `report.md`.

2. **Agent cleanup (team mode only)**
   - If team mode was used: send termination messages to persistent agents.
   - Wait 30 seconds, then delete the team.

**Project Transition (project mode only)**

If `.forge/project.json` exists AND this execution was a phase (meta.json has phase_ref):

1. **Update roadmap.md:**
   - Find the current phase entry
   - Set status to "completed"
   - Update Plans count

2. **Update state.md:**
   - Advance Current Position to next phase (or milestone complete)
   - Add Session History entry: "{date} {time}: Phase {N} ({name}) completed"
   - Update Next Action: "Start Phase {N+1}" or "Run milestone verification"
   - Recalculate progress bar

3. **Update project.json:**
   - stats.completed_phases++
   - stats.completed_tasks += tasks completed in this phase
   - If all phases in current milestone are completed:
     → current_phase = (first phase of next milestone, or same if no next)

4. **Milestone boundary notification:**
   If this was the LAST phase in the current milestone:
   - Display: "All phases in Milestone {N} ({name}) are complete."
   - Suggest: "Run `/forge --milestone` to verify integration."

5. **Autonomous mode return:**
   If this execution was triggered by autonomous mode (project-lifecycle.md §3):
   - Return control to the autonomous loop
   - The loop will handle milestone verification and next phase selection

If NOT in project mode: skip this step entirely.

3. **Final meta.json update**
   - Set `state: "closed"`, `current_step: 10`.
   - Record `completed_at` timestamp.
   - Record `steps_completed` array: `["init", "research", "plan", "plan_check", "checkpoint", "branch", "execute", "verify", "finalize", "cleanup"]`.

4. **Optional: collect user feedback**
   - If the user is still engaged: ask for a 1-5 satisfaction rating.
   - Record in meta.json `feedback` field.

### File-Based Communication
```
No agent dispatch in this step.
PM performs all cleanup actions directly.
```

### Output
- meta.json (final state)
- Intermediate files removed

### User Output
```
Cleanup complete. All artifacts saved to:
  .forge/{date}/{slug}/
```

### Error Handling
- If file deletion fails: non-critical, log and continue.
- If team deletion fails: log a warning.
- Cleanup should never fail the overall execution — all errors are logged but do not block.

### Next
Execution complete. PM returns control to the user.
<!-- STEP_10_END -->

---

## Appendix: Step Transition Quick Reference

```
INIT (1) ──> RESEARCH (2) ──> PLAN (3) ──> PLAN-CHECK (4) ──> CHECKPOINT (5)
                                                                     │
                    ┌────────────────────────────────────────────────┘
                    v
              BRANCH (6) ──> EXECUTE (7) ──> VERIFY (8) ──> FINALIZE (9) ──> CLEANUP (10)
                                  ^                │
                                  │                │
                                  └── GAPS_FOUND ──┘

Skip paths:
  --direct:       INIT -> BRANCH -> EXECUTE -> VERIFY -> FINALIZE -> CLEANUP
  --no-research:  INIT -> PLAN -> PLAN-CHECK -> CHECKPOINT -> BRANCH -> ...
  --from plan.md: INIT -> CHECKPOINT -> BRANCH -> EXECUTE -> ...
  --quick:        INIT -> PLAN (single task) -> BRANCH -> EXECUTE -> FINALIZE -> CLEANUP
  docs type:      INIT -> RESEARCH -> PLAN -> CHECKPOINT -> BRANCH -> EXECUTE -> FINALIZE -> CLEANUP
  analysis type:  INIT -> RESEARCH -> FINALIZE -> CLEANUP

Standalone pipelines (Step 0 routes, no standard pipeline):
  --debug:          Step 0 -> debug-pipeline.md (DEBUG_PIPELINE)
  --map:            Step 0 -> codebase-mapping.md (CODEBASE_MAP)
  --retrospective:  Step 0 -> learning-system.md (RETROSPECTIVE)
```

## Appendix: meta.json State Machine

```
init -> researched -> planned -> plan_checked -> checkpoint_passed -> branched
  -> executing -> verified -> completed -> closed

Special states:
  cancelled   (user cancelled at checkpoint)
  failed      (unrecoverable error)
  paused      (user requested pause or R4 deviation)
```
