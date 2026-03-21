# Architecture {mode_title}: {title}

## Overview
{2-3 sentence summary}

<!-- Design Mode sections -->

## Requirements Mapping
| Requirement | Component(s) | Notes |
|---|---|---|
| {requirement} | {component} | {notes} |

## Components

### {Component Name}
- **Responsibility:** {single sentence}
- **Type:** {service|module|library|middleware|store|gateway}
- **Public Interface:**
  ```{language}
  {signatures}
  ```
- **Dependencies:** {components}
- **Data Owned:** {data/state}

## Data Models

### {Entity Name}
```{language}
{type/schema definition}
```
- **Owned by:** {component}
- **Relationships:** {related entities}

## Data Flow
```
{ASCII diagram}
```

## Architecture Decisions

### ADR-001: {Title}
- **Status:** {Proposed|Accepted|Deprecated|Superseded}
- **Context:** {problem}
- **Options:**
  1. {Option A} — {summary}
  2. {Option B} — {summary}
- **Decision:** {selected}
- **Rationale:** {why}
- **Consequences:** {trade-offs}

## Quality Attributes
| Attribute | Strategy | Components |
|---|---|---|
| {attribute} | {strategy} | {components} |

## Dependency Graph
```
{component relationships}
```

## Constraints Compliance
| Constraint | How Addressed |
|---|---|
| {constraint} | {design choice} |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| {risk} | {H/M/L} | {mitigation} |
