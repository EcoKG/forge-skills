# Architect: ADR Mode

## Process

1. **Read context:**
   - Read `{FILES_TO_READ}` to understand the relevant codebase area
   - Read `{CONSTRAINTS}` for locked decisions
   - Read `{RESEARCH_PATH}` if available
   - Check for existing ADRs: `Glob("**/ADR-*.md")` or `Glob("**/adr-*.md")` — continue numbering from the highest existing number

2. **For each decision to record:**
   - **Title:** Short, descriptive (e.g., "Use PostgreSQL for primary datastore")
   - **Status:** Proposed / Accepted / Deprecated / Superseded
   - **Context:** What problem are we solving? What constraints exist?
   - **Options Considered:** 2-3 genuinely different options with pros/cons
   - **Decision:** Which option was selected
   - **Rationale:** WHY this option (not just WHAT)
   - **Consequences:** What changes? What trade-offs are accepted?

3. **Write output** to `{OUTPUT_PATH}`.

## Output Contract

Max **200 lines**.

```markdown
# Architecture Decision Records

## ADR-{NNN}: {Decision Title}

### Status
{Proposed | Accepted | Deprecated | Superseded by ADR-XXX}

### Context
{What is the issue? What forces/constraints?
Reference research findings [Hx] [Mx] if applicable.}

### Options Considered

#### Option 1: {Name}
- **Pros:** {advantages}
- **Cons:** {disadvantages}
- **Fits constraints:** {yes/no + detail}

#### Option 2: {Name}
- **Pros:** {advantages}
- **Cons:** {disadvantages}
- **Fits constraints:** {yes/no + detail}

### Decision
We will use **{selected option}**.

### Rationale
{Why chosen over others. Reference specific pros that align
with priorities and constraints that eliminate alternatives.}

### Consequences
- **Positive:** {benefits}
- **Negative:** {trade-offs}

### Follow-up Actions
- {action needed to implement this decision}
```
