# Context Engineering Reference

> This file defines the rules for managing LLM context across the Forge v6.0 execution pipeline.
> PM should load this file when context management decisions are needed, not at every step.

---

## 1. Why Context Engineering Matters

**The Problem: Context Rot**

As an LLM's context window fills up, output quality degrades. This is not a theoretical concern — it is the primary failure mode for complex multi-step tasks.

Symptoms of context rot:
- Agent begins hallucinating file paths that do not exist.
- Generated code references variables or functions from earlier (now irrelevant) context.
- Instructions from early steps bleed into later steps, causing off-target behavior.
- Agent "forgets" the current objective and reverts to earlier patterns.
- Repetitive output — the same code block or explanation appears multiple times.

**Why Forge v6.0 is designed around this:**
- PM (orchestrator) runs in a single long-lived context window.
- Agents run in fresh 200k-token context windows per invocation.
- If PM's context fills up, the entire execution degrades. Agents are immune because they start fresh.
- Therefore: keep PM lean, push work to agents.

**The Rule:** PM holds paths and summaries. Agents hold content.

---

## 2. PM Context Budget Rules

**Hard limit: PM must use no more than 15% of its context window for Forge-related data.**

### What PM loads (allowed)
| Item | Approx Size | When |
|---|---|---|
| SKILL.md (relevant sections) | ~3k tokens | Step 1 only |
| Current step section of execution-flow.md | ~2-3k tokens | Each step |
| meta.json | ~1k tokens | Every step |
| File paths (not contents) | ~1-2k tokens | As needed |
| Summary digests (<=20 lines each) | ~1-2k tokens | After agent returns |
| User interaction messages | ~3-5k tokens | Accumulates |
| Reference files (context-eng, wave, deviation) | ~2-3k tokens | Only when relevant |

### What PM must NEVER load
- Full contents of research.md (read summary section only, <=20 lines).
- Full contents of plan.md (read YAML frontmatter and task list, not task details).
- Full contents of task-summary.md files (read status/verdict line only).
- Full agent output or agent conversation history.
- Source code files (agents read these directly).
- Previous step's full instructions (load only the current step).
- Completed task details (only retain: task ID, status, file paths).

### Loading Map Quick Reference
| Step | Load | Do NOT Load |
|---|---|---|
| 1. Init | SKILL.md (sec 1-4), project-profile.json | execution-flow.md full |
| 2. Research | exec-flow sec 2, type-guide | Other step sections |
| 3. Plan | exec-flow sec 3, research summary (<=20 lines), plan template | Full research.md |
| 4. Plan-Check | exec-flow sec 4 | research.md, previous step details |
| 5. Checkpoint | exec-flow sec 5, plan summary | research.md, step details |
| 6. Branch | exec-flow sec 6 | Everything else |
| 7. Execute | exec-flow sec 7, wave-execution.md, deviation-rules.md | Completed task details |
| 8. Verify | exec-flow sec 8, plan must_haves only | Task summaries, QA reports |
| 9. Finalize | exec-flow sec 9, report template | All previous step details |
| 10. Cleanup | Nothing | Everything |

---

## 3. File-Based Communication Protocol

### Core Rule
All agent communication flows through disk files. Agents never communicate directly with each other. PM routes all information.

### The Flow
```
Step 1: PM writes dispatch instructions (in-memory, not on disk)
Step 2: PM invokes agent with file paths (not file contents)
Step 3: Agent reads files directly from disk using Read/Glob/Grep tools
Step 4: Agent writes structured output to its designated output_path
Step 5: Agent returns the output_path to PM
Step 6: PM reads ONLY the summary/verdict from the output file (not full content)
```

### What PM passes to agents
- File paths to read (via `<files_to_read>` block).
- Output path for the agent to write to.
- Task-specific parameters (task ID, type, scale, etc.).
- Checklist paths if applicable.

### What PM receives from agents
- The output file path (a single string).
- PM then reads only the verdict or summary section of that file.

### What PM does NOT receive
- Agent's internal reasoning or chain-of-thought.
- Full file contents that the agent read.
- Intermediate results from the agent's work.

---

## 4. Summary Digest Rules

When PM needs to understand an agent's output, it reads a **summary digest** — never the full output.

### Digest constraints
- Maximum 20 lines.
- Must be extractable from a known section of the output file (e.g., `## Summary`, verdict line, status table).

### What to extract per file type
| File | What to Extract | Location in File |
|---|---|---|
| research.md | Finding counts (H/M/L) + top H1 title | `## Summary` section |
| plan.md | Task count, wave count, phase names | YAML frontmatter |
| plan-check result | 8D verdict line | Last line of appended section |
| task-summary.md | Status line + deviation count | `## Status` + `## Deviations` |
| qa-report.md | Verdict (PASS/GAPS_FOUND/BUILD_FAILED) | First line or `## Verdict` |
| verification.md | Verdict (VERIFIED/GAPS_FOUND/FAILED) | `## Verdict` section |

### Example: reading research.md digest
```
CORRECT:
  PM reads lines 3-10 of research.md (the Summary section)
  PM sees: "3 HIGH, 5 MEDIUM, 2 LOW findings. Key issue: missing auth middleware."
  PM stores: "research: 3H 5M 2L, key: missing auth middleware"

WRONG:
  PM reads all 300 lines of research.md into context
  PM now has 300 lines of research polluting the context for all subsequent steps
```

---

## 5. Context Pressure Levels

PM should estimate its context usage at each step transition and adapt accordingly.

### LOW (< 30% used)
- Normal operation.
- Can load additional reference files if helpful.
- Can retain slightly more summary data than minimum.
- **Actions:** None required.

### MEDIUM (30-50% used)
- Warning zone.
- Replace detailed summaries from previous steps with single-line status entries.
- Minimize context passed to agents (paths only, no extra commentary).
- **Actions:**
  - Compress step history: replace per-step notes with `"steps 1-4: complete"`.
  - Drop research digest if past Step 4.

### HIGH (50-70% used)
- Caution zone.
- Load only what is strictly required for the current step.
- Drop all completed task summaries (keep only task ID and status).
- Do not load reference files unless the current step explicitly requires them.
- **Actions:**
  - Drop all previous step instructions from context.
  - Retain only: meta.json, current step instructions, active task IDs.
  - Summarize user interaction history to key decisions only.

### CRITICAL (> 70% used)
- Emergency zone.
- Retain only the bare minimum to continue the current action.
- **Actions:**
  - Keep only: current task ID, current step number, next action.
  - Re-read any needed file from disk on demand (do not cache).
  - Warn the user: "Context pressure is critical. Execution may need to be simplified."
  - Consider: finishing the current wave and then generating the report, skipping remaining waves.

---

## 6. Agent Dispatch Template

The standard format for dispatching any agent:

```xml
<agent_dispatch>
  <role>{researcher|planner|plan-checker|implementer|code-reviewer|qa-inspector|verifier|doc-reviewer}</role>
  <task_id>{unique task identifier}</task_id>
  <files_to_read>
    {absolute_or_relative_path_1} ({optional: section hint})
    {absolute_or_relative_path_2}
    ...
  </files_to_read>
  <checklist>{path to language checklist}</checklist>
  <output_path>{path where agent writes its result}</output_path>
  <output_mode>{write|append}</output_mode>
  <!-- Optional fields -->
  <deviation_rules>{path to deviation-rules.md}</deviation_rules>
  <focus>{specific area to focus on}</focus>
  <type>{code|code-bug|...}</type>
  <scale>{small|medium|large}</scale>
  <paradigm>{oop|fp|script|ddd|mixed}</paradigm>
</agent_dispatch>
```

### Complete example: dispatching an implementer
```xml
<agent_dispatch>
  <role>implementer</role>
  <task_id>1-3</task_id>
  <files_to_read>
    .forge/2026-03-15/auth-refactor-1430/plan.md (task [1-3] only)
    src/auth/handler.go
    src/auth/middleware.go
    src/config/auth.go
    checklists/go.md
    checklists/general.md
  </files_to_read>
  <deviation_rules>references/deviation-rules.md</deviation_rules>
  <output_path>.forge/2026-03-15/auth-refactor-1430/task-1-3-summary.md</output_path>
  <output_mode>write</output_mode>
</agent_dispatch>
```

### Agent return contract
The agent's response to PM must contain ONLY:
```
Output written to: {output_path}
```
PM then reads the verdict/summary from that file. The agent does NOT return its work product in the message.

---

## 7. Anti-Patterns (What NOT to Do)

### Anti-Pattern 1: Loading full agent output
```
WRONG: PM reads all 100 lines of task-1-3-summary.md into context
RIGHT: PM reads only the Status line ("## Status: PASS") and deviation count
```

### Anti-Pattern 2: Keeping old step data
```
WRONG: PM retains full Step 2 research details while executing Step 7
RIGHT: PM retains only "research: 3H 5M 2L" one-liner from Step 2
```

### Anti-Pattern 3: Passing code to agents via PM context
```
WRONG: PM reads src/auth/handler.go, then includes it in agent prompt
RIGHT: PM tells agent to read src/auth/handler.go (via files_to_read path)
```

### Anti-Pattern 4: Accumulating task summaries
```
WRONG: PM loads all task summaries to "track progress"
RIGHT: PM tracks progress via meta.json task counts only
        (total: 8, completed: 5, in_progress: 2, failed: 0)
```

### Anti-Pattern 5: Loading the entire execution-flow.md
```
WRONG: PM reads all 10 steps of execution-flow.md at init
RIGHT: PM reads only the current step section using ## Step N headers
```

### Anti-Pattern 6: Retaining agent conversation history
```
WRONG: PM keeps the full dispatch/response exchange for every agent call
RIGHT: PM records only: "agent: implementer, task: 1-3, result: PASS, path: task-1-3-summary.md"
```

### Anti-Pattern 7: Re-reading unchanged files
```
WRONG: PM re-reads plan.md at every step
RIGHT: PM reads plan.md summary once (Step 3), then only reads it again if modification is needed
```

---

## Summary: The Golden Rules

1. **PM holds maps, agents hold territory.** PM knows where files are. Agents know what's in them.
2. **20-line maximum.** If PM needs to understand an agent's output, read at most 20 lines of summary.
3. **Paths in, paths out.** PM sends file paths to agents. Agents return file paths to PM.
4. **One step at a time.** Load only the current step's instructions. Drop the previous step's.
5. **Fresh beats stale.** An agent with a fresh 200k context outperforms PM with 50% context rot.
6. **When in doubt, offload.** If PM is tempted to do analysis, dispatch an agent instead.

---

## 8. Context Recovery Protocol

> When the system compresses or truncates conversation context, PM may lose track of execution state.
> This protocol ensures PM can recover and continue without restarting the pipeline.

### 8.1 Detecting Context Compression

**Symptoms that indicate context was compressed:**
- PM cannot recall which step it is on or what the current wave is
- Agent dispatch history is missing from memory
- PM's understanding of meta.json state doesn't match what it would have known
- PM receives a system message about conversation compression
- PM finds itself re-asking questions it already answered

**Trigger:** Immediately after noticing any of the above symptoms, execute the recovery procedure below.

### 8.2 Recovery Procedure

Execute these steps IN ORDER:

1. **Read meta.json** from the artifact directory (`.forge/{date}/{slug}/meta.json`)
   - This gives: `current_step`, `current_wave`, `tasks.completed_tasks[]`, `state`
   - This is the source of truth for execution progress

2. **Read SKILL.md §6 Loading Map** for the current step
   - This tells PM exactly what files to load for the current step
   - Do NOT load files for other steps

3. **Load the current step section** from execution-flow.md
   - Navigate to the `## Step N` section header for the current step
   - Load ONLY the current step section (up to the next `## Step` header), not the full file

4. **If in Step 7 (Execute):** also read:
   - `plan.md` task checklist (task IDs + `<done>` status only, NOT full task details)
   - `wave-execution.md` (if currently processing waves)

5. **Resume execution** from the current step and wave

**Critical rules during recovery:**
- Do NOT re-read completed step artifacts (research.md, previous task summaries)
- Do NOT re-read the full plan.md (only task list for progress tracking)
- Do NOT attempt to reconstruct agent dispatch history — it's in trace.jsonl if needed
- Trust meta.json as the source of truth, not your memory

### 8.3 Recovery Essentials per Step

This table defines the MINIMUM files needed to resume each step after context loss:

| Step | Must Re-Read | Can Safely Ignore |
|---|---|---|
| **1. Init** | meta.json, SKILL.md §1-4 | Everything else |
| **2. Research** | meta.json, execution-flow.md §2 | Previous init details |
| **3. Plan** | meta.json, execution-flow.md §3, research.md (summary only) | Full research, init details |
| **4. Plan-Check** | meta.json, execution-flow.md §4, plan.md (frontmatter only) | research.md, init/research details |
| **5. Checkpoint** | meta.json, plan.md (overview + task count) | Everything else |
| **6. Branch** | meta.json, execution-flow.md §6 | Everything else |
| **7. Execute** | meta.json, execution-flow.md §7, plan.md (task list only), wave-execution.md | Completed tasks, research, plan rationale |
| **8. Verify** | meta.json, execution-flow.md §8, plan.md (must_haves section only) | All previous step details |
| **9. Finalize** | meta.json, execution-flow.md §9, verification.md (verdict only) | All previous step details |
| **10. Cleanup** | meta.json only | Everything |

### 8.4 Post-Recovery Verification

After completing recovery, PM should verify:
1. Current step number matches meta.json `current_step`
2. Completed task count matches meta.json `tasks.completed`
3. Current wave matches meta.json `current_wave` (if in Step 7)
4. If any mismatch: trust meta.json and re-read the relevant artifact

---

## 9. Token Budget Guide

> This guide helps PM estimate and track token usage across the execution pipeline.
> Token tracking data feeds into the report.md Token/Cost Estimation section.

### 9.1 Estimated Token Costs per Dispatch

| Model | Avg Input Tokens | Avg Output Tokens | Relative Cost |
|---|---|---|---|
| haiku | ~10k | ~5k | 1x (baseline) |
| sonnet | ~20k | ~10k | ~5x |
| opus | ~40k | ~20k | ~25x |

These are estimates. Actual usage varies by:
- File sizes being read by agents
- Complexity of the task (more complex = more output)
- Number of revision loops (each retry adds a full dispatch cost)

### 9.2 Budget Estimation Formula

Before starting execution, PM can estimate total cost:

```
total_dispatches = research_agents + 1 (planner) + 1 (plan-checker)
                 + task_count × 1 (implementer)
                 + task_count × 1 (code-reviewer)
                 + wave_count × 1 (qa-inspector)
                 + 1 (verifier)

estimated_tokens = sum(dispatch_count × model_avg_tokens for each model)
```

**Example for a medium project (8 tasks, 3 waves, balanced profile):**
```
Research: 3 haiku + 1 sonnet = 3×15k + 1×30k = 75k
Plan: 1 sonnet = 30k
Plan-Check: 1 sonnet = 30k
Implement: 8 sonnet = 8×30k = 240k
Review: 8 sonnet = 8×30k = 240k
QA: 3 sonnet = 3×30k = 90k
Verify: 1 sonnet = 30k
Total: ~735k tokens
```

### 9.3 Dispatch Tracing

PM records each dispatch in `trace.jsonl` (one JSON object per line):

```json
{"agent":"researcher","task_id":"research-1","model":"haiku","timestamp":"2026-03-15T14:31:00Z","result":"PASS"}
{"agent":"researcher","task_id":"research-2","model":"haiku","timestamp":"2026-03-15T14:31:05Z","result":"PASS"}
{"agent":"planner","task_id":"plan","model":"sonnet","timestamp":"2026-03-15T14:32:00Z","result":"PASS"}
{"agent":"implementer","task_id":"1-1","model":"sonnet","timestamp":"2026-03-15T14:35:00Z","result":"PASS"}
```

At Step 9 (FINALIZE), PM reads trace.jsonl and:
1. Counts dispatches per agent and per model
2. Estimates tokens using the table above
3. Populates the Token/Cost Estimation section in report.md
4. Optionally records aggregated data via `forge-tools.js metrics-record-dispatch`

### 9.4 Cost Optimization Tips

- **Start with balanced profile** — smart routing auto-selects the right model per dispatch
- **Monitor revision rates** — high revisions mean wasted dispatches. Consider upgrading model early
- **Use haiku for research** — research agents read a lot but produce structured summaries, haiku handles this well
- **Avoid opus for code review** — sonnet catches >95% of issues at 5x less cost
- **Quick mode** for small, well-understood changes — skips research, plan-check, and verify dispatches
