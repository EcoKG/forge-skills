# Architect: Guide Mode

## Process

1. **Read research findings:**
   - Read `{RESEARCH_PATH}` — extract architecture-relevant findings
   - Read all files in `{FILES_TO_READ}` — focus on structure and patterns

2. **Identify the current architecture pattern:**
   Analyze directory structure via Glob:
   - `domain/`, `application/`, `infrastructure/` → Clean Architecture / DDD
   - `src/controllers/`, `src/models/`, `src/views/` → MVC
   - `ports/`, `adapters/` → Hexagonal Architecture
   - `src/modules/` or feature-based folders → Module Architecture
   - Flat structure with no clear separation → No formal pattern

   Trace import/dependency direction via Grep:
   - Domain imports infra? → Violation (in Clean/DDD/Hexagonal)
   - One-way dependency flow? → Layered or Clean

   Sample 3+ existing features to confirm pattern:
   - File placement, naming, layer separation
   - Interfaces/abstractions used
   - Conventions followed (naming, error handling, DI)

   If multiple patterns detected, identify the primary pattern and note secondary patterns.

3. **Determine pattern verdict:**
   - **Detected:** {Pattern Name} with confidence HIGH/MEDIUM/LOW
   - If LOW confidence or no pattern: "Pattern: Not determined — recommend establishing one"

   Known patterns: DDD, Clean Architecture, Hexagonal, Layered (N-tier), MVC/MVVM/MVP, Module Architecture, Microservice, CQRS, Event-Driven

4. **Generate implementation guide for the requested feature:**
   - **Directory Rules:** Where should new files be placed? (exact paths)
   - **Dependency Rules:** What can import what? What is forbidden?
   - **Interface Rules:** What abstractions should be created?
   - **Convention Rules:** Naming, error handling, DI patterns to follow
   - **Anti-patterns:** What to avoid in this architecture

5. **Write output** to `{OUTPUT_PATH}`.

## Output Contract

Max **200 lines**.

```markdown
# Design Guide: {feature description}

## Identified Pattern
- **Pattern:** {DDD | Clean Architecture | Hexagonal | Layered | MVC | Module | None}
- **Confidence:** {HIGH | MEDIUM | LOW}
- **Evidence:**
  - Directory structure: {what was found}
  - Dependency direction: {what was found}
  - Feature samples: {patterns observed}

## Directory Rules
| New File Type | Target Path | Example |
|---|---|---|
| Domain entity | {path pattern} | {existing example} |
| Service/Use case | {path pattern} | {existing example} |
| Repository/Adapter | {path pattern} | {existing example} |
| Controller/Handler | {path pattern} | {existing example} |
| Test | {path pattern} | {existing example} |

## Dependency Rules
| From (Layer) | To (Layer) | Allowed | Direction |
|---|---|---|---|
| {layer A} | {layer B} | YES/NO | {inward/outward} |

## Implementation Guide
For the requested feature "{USER_REQUEST}":
1. {Specific file to create with path and responsibility}
2. {Specific interface to define}
3. {Specific wiring/registration needed}
4. {Test strategy following existing patterns}

## Anti-patterns to Avoid
- {Specific anti-pattern for this architecture}
```
