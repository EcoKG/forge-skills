# Architect: Analyze Mode

## Process

1. **Read the codebase:**
   - Read all files in `{FILES_TO_READ}`
   - Use Glob to discover directory structure
   - Use Grep to trace imports, dependencies, and patterns

2. **Map the current architecture:**
   - Identify components/modules and their boundaries
   - Trace dependency graph (who imports whom)
   - Identify layers (if any) and their responsibilities
   - Map data flow through the system

3. **Assess architectural health across 7 dimensions:**

   | Dimension | What to Check | Evidence Method |
   |---|---|---|
   | Coupling | Module interdependencies | Import counts, shared state grep |
   | Cohesion | Single responsibility | File sizes, mixed concerns |
   | Layering | Clear separation, no violations | Directory structure, cross-layer imports |
   | Dependency Direction | One-way flow, no cycles | Circular import detection |
   | API Boundaries | Clean, minimal interfaces | Public export analysis |
   | Error Handling | Consistent across boundaries | Error pattern grep |
   | Testability | Isolation possible | DI usage, test file existence |

4. **Rate each dimension:** GOOD / FAIR / POOR with specific evidence.

5. **Recommend improvements:**
   - For each POOR/FAIR rating, provide specific refactoring recommendations
   - Prioritize by impact (biggest improvement first)
   - Include migration strategy (incremental, not big-bang)

6. **Write output** to `{OUTPUT_PATH}`.

## Output Contract

Max **400 lines**.

```markdown
# Architecture Analysis: {project/area name}

## Overview
{2-3 sentence summary}

## Component Map
| Component | Path(s) | Responsibility | Lines | Dependencies |
|---|---|---|---|---|
| {name} | {paths} | {what it does} | {LOC} | {import count} |

## Dependency Graph
```
{ASCII representation of actual import structure}
```

## Health Assessment

| Dimension | Rating | Key Evidence |
|---|---|---|
| Coupling | {GOOD/FAIR/POOR} | {specific finding} |
| Cohesion | {GOOD/FAIR/POOR} | {specific finding} |
| Layering | {GOOD/FAIR/POOR} | {specific finding} |
| Dependency Direction | {GOOD/FAIR/POOR} | {specific finding} |
| API Boundaries | {GOOD/FAIR/POOR} | {specific finding} |
| Error Handling | {GOOD/FAIR/POOR} | {specific finding} |
| Testability | {GOOD/FAIR/POOR} | {specific finding} |

**Overall: {GOOD|FAIR|POOR}** (5+ GOOD = GOOD, 3+ FAIR = FAIR, 3+ POOR = POOR)

### Detailed Findings
<!-- Only for FAIR/POOR dimensions -->

#### {Dimension}: {Rating}
- **Evidence:** {grep/glob command and result}
- **Issue:** {what's wrong}
- **Impact:** {how it affects development}

## Recommended Improvements
| Priority | Issue | Current | Target | Migration Strategy |
|---|---|---|---|---|
| 1 | {issue} | {current} | {target} | {how} |
```
