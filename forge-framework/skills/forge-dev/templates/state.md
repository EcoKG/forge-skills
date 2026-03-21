# Forge Project State

> This file is the session bridge. A new session reads this to know where the project is.
> Max 100 lines. Oldest entries are trimmed when exceeding.

## Current Position
- **Project:** {project_name}
- **Milestone:** {N} ({milestone_name})
- **Phase:** {N} of {total} ({phase_name})
- **Phase Status:** {pending|in_progress|completed}
- **Progress:** {progress_bar} {percent}%

## Recent Decisions
- [{YYYY-MM-DD}] {decision description}

## Blockers
- (none)

## Next Action
{exactly 1 line: what should happen next}

## Execution Recovery
- **Last Execution:** (none)
- **Last Completed Task:** (none)
- **Lock Status:** none
- **Resumable:** no

## Session History
- {YYYY-MM-DD HH:MM}: {event description}

---

## RULES
- MAX 100 lines total. Trim oldest Session History entries when exceeding.
- Recent Decisions: keep last 10. Older ones archived to phase context.md.
- Blockers: remove when resolved, add date when adding.
- Next Action: ALWAYS exactly 1 line. Updated after every significant event.
- Progress bar format: ████░░░░░░ (filled = completed phases / total phases)
- Session History: chronological, max 20 entries.
