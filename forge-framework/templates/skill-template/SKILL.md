---
# ============================================================
# SKILL MANIFEST — Forge Framework v8.0 "Nova"
# Copy this file to: skills/{{SKILL_NAME}}/SKILL.md
# Replace all {{PLACEHOLDERS}} before use.
# ============================================================

# [REQUIRED] Unique identifier. Lowercase, hyphen-separated.
name: {{SKILL_NAME}}

# [REQUIRED] What this skill does. Used by Gatekeeper for routing decisions.
description: |
  {{DESCRIPTION}}
  One or two sentences. Be specific about what tasks this skill handles.

routing:
  # [REQUIRED] Words/phrases that trigger this skill.
  # Gatekeeper matches these against user intent (not just literal keywords).
  triggers:
    - {{TRIGGER_1}}
    - {{TRIGGER_2}}
    - {{TRIGGER_3}}

  # [OPTIONAL] Phrases that explicitly should NOT trigger this skill.
  # Use when your triggers overlap with another skill or a read-only action.
  # anti-triggers:
  #   - "explain {{SKILL_NAME}}"
  #   - "what is {{TRIGGER_1}}"

  # [OPTIONAL] Named modes your skill supports.
  # Each mode maps to a different pipeline or agent behavior.
  # modes:
  #   standard: "{{MODE_STANDARD_DESC}}"
  #   quick:    "{{MODE_QUICK_DESC}}"
  #   dry-run:  "{{MODE_DRYRUN_DESC}}"

  # [OPTIONAL] Routing priority. Values: low | normal | high
  # High priority skills are checked first by Gatekeeper.
  # priority: normal

  # [OPTIONAL] Intent categories this skill handles.
  # Values: code-modify | command | discuss | skill-task
  # categories:
  #   - code-modify

# [OPTIONAL] Framework integration settings.
# framework:
#   # Pipeline definition file (relative to this SKILL.md).
#   # pipeline: templates/pipeline.json
#
#   # Gate Guard rules — which gates this skill requires.
#   # gates:
#   #   - {{GATE_1}}
#   #   - {{GATE_2}}
#
#   # Workspace scope — files this skill is allowed to read/write.
#   # workspace:
#   #   scope:
#   #     - {{SCOPE_DIR_1}}/
#   #     - {{SCOPE_FILE_1}}
#   #   readonly:
#   #     - {{READONLY_FILE_1}}
#   #   ignore:
#   #     - node_modules/
#   #     - dist/
#
#   # Quality system — inherit framework defaults and optionally add layers.
#   # quality:
#   #   inherit: true
#   #   add_layers:
#   #     - { name: "{{CUSTOM_CHECK}}", after: "{{STEP_NAME}}" }
---

# {{SKILL_NAME}} — {{SHORT_TITLE}}

> {{ONE_LINE_SUMMARY}}
> Part of the Forge Framework v8.0 "Nova".

---

## 1. Overview

<!-- TODO: Describe what this skill does in 2–4 sentences.
     What problem does it solve? When should the user invoke it?
     What does a successful run produce? -->

{{OVERVIEW_TEXT}}

---

## 2. Usage

```
/{{SKILL_NAME}} [request] [options]
```

<!-- TODO: List flags/options if your skill supports them. Remove table if none. -->

| Flag | Values | Description |
|---|---|---|
| `--mode` | standard, quick | Pipeline mode (default: standard) |

---

## 3. Pipeline Steps

<!-- TODO: Describe each step of your skill's pipeline.
     Use the engine's built-in steps where possible (init, checkpoint, finalize).
     Add custom steps with a brief description of what the agent does. -->

| Step | Agent | Produces |
|---|---|---|
| init | framework | workspace-context.json, pipeline-state.json |
| {{STEP_1}} | {{AGENT_1}} | {{ARTIFACT_1}} |
| {{STEP_2}} | {{AGENT_2}} | {{ARTIFACT_2}} |
| finalize | framework | report.md, git commit |

---

## 4. Outputs

<!-- TODO: List every artifact this skill produces and where it lands. -->

- `.forge/{{DATE}}/{{SKILL_NAME}}-{{ID}}/{{ARTIFACT_1}}` — {{ARTIFACT_1_DESC}}
- `.forge/{{DATE}}/{{SKILL_NAME}}-{{ID}}/report.md` — Execution summary

---

## 5. Notes

<!-- TODO: Add any caveats, prerequisites, or known limitations.
     Example: "Requires Docker running locally."
     Example: "Only supports Node.js projects." -->

- {{NOTE_1}}
