# Plugin System Reference

> Forge Plugin System enables custom agents via `.forge/agents/` directory.
> PM scans for plugins at Step 1 (INIT) and makes them available for dispatch.

---

## 1. Overview

Any `.md` file placed in `.forge/agents/` becomes a custom agent that PM can dispatch just like built-in agents.

**Benefits:**
- Domain-specific agents (e.g., security-auditor for fintech, perf-profiler for games)
- Project-specific review rules
- Team-shared conventions enforcement
- No Forge core modifications needed

---

## 2. Plugin Format

Every plugin file must follow this structure:

```markdown
# {Agent Name}

## Identity
{Who this agent is and what it does — 2-3 lines}

## Input Contract
PM dispatches you with:
- {list of inputs the agent expects}

## Process
{Step-by-step instructions}

## Output Contract
Write to `{output_path}`:
{Output format specification}

## Constraints
- {Rules and limitations}
```

**Required sections:** Identity, Input Contract, Process, Output Contract
**Optional sections:** Constraints, Examples

---

## 3. Plugin Discovery

At Step 1 (INIT), PM scans for plugins:

```
1. Check if .forge/agents/ directory exists
2. If yes: Glob(".forge/agents/*.md")
3. For each .md file:
   - Extract agent name from filename (e.g., security-auditor.md → security-auditor)
   - Read first 5 lines to extract Identity section
   - Register as available custom agent
4. Record discovered plugins in meta.json:
   "plugins": ["security-auditor", "perf-profiler"]
```

**Plugin names must:**
- Be lowercase with hyphens (e.g., `security-auditor`, not `SecurityAuditor`)
- Not conflict with built-in agent names (researcher, planner, implementer, etc.)
- End in `.md`

---

## 4. Plugin Dispatch

### From plan.md

Planner can reference custom agents in task blocks:

```xml
<task id="1-5" wave="2" depends_on="1-3">
  <name>Security review of auth module</name>
  <role>custom:security-auditor</role>
  <files>src/auth/*.ts</files>
  <action>Run security audit on authentication module</action>
  <output_path>.forge/{date}/{slug}/security-audit.md</output_path>
</task>
```

The `custom:` prefix tells PM to load from `.forge/agents/` instead of built-in prompts.

### PM Dispatch

```xml
<agent_dispatch>
  <role>custom:security-auditor</role>
  <task_id>1-5</task_id>
  <files_to_read>
    .forge/agents/security-auditor.md (the plugin prompt itself)
    src/auth/handler.ts
    src/auth/middleware.ts
  </files_to_read>
  <output_path>.forge/{date}/{slug}/security-audit.md</output_path>
</agent_dispatch>
```

**Key:** PM passes the plugin file path as the FIRST file in `<files_to_read>`. The agent reads its own instructions from disk.

---

## 5. Plugin Lifecycle

| Event | Action |
|---|---|
| Step 1 (INIT) | Scan `.forge/agents/`, register in meta.json |
| Step 3 (PLAN) | Planner may reference custom agents if appropriate |
| Step 7 (EXECUTE) | PM dispatches custom agents same as built-in |
| Step 9 (FINALIZE) | Plugin dispatch recorded in trace.jsonl |

---

## 6. Example Plugins

### Security Auditor (`.forge/agents/security-auditor.md`)
```markdown
# Security Auditor

## Identity
You audit code for security vulnerabilities using OWASP Top 10 criteria.
Focus on authentication, authorization, injection, and data exposure.

## Input Contract
- Source files to audit
- output_path for report

## Process
1. Read all source files
2. Check each OWASP Top 10 category
3. Rate findings: CRITICAL / HIGH / MEDIUM / LOW
4. Write structured report

## Output Contract
Write security audit report with findings table and remediation suggestions.
```

### Performance Profiler (`.forge/agents/perf-profiler.md`)
```markdown
# Performance Profiler

## Identity
You analyze code for performance issues: N+1 queries, unbounded loops,
memory leaks, unnecessary allocations, blocking I/O.

## Input Contract
- Source files to profile
- output_path for report

## Process
1. Read source files
2. Identify hot paths and performance anti-patterns
3. Estimate impact (HIGH/MEDIUM/LOW)
4. Suggest optimizations

## Output Contract
Write performance report with issue table and optimization recommendations.
```

---

## 7. Configuration

In `.forge/config.json`:

```json
{
  "plugins": {
    "enabled": true,
    "directory": ".forge/agents",
    "auto_suggest": true
  }
}
```

| Key | Default | Description |
|---|---|---|
| `enabled` | true | Enable plugin system |
| `directory` | ".forge/agents" | Plugin directory path |
| `auto_suggest` | true | Planner can suggest custom agents when appropriate |
