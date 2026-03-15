# Project Roadmap: {project_name}

## Overview
{1-2 sentence project summary}

## Milestone 1: {milestone_name}

### Phase 1: {phase_name}
- **Goal:** {1 sentence describing what this phase achieves}
- **Depends on:** none
- **Requirements:** [{REQ-ID-1}, {REQ-ID-2}]
- **Success Criteria:**
  - {observable user behavior 1}
  - {observable user behavior 2}
- **Status:** pending
- **Plans:** 0

### Phase 2: {phase_name}
- **Goal:** {1 sentence describing what this phase achieves}
- **Depends on:** Phase 1
- **Requirements:** [{REQ-ID-3}]
- **Success Criteria:**
  - {observable user behavior 1}
  - {observable user behavior 2}
- **Status:** pending
- **Plans:** 0

---

## Progress Summary

| Phase | Status | Plans | Completed |
|---|---|---|---|
| Phase 1: {name} | pending | 0 | 0 |
| Phase 2: {name} | pending | 0 | 0 |

---

## RULES
- Milestone must have >=1 phase
- Phase must have: Goal (1 sentence), Success Criteria (2-5 observable behaviors), Status
- Status values: pending | in_progress | completed | skipped
- Depends on: list of phase numbers (must form a DAG, no cycles)
- Requirements: REQ-IDs from project definition
- Success Criteria must be user-observable behaviors, NOT technical jargon
- Plans count is updated by the planner after planning completes
