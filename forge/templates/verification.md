# Verification Report Template (v2)

Use this structure when writing verification.md.
The verifier agent MUST follow this template exactly.

---

## Template

```markdown
# Verification Report

## Source
- **Plan:** {plan.md path}
- **Date:** {YYYY-MM-DD}
- **Scope:** Phase {N} / Full

---

## Level 1: EXISTS

Check that all declared artifacts exist on disk with minimum required size.

| # | Artifact | Path | Exists | Lines | Min Required | Status |
|---|---|---|---|---|---|---|
| 1 | {artifact_name} | {path} | {YES/NO} | {N} | {min_lines} | {PASS/FAIL} |
| 2 | {artifact_name} | {path} | {YES/NO} | {N} | {min_lines} | {PASS/FAIL} |
| 3 | {artifact_name} | {path} | {YES/NO} | {N} | {min_lines} | {PASS/FAIL} |

**Level 1 Result:** {N}/{N} PASS

> FAIL at Level 1 = stop immediately. Missing files must be created before proceeding.

---

## Level 2: SUBSTANTIVE

Check that files contain real implementations, not stubs or placeholders.

| # | Artifact | Export | Defined | Stub Patterns Found | Status |
|---|---|---|---|---|---|
| 1 | {path} | {export_name} | {YES/NO} | {none / "TODO: implement" / "placeholder"} | {PASS/FAIL} |
| 2 | {path} | {export_name} | {YES/NO} | {none / pattern found} | {PASS/FAIL} |
| 3 | {path} | {export_name} | {YES/NO} | {none / pattern found} | {PASS/FAIL} |

### Stub Pattern Scan
Patterns searched in all artifact files:
- `TODO` / `FIXME` / `HACK` / `XXX` comments
- `placeholder` / `lorem ipsum` / `sample data` text
- Empty function bodies (return only, no logic)
- Hardcoded mock/test data in production code
- `console.log`-only / `print`-only function bodies

| File | Pattern | Line | Content | Severity |
|---|---|---|---|---|
| {path} | {pattern_type} | {line_number} | {matched line content} | {CRITICAL/WARNING} |

> CRITICAL stubs = FAIL. WARNING stubs = noted but may pass if intentional.

**Level 2 Result:** {N}/{N} PASS

---

## Level 3: WIRED

Check that declared connections between files actually exist in code.

| # | From | To | Pattern | Match Found | Import Only | Status |
|---|---|---|---|---|---|---|
| 1 | {from_path} | {to_path} | {regex} | {YES/NO} | {YES/NO} | {PASS/FAIL} |
| 2 | {from_path} | {to_path} | {regex} | {YES/NO} | {YES/NO} | {PASS/FAIL} |

### Wiring Details
For each key_link, verify:
1. `grep -E "{pattern}" {from_path}` returns at least one match
2. The match is NOT import-only (pattern appears in function body, not just import statement)
3. The `to` file actually exports what `from` file uses

| # | From | Grep Command | Matches | In Function Body | Status |
|---|---|---|---|---|---|
| 1 | {from_path} | `grep -E "{pattern}" {from_path}` | {N matches} | {YES/NO} | {PASS/FAIL} |

**Level 3 Result:** {N}/{N} PASS

---

## Truths Verification

Check each declared truth against actual evidence.

| # | Truth | Evidence Type | Evidence | Status |
|---|---|---|---|---|
| 1 | {observable behavior} | {test_result / grep / manual} | {test name or code reference} | {PASS/FAIL/UNVERIFIABLE} |
| 2 | {observable behavior} | {test_result / grep / manual} | {test name or code reference} | {PASS/FAIL/UNVERIFIABLE} |

### Evidence Collection Methods (in priority order)
1. **test_result:** Run existing test that proves the truth → strongest evidence
2. **grep:** Grep for code that implements the behavior → moderate evidence
3. **build:** Build succeeds with the feature compiled → weak evidence
4. **manual:** No automated way to verify → document why and note as UNVERIFIABLE

**Truths Result:** {N}/{N} PASS

---

## Summary

| Level | Checked | Passed | Failed |
|---|---|---|---|
| Level 1 (Exists) | {N} | {N} | {N} |
| Level 2 (Substantive) | {N} | {N} | {N} |
| Level 3 (Wired) | {N} | {N} | {N} |
| Truths | {N} | {N} | {N} |
| **Total** | **{N}** | **{N}** | **{N}** |

## Verdict: {VERIFIED|GAPS_FOUND|FAILED}

---

## Gap Details
<!-- If verdict is VERIFIED, write "No gaps found." -->
<!-- If verdict is GAPS_FOUND or FAILED, list each gap: -->

### Gap {N}: {gap title}
- **Level:** {1/2/3/truth}
- **Item:** {artifact path or truth statement}
- **Expected:** {what was expected}
- **Actual:** {what was found}
- **Suggested Fix:** {specific action to resolve the gap}
- **Priority:** {CRITICAL/HIGH/MEDIUM}
```

---

## Verifier Agent Instructions

### How to Fill Each Section

#### Level 1 (EXISTS)
1. Read `must_haves.artifacts` from plan.md YAML frontmatter
2. For each artifact:
   - Run `Glob` to check if `path` exists
   - If exists, count lines (e.g., `wc -l {path}`)
   - Compare line count to `min_lines`
   - PASS = file exists AND lines >= min_lines
   - FAIL = file missing OR lines < min_lines

#### Level 2 (SUBSTANTIVE)
1. For each artifact with `exports` list:
   - Grep for each export name in the file (e.g., `grep "func {export}" {path}` or `grep "export.*{export}" {path}`)
   - PASS = export is defined (not just referenced)
   - FAIL = export not found or is only a type declaration without implementation
2. Run stub pattern scan on ALL artifact files:
   - `grep -n "TODO\|FIXME\|HACK\|XXX" {path}`
   - `grep -n "placeholder\|lorem ipsum\|sample data" {path}`
   - Check for empty function bodies (language-specific)
   - CRITICAL stubs cause FAIL; WARNING stubs are noted

#### Level 3 (WIRED)
1. Read `must_haves.key_links` from plan.md
2. For each key_link:
   - Run `grep -E "{pattern}" {from}` to check for matches
   - If matches found, verify they are NOT import-only:
     - Check if pattern appears in function bodies, not just import/require statements
   - PASS = pattern matches in function body
   - FAIL = no match OR import-only

#### Truths Verification
1. Read `must_haves.truths` from plan.md
2. For each truth:
   - Look for a test that proves this behavior (best evidence)
   - If no test, grep for code implementing the behavior
   - If behavior is user-observable (HTTP response, CLI output), note the handler/route
   - PASS = strong evidence exists
   - FAIL = no evidence found
   - UNVERIFIABLE = cannot be checked automatically (document reason)

#### Verdict Decision
- **VERIFIED:** ALL levels pass, ALL truths pass or are UNVERIFIABLE with documented reasons
- **GAPS_FOUND:** Some items fail but core functionality works. Gap Details must list specific fixes.
- **FAILED:** Critical items fail (Level 1 failures, multiple Level 2 failures, or truths contradicted by evidence)

---

## Rules

1. **Every check must be evidence-based** — run actual commands, do not assume
2. **Level 1 must pass before checking Level 2** — if files do not exist, there is nothing to verify
3. **Level 2 must pass before checking Level 3** — if files are stubs, wiring checks are meaningless
4. **Import-only is NOT wired** — a file that imports but never calls a function fails Level 3
5. **UNVERIFIABLE truths are acceptable** if documented — but more than 50% UNVERIFIABLE triggers a warning
6. **Maximum 200 lines** for the entire verification report
7. **Do not modify any code** — the verifier only reads and reports
8. **Gap Details must have Suggested Fix** — every gap must include a specific, actionable fix
9. **Priority levels:** CRITICAL = blocks user value, HIGH = degrades functionality, MEDIUM = quality concern
