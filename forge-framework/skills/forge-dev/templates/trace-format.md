# Trace Log Format (trace.jsonl)

Each line is a JSON object recording one agent dispatch:

```json
{
  "timestamp": "2026-03-17T10:30:00Z",
  "execution_id": "jwt-auth-1430",
  "step": 7,
  "wave": 2,
  "agent": "implementer",
  "task_id": "1-3",
  "model": "sonnet",
  "input_files": ["plan.md", "src/auth/handler.go"],
  "output_file": "task-1-3-summary.md",
  "verdict": "PASS",
  "revision": 0,
  "duration_ms": 45000,
  "error": null
}
```

## Fields
| Field | Type | Description |
|---|---|---|
| timestamp | ISO 8601 | When the agent was dispatched |
| execution_id | string | Artifact directory slug |
| step | number | Pipeline step (1-10) |
| wave | number | Wave number (for Step 7) |
| agent | string | Agent role name |
| task_id | string | Task ID from plan.md (e.g., "1-3") |
| model | string | Model used (haiku/sonnet/opus) |
| input_files | string[] | Files passed to agent |
| output_file | string | Agent output file path |
| verdict | string | Agent's verdict (PASS/FAIL/NEEDS_REVISION) |
| revision | number | Revision attempt number (0 = first try) |
| duration_ms | number | Agent execution time |
| error | string|null | Error message if failed |

## Usage
- PM appends one line per agent dispatch
- Use `forge-tools.js metrics-record` to aggregate into metrics.json
- Trace file: `.forge/{date}/{slug}/trace.jsonl` (per execution)
- Analysis: `grep "verdict.*FAIL" trace.jsonl | wc -l` for failure rate
