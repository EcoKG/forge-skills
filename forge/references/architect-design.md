# Architect: Design Mode

## Process

1. **Read all inputs:**
   - Read `{RESEARCH_PATH}` if provided — extract architecture-relevant findings (H/M severity).
   - Read all files in `{FILES_TO_READ}` — understand existing patterns, conventions, dependencies.
   - Read `{CONSTRAINTS}` if provided — these are HARD constraints that override your design choices.

2. **Identify architectural concerns:**
   - **Components:** What logical units does the system need? What are their responsibilities?
   - **Boundaries:** Where do module/service boundaries lie? What crosses them?
   - **Data Flow:** How does data enter, transform, and exit the system?
   - **Integration Points:** What external systems, APIs, or services does this connect to?
   - **Quality Attributes:** Performance, security, scalability, maintainability requirements?

3. **Evaluate design options:**
   For each significant design decision:
   - List 2-3 genuinely different options
   - Evaluate each against: complexity, maintainability, performance, alignment with existing patterns
   - Select recommended option with clear rationale
   - Record as ADR entries within the design

4. **Design the architecture:**
   - Component structure with responsibilities
   - Interfaces between components (function signatures, API contracts, event schemas)
   - Data models (entities, relationships, storage strategy)
   - Dependency direction (who depends on whom, inversion points)
   - Error handling strategy across boundaries

5. **Validate:**
   - Verify no circular dependencies
   - Verify every HIGH finding from research maps to at least one component
   - Verify quality attributes are addressed
   - Verify constraint compliance

6. **Write output** to `{OUTPUT_PATH}`.

## Output Contract

Max **600 lines**.

```markdown
# Architecture Design: {title}

## Overview
{2-3 sentence summary}

## Requirements Mapping
| Requirement | Component(s) | Notes |
|---|---|---|
| {REQ or finding} | {component} | {how addressed} |

## Components

### {Component Name}
- **Responsibility:** {single sentence}
- **Type:** {service|module|library|middleware|store|gateway}
- **Public Interface:**
  ```{language}
  {function/method signatures or API endpoints}
  ```
- **Dependencies:** {list}
- **Data Owned:** {what data/state this manages}

## Data Models

### {Entity Name}
```{language}
{type/schema definition}
```
- **Owned by:** {component}
- **Relationships:** {related entities}

## Data Flow
```
{Request} -> [Gateway] -> [Service A] -> [Store]
                       -> [Service B] -> [External API]
```

## Architecture Decisions

### ADR-001: {Title}
- **Status:** Accepted
- **Context:** {problem}
- **Options:** 1. {A} — {pros/cons} | 2. {B} — {pros/cons}
- **Decision:** {selected}
- **Rationale:** {why}
- **Consequences:** {trade-offs}

## Quality Attributes
| Attribute | Strategy | Components |
|---|---|---|
| {Performance} | {strategy} | {components} |

## Dependency Graph
```
{A} -> {B} -> {C}
            -> {D}
```

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| {risk} | H/M/L | {strategy} |
```
