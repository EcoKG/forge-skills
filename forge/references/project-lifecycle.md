# Project Lifecycle Reference

> **Loading Rule:** PM loads ONLY the relevant section using markers like `PROJECT_INIT_START` / `PROJECT_INIT_END`.
> Never load the entire file at once. Each section is self-contained.

---

<!-- PROJECT_INIT_START -->
## 1. Project Initialization (/forge --init)

### Load
- This section only
- `templates/project.json`, `templates/roadmap.md`, `templates/state.md`

### Prerequisites
- No existing `.forge/project.json` (or user confirmed overwrite)

### Actions
1. **Check existing project**
   - Glob for `.forge/project.json`
   - If exists: AskUserQuestion — "Update existing project or create new?"
     - Update → load existing project.json, skip to step 2d (config questions)
     - New → confirm overwrite, proceed with fresh creation
   - If not exists: proceed with creation

2. **Capture project vision** (interactive questioning)
   Use AskUserQuestion for each step (concrete options, not open-ended):

   a. "What are you building?"
      - Capture: project name + description (1-2 sentences)

   b. "What's the single most important thing this project must do?"
      - Capture: core_value (1 sentence)
      - This becomes project.json `core_value`

   c. "What are the must-have features for v1?"
      - Present: domain-specific suggestions based on project type detected from description
      - Capture: requirements list with REQ-IDs (e.g., REQ-AUTH-01, REQ-DATA-01)
      - Allow user to add/remove/modify via follow-up AskUserQuestion

   d. Configuration questions (present as AskUserQuestion with defaults):
      - Granularity: `coarse` (3-5 phases) / `standard` (5-8) / `fine` (8-12) [default: standard]
      - Model profile: `quality` / `balanced` / `budget` [default: balanced]
      - Git branching: `none` / `phase` / `milestone` [default: none]

   **Alternative: `--from prd.md`**
   If `--from` is specified with a PRD/requirements document:
   - Read the PRD file
   - Extract: name, description, core_value, requirements
   - Present extracted info for user confirmation via AskUserQuestion
   - Skip interactive questioning (steps 2a-2c)
   - Still present config questions (step 2d)

3. **Create project.json**
   - Fill `templates/project.json` with captured data
   - Write to `.forge/project.json`

4. **Dispatch roadmapper agent**
   ```xml
   <agent_dispatch>
     <role>roadmapper</role>
     <files_to_read>
       .forge/project.json
       {requirements text or PRD path}
       {codebase analysis from project-profile.json if brownfield}
     </files_to_read>
     <template_path>templates/roadmap.md</template_path>
     <output_path>.forge/roadmap.md</output_path>
   </agent_dispatch>
   ```
   See `prompts/roadmapper.md` for agent behavior.

   PM reads only the summary from the output: milestone count, phase count, phase names.
   Display to user: roadmap overview table.

5. **Create state.md**
   - Fill `templates/state.md` with initial state:
     - Project name from project.json
     - Milestone 1, Phase 1, Status: pending
     - Progress: 0%
     - Next Action: "Start phase 1"
   - Write to `.forge/state.md`

6. **Display project summary**
   ```
   ━━━ Project Initialized ━━━━━━━━━━━━
   Project:    {name}
   Core Value: {core_value}
   Milestone:  {milestone_name} ({N} phases)
   Phases:     {phase list with names}
   Config:     {granularity} | {model} | git:{branching}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

7. **Workspace integration**
   - Append `templates/forge-claude-md.md` content to the project's `CLAUDE.md` (create if not exists)
     - If CLAUDE.md already has "Forge Project" section, skip (idempotent)
   - Install hooks (if not already installed):
     ```bash
     node ~/.claude/skills/forge/hooks/install.js
     ```
     - context-monitor: PostToolUse — context pressure warnings
     - statusline: Notification — project/phase status display
     - session-init: UserPromptSubmit — auto-detect project on session start

8. **Offer next step**
   AskUserQuestion: "Start Phase 1 now?"
   - Yes -> transition to `/forge --phase 1`
   - No -> done (user will invoke later)

### Error Handling
- User cancels during questioning -> clean up any partially created files
- Roadmapper fails -> display error, offer retry or manual roadmap creation
- PRD parse fails -> fall back to interactive questioning with explanation

<!-- PROJECT_INIT_END -->

---

<!-- PHASE_EXEC_START -->
## 2. Phase Execution (/forge --phase N)

### Load
- This section only
- `.forge/project.json`, `.forge/roadmap.md`, `.forge/state.md`

### Prerequisites
- `.forge/project.json` exists
- Phase N exists in `roadmap.md`
- All phases listed in `depends_on` are completed

### Actions
1. **Read project context**
   - Read `project.json`: config, current milestone, current phase
   - Read `roadmap.md`: extract Phase N details (goal, depends_on, requirements, success_criteria)
   - Read `state.md`: current position, blockers

2. **Validate prerequisites**
   - Check each `depends_on` phase status == "completed" in roadmap.md
   - If not met: report which dependencies are incomplete
   - Offer via AskUserQuestion: execute dependencies first, or abort

3. **Context capture** (optional)
   - Check for `.forge/phases/{NN}-{slug}/context.md`
   - If exists: will be passed to planner via phase context injection
   - If NOT exists AND phase has detected gray areas:
     - Analyze phase goal + success criteria for ambiguous aspects
     - Present decisions via AskUserQuestion (concrete options per topic)
     - Write `context.md` using `templates/context.md` structure
   - If `config.auto_discuss == false`: skip gray area detection entirely
   - Infrastructure/foundation phases (Phase 1 typically): auto-skip discussion

4. **Prepare phase artifact directory**
   - Create `.forge/phases/{NN}-{slug}/` (e.g., `.forge/phases/02-auth/`)
   - NN = zero-padded phase number, slug = phase name kebab-cased
   - This replaces the date-based artifact directory for project phases

5. **Map success criteria to truths seed**
   - Roadmap `success_criteria` -> `must_haves.truths` (initial seed for planner)
   - Roadmap `requirements` -> plan's requirement references
   - These are injected into the planner via phase context

6. **Invoke standard 10-step pipeline**
   The existing Forge pipeline (references/execution-flow.md) runs with injected context:

   **Step 1 (INIT) receives:**
   - request = phase goal from roadmap
   - phase_context = `{phase_number, milestone, success_criteria, requirements, context.md path}`
   - artifact_dir = `.forge/phases/{NN}-{slug}/` (overrides date-based default)
   - truths_seed = mapped success_criteria

   **Steps 2-9:** execute normally (unchanged pipeline)

   **Step 10 (CLEANUP):** triggers phase transition (see below)

   The pipeline itself is UNCHANGED. Only the inputs and artifact directory are different.

7. **Post-pipeline updates (phase transition)**
   After the 10-step pipeline completes:

   a. Update `roadmap.md`:
      - Phase N status -> "completed"
      - Phase N Plans count -> increment

   b. Update `state.md`:
      - Current Position -> advance to next incomplete phase
      - Session History += "{date}: Phase {N} ({name}) completed"
      - Next Action -> updated to next step
      - Progress bar -> recalculated from roadmap

   c. Update `project.json`:
      - `stats.completed_phases++`
      - `stats.completed_tasks += {tasks from this phase}`
      - `current_phase` -> next incomplete phase number

   d. Milestone boundary check:
      - If Phase N was the LAST phase in current milestone:
        - Notify user: "All phases in {milestone_name} complete. Run milestone verification?"
        - Do NOT auto-verify. User decides.

### Error Handling
- Dependency not met -> list incomplete deps, offer sequential execution
- Pipeline fails mid-execution -> state.md records position, resume with `/forge --phase N --resume`
- Phase already completed -> AskUserQuestion: "Phase {N} is already completed. Re-execute or skip?"

<!-- PHASE_EXEC_END -->

---

<!-- AUTONOMOUS_START -->
## 3. Autonomous Mode (/forge --autonomous [--from N])

### Load
- This section only
- `.forge/project.json`, `.forge/roadmap.md`, `.forge/state.md`

### Prerequisites
- `.forge/project.json` exists
- At least one incomplete phase in roadmap

### Actions
1. **Determine starting point**
   - If `--from N`: start from phase N
   - Else: read `state.md`, find first incomplete phase (status != "completed")

2. **Display autonomous plan**
   ```
   ━━━ Autonomous Mode ━━━━━━━━━━━━━━━
   Starting: Phase {N} ({name})
   Remaining: {count} phases
   Milestone: {current milestone name}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

3. **Main loop**
   ```
   max_phases_per_session = 10   # safety limit
   phases_executed = 0

   WHILE phases_executed < max_phases_per_session:

     a. Re-read roadmap.md (may have been modified during execution)

     b. next_phase = first phase where:
        - status == "pending"
        - all depends_on phases have status == "completed"

     c. If no next_phase found: BREAK (all done or blocked)

     d. Smart Discuss (if phase has gray areas and no context.md):
        - Analyze phase goal for ambiguous aspects
        - Propose decisions based on:
          * Prior phase contexts (read previous context.md files)
          * Codebase conventions (from project-profile.json)
          * Domain common practices
        - Present as batch table:
          | # | Topic | Proposed Decision | Accept/Override |
        - User accepts batch or overrides individual items
        - Write context.md with locked decisions
        - Infrastructure/foundation phases: auto-skip discussion

     e. Execute: /forge --phase {next_phase}
        (runs the full 10-step pipeline per Section 2)

     f. Check result:
        - Pipeline succeeded: phases_executed++, continue loop
        - Pipeline failed: report failure to user
          AskUserQuestion: "Continue with next phase, retry, or stop?"

     g. Milestone boundary check:
        If next_phase was the last phase in current milestone:
        - Dispatch integration-checker (see prompts/integration-checker.md):
          ```xml
          <agent_dispatch>
            <role>integration-checker</role>
            <files_to_read>
              .forge/roadmap.md
              .forge/phases/{NN}-{slug}/verification.md (all phases in milestone)
              .forge/phases/{NN}-{slug}/plan.md (all phases in milestone)
              .forge/phases/{NN}-{slug}/report.md (all phases in milestone)
            </files_to_read>
            <output_path>.forge/milestones/{milestone_name}-verification.md</output_path>
          </agent_dispatch>
          ```
        - If INTEGRATED: archive milestone, advance to next milestone
        - If GAPS_FOUND: report gaps, AskUserQuestion: "Fix gaps, accept and proceed, or stop?"

     h. Context pressure check:
        If PM context is HIGH or CRITICAL:
        - Write state.md with full context for session continuity
        - Display: "Context pressure is high. Recommend starting a new session."
        - BREAK
   ```

4. **Completion**
   - All phases done: display final project summary with milestone status
   - Interrupted (context pressure or user stop): state.md has full context for resume
   - Max phases reached: display progress, suggest continuing in new session

### Interruption Handling
- User sends input during execution -> pause after current task completes, respond
- `/forge --status` during autonomous -> show progress, offer resume or stop
- Context pressure CRITICAL -> graceful exit with state preservation

### Error Handling
- Single phase fails -> offer: retry, skip, or stop autonomous mode
- Multiple consecutive failures (3+) -> stop autonomous, escalate to user
- Context pressure -> write state, suggest new session

<!-- AUTONOMOUS_END -->

---

<!-- MILESTONE_START -->
## 4. Milestone Verification (/forge --milestone [N])

### Load
- This section only
- `.forge/project.json`, `.forge/roadmap.md`
- Phase `verification.md` files for all phases in this milestone

### Prerequisites
- `.forge/project.json` exists
- Milestone N exists (or use `project.json.current_milestone`)

### Actions
1. **Identify milestone**
   - N specified: use milestone N
   - N not specified: use `project.json.current_milestone`

2. **Check phase completion**
   - Read `roadmap.md`: list all phases in this milestone
   - Verify each phase status == "completed"
   - If incomplete phases exist:
     ```
     Milestone {name}: {completed}/{total} phases complete
     Incomplete: Phase {N} ({name}), Phase {M} ({name})
     ```
     AskUserQuestion: "Execute incomplete phases first, or proceed with partial verification?"

3. **Dispatch integration-checker**
   ```xml
   <agent_dispatch>
     <role>integration-checker</role>
     <files_to_read>
       .forge/roadmap.md
       .forge/phases/01-{slug}/verification.md
       .forge/phases/01-{slug}/plan.md
       .forge/phases/01-{slug}/report.md
       .forge/phases/02-{slug}/verification.md
       .forge/phases/02-{slug}/plan.md
       .forge/phases/02-{slug}/report.md
       ... (all phases in this milestone)
     </files_to_read>
     <output_path>.forge/milestones/{milestone_name}-verification.md</output_path>
   </agent_dispatch>
   ```
   See `prompts/integration-checker.md` for agent behavior.

4. **Process verdict**
   PM reads verdict from milestone-verification.md (summary line only).

   **If INTEGRATED:**
   - Create archive: `.forge/milestones/{name}-archive.md`
     (contains: milestone summary, phase list, key decisions, completion date)
   - Update `project.json`: milestone status -> "completed", advance `current_milestone`
   - Update `roadmap.md`: mark milestone as completed
   - Update `state.md`: new position at next milestone
   - Display success + offer to start next milestone

   **If GAPS_FOUND:**
   - Display gap list from milestone-verification.md
   - AskUserQuestion with options:
     a. Create fix tasks (auto-generate a targeted plan for gap closure)
     b. Manual review (user fixes gaps themselves)
     c. Accept and proceed (acknowledge gaps, advance anyway)

   **If FAILED:**
   - Display critical failures
   - Recommend re-executing failed phases
   - Do NOT offer "accept and proceed" for FAILED verdicts

<!-- MILESTONE_END -->

---

<!-- STATUS_START -->
## 5. Status Dashboard (/forge --status)

### Load
- This section only
- `.forge/project.json`, `.forge/roadmap.md`, `.forge/state.md`

### Prerequisites
- None (gracefully handles missing files)

### Actions
1. **Check for project**
   - If no `.forge/project.json`:
     Display: "No active project. Run `/forge --init` to start a new project."
     Return.

2. **Read project state**
   - Read `project.json`: name, description, milestones, stats
   - Read `roadmap.md`: phase statuses (scan for `**Status:**` lines)
   - Read `state.md`: current position, blockers, next action

3. **Calculate progress**
   - `completed_phases / total_phases` -> percentage
   - Build progress bar (16 chars): filled blocks for completed, empty for remaining

4. **Display dashboard**
   ```
   ━━━ Forge Project Status ━━━━━━━━━━
   Project:   {name}
   Desc:      {description}

   Milestone: {N} -- {milestone_name}
   Phases:    {completed}/{total} ({percent}%)
   Progress:  {progress_bar}

   Current:   Phase {N}: {name} -- {status}
   Blockers:  {list or "none"}
   Next:      {next_action from state.md}

   ━━━ Phase Overview ━━━━━━━━━━━━━━━━
   [completed] Phase 1: {name}
   [completed] Phase 2: {name}
   [active]    Phase 3: {name} (in_progress)
   [pending]   Phase 4: {name}
   [pending]   Phase 5: {name}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

5. **Offer actions** (AskUserQuestion based on state)
   - If in_progress phase exists: "Resume Phase {N}?"
   - If pending phase ready (deps met): "Start Phase {N}?"
   - If all phases in milestone done: "Run milestone verification?"
   - Always available: "Run autonomous mode for remaining phases?"

<!-- STATUS_END -->

---

<!-- STATE_MGMT_START -->
## 6. State Management

### When to Update state.md

| Event | Update |
|---|---|
| Phase started | Current Position -> phase N, in_progress |
| Phase completed | Current Position -> advance, Session History += entry |
| Milestone completed | Current Position -> next milestone, Session History += entry |
| Key decision made | Recent Decisions += entry |
| Blocker encountered | Blockers += entry |
| Blocker resolved | Blockers -= entry (mark resolved with date) |
| Session starts | Read only -- do NOT modify on read |

### State.md Update Rules

1. **Max 100 lines.** Trim oldest Session History entries when exceeding.
2. **Recent Decisions:** keep last 10. Older decisions archived to relevant phase `context.md`.
3. **Next Action:** ALWAYS exactly 1 line. Updated after every significant event.
4. **Progress bar:** recalculated from `roadmap.md` phase statuses on every update.
5. **Blockers:** never delete silently. Mark as resolved with date before removing.
6. **Atomicity:** read state.md, modify in memory, write entire file. No partial updates.

### Session Continuity Protocol

When a NEW session starts and `.forge/state.md` exists:

1. Read `state.md` (always <=100 lines, safe to load)
2. Parse Current Position (milestone, phase, status)
3. Display to user:
   ```
   ━━━ Existing Project Detected ━━━━━
   Project: {name}
   Phase:   {N} ({name}) -- {status}
   Next:    {next_action}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
4. AskUserQuestion: "Resume where you left off, show full status, or start a new task?"
   - Resume -> execute the Next Action from state.md
   - Status -> run `/forge --status`
   - New task -> standard task mode (no project context)

### Backward Compatibility

- If NO `.forge/project.json` exists -> ALL `/forge` calls work as standard (task mode)
- Artifact directory: `.forge/{date}/{slug}/` (unchanged for task mode)
- If `project.json` EXISTS:
  - `/forge` with project flags (`--phase`, `--autonomous`, etc.) -> project mode
  - `/forge [request]` without project flags -> task mode within project context
    (artifacts go to `.forge/{date}/{slug}/`, NOT linked to roadmap phases)
  - `/forge --init` when project exists -> error with option to update or create new

<!-- STATE_MGMT_END -->

---

<!-- BACKWARD_COMPAT_START -->
## 7. Backward Compatibility

### Rule 1: No project.json = standard single-execution behavior
If `.forge/project.json` does NOT exist, ALL forge operations work as standard Forge v6.0:
- `/forge [request]` -> 10-step pipeline -> `.forge/{date}/{slug}/`
- No project flags available (`--phase`, `--autonomous`, etc. show helpful message)
- `project-profile.json` still works for stack caching (unchanged)

### Rule 2: Project flags require project mode
If user runs `/forge --phase 3` without `project.json`:
```
No active project. Run `/forge --init` first, or use `/forge [request]` for a standalone task.
```

### Rule 3: Task mode works inside project context
If `project.json` exists AND user runs `/forge "fix the login bug"`:
- Standard task mode: artifacts in `.forge/{date}/{slug}/` (NOT in `phases/`)
- The task is NOT linked to any roadmap phase
- `state.md` is NOT updated (this is a standalone task)
- `project-profile.json` is still used for stack detection

### Rule 4: Project flags reference

| Flag | Requires project.json | Behavior without project |
|---|---|---|
| `--init` | No (creates it) | Creates project |
| `--phase N` | Yes | Error + helpful message |
| `--autonomous` | Yes | Error + helpful message |
| `--milestone [N]` | Yes | Error + helpful message |
| `--status` | No | "No project found" message |
| `--discuss N` | Yes | Error + helpful message |

### Rule 5: Directory coexistence
Both directory structures coexist under `.forge/`:
```
.forge/
  project.json              # Project mode files
  roadmap.md
  state.md
  project-profile.json      # Shared (both modes)
  phases/                   # Project mode artifacts
    01-foundation/
    02-auth/
  milestones/               # Project mode milestone archives
    v1.0-archive.md
  2026-03-15/               # Task mode artifacts (unchanged)
    fix-login-bug-1430/
```

Project mode never writes to date-based directories.
Task mode never writes to `phases/` or `milestones/`.

<!-- BACKWARD_COMPAT_END -->
