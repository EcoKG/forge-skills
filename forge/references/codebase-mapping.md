# Codebase Mapping Reference

> PM loads this when `--map` flag is detected.
> Produces persistent codebase analysis in `.forge/codebase/`.

<!-- CODEBASE_MAP_START -->

## Codebase Mapping (/forge --map)

### Load
- This section only

### Prerequisites
- A codebase exists in the current directory

### Pipeline

```
Step 1: Dispatch 4 parallel researcher agents (haiku):

  Agent 1 — TECH:
    Focus: languages, frameworks, dependencies, build tools
    Output: .forge/codebase/STACK.md

  Agent 2 — ARCHITECTURE:
    Focus: directory structure, module boundaries, dependency graph, entry points
    Output: .forge/codebase/ARCHITECTURE.md, .forge/codebase/STRUCTURE.md

  Agent 3 — QUALITY:
    Focus: code conventions, naming patterns, test framework, test coverage
    Output: .forge/codebase/CONVENTIONS.md, .forge/codebase/TESTING.md

  Agent 4 — CONCERNS:
    Focus: tech debt, security concerns, performance hotspots, integration points
    Output: .forge/codebase/CONCERNS.md, .forge/codebase/INTEGRATIONS.md

Step 2: Security scan
  - Grep for accidentally leaked secrets (API keys, passwords, tokens)
  - Flag but do not report content (just file paths)

Step 3: Summary
  - Read all 7 documents (paths only to PM)
  - Display: tech stack, architecture style, test coverage, key concerns
```

### Codebase Document Templates

**STACK.md:**
```
# Tech Stack
## Languages: {list with versions}
## Frameworks: {list with versions}
## Build: {build tool + config file}
## Package Manager: {npm/pip/go mod/cargo}
## Key Dependencies: {top 10 by import count}
```

**ARCHITECTURE.md:**
```
# Architecture
## Style: {monolith/microservice/serverless/modular}
## Entry Points: {main files}
## Module Boundaries: {how code is organized}
## Data Flow: {request lifecycle}
## Key Patterns: {MVC/CQRS/Event-Driven/etc.}
```

**CONVENTIONS.md:**
```
# Code Conventions
## Naming: {camelCase/snake_case/PascalCase}
## File Organization: {by feature/by type/mixed}
## Error Handling: {pattern used}
## Logging: {framework + pattern}
## Config: {env vars/config files/both}
```

### Cache Rules
- Documents cached for 30 days (same as project-profile.json)
- Refresh with: `/forge --map` (explicit re-run)
- Auto-refresh: when project-profile.json is stale
- Research step (Step 2) auto-loads `.forge/codebase/` if exists

### Integration with Forge Pipeline
- Step 2 (RESEARCH): if `.forge/codebase/` exists, researcher agents receive these paths in `<files_to_read>`, reducing duplicate exploration
- Step 3 (PLAN): planner receives CONVENTIONS.md to follow existing patterns
- `/forge --init`: runs `--map` automatically for brownfield projects

<!-- CODEBASE_MAP_END -->
