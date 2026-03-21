# Debug Pipeline Reference

> PM loads this when `--debug` flag is detected.
> This is a lightweight alternative to the full 10-step pipeline.

<!-- DEBUG_PIPELINE_START -->

## Debug Mode (/forge --debug "description")

### Load
- This section only
- prompts/debugger.md

### Prerequisites
- User provided a bug description (error message, unexpected behavior, crash report)

### Pipeline (5 steps, not 10)

```
Step 1: INIT
  - Parse bug description
  - Create .forge/debug/{slug}/ directory
  - meta.json with type: "debug"

Step 2: DISPATCH DEBUGGER
  - Dispatch debugger agent with:
    - Bug description
    - Relevant file paths (from error stack trace or user hint)
    - Any reproduction steps provided
  - Agent writes: debug-report.md

Step 3: REVIEW FIX
  - If debugger found and fixed the bug:
    - Dispatch code-reviewer for the fix (focused review, not full 10-perspective)
    - Focus: correctness, regression risk, root cause addressed
  - If debugger could not find root cause:
    - Present findings to user
    - Offer: widen search scope, try different approach, or escalate

Step 4: VERIFY
  - Run affected tests
  - If tests pass: mark as resolved
  - If tests fail: return to Step 2 with additional context

Step 5: REPORT
  - Write debug-report.md (final)
  - Atomic git commit with: fix({scope}): {bug description}
  - Move to .forge/debug/resolved/ if project mode
```

### Error Handling
- Debugger fails to reproduce → ask user for more details
- Fix breaks other tests → revert fix, try alternative hypothesis
- All hypotheses exhausted → escalate to user with full investigation report

### Artifacts
```
.forge/debug/{slug}/
  meta.json
  debug-report.md
```

Or in project mode:
```
.forge/phases/{NN}-{slug}/debug/
  debug-report.md
```

<!-- DEBUG_PIPELINE_END -->
