# Smart Model Routing

> Dynamically selects the optimal model for each agent dispatch based on task complexity.
> Reduces cost 30-50% while maintaining quality where it matters.

## Complexity Scoring

Before dispatching any agent, PM calculates a complexity score (0-10):

### Input Factors
| Factor | Weight | How to Measure |
|---|---|---|
| File count | 2 | Number of files in task's `<files>` |
| Dependency depth | 2 | Number of `depends_on` references |
| Domain novelty | 3 | Is this a pattern in `.forge/memory/patterns.json`? No = high |
| Security sensitivity | 2 | Auth/crypto/payment related keywords |
| Prior failure rate | 1 | Revision count for similar tasks in metrics.json |

### Score Calculation
```
complexity = 0
complexity += min(files_count, 5) * 0.4        # 0-2 points
complexity += min(depends_on_count, 3) * 0.67   # 0-2 points
complexity += (novel_domain ? 3 : 0)             # 0 or 3 points
complexity += (security_sensitive ? 2 : 0)       # 0 or 2 points
complexity += min(prior_failure_rate, 1) * 1     # 0-1 points
```

### Model Selection
| Complexity | Model | Rationale |
|---|---|---|
| 0-3 (Low) | haiku | Simple, well-understood tasks |
| 4-6 (Medium) | sonnet | Standard complexity |
| 7-10 (High) | opus | Complex, novel, or security-critical |

### Override Rules
- `--model quality` → always opus (ignore complexity)
- `--model budget` → always haiku (ignore complexity)
- `--model balanced` → use complexity-based routing (default)
- analysis-security type → force opus regardless
- Plan-checker → always ≥ sonnet (quality gate must be strong)

### Per-Agent Adjustments
| Agent | Adjustment |
|---|---|
| researcher (parallel) | -2 from score (exploration is cheaper) |
| planner | +1 to score (planning quality is critical) |
| plan-checker | min score = 4 (never use haiku) |
| implementer | use calculated score |
| code-reviewer | -1 from score (review is pattern-based) |
| verifier | use calculated score |
| debugger | +2 to score (diagnosis needs deep reasoning) |

### Cost Tracking
After each agent dispatch, record to trace.jsonl:
- model used
- complexity score
- estimated tokens

PM can review cost efficiency:
```bash
node forge-tools.js metrics-summary
```

### Adaptive Learning
- If haiku agent needs revision → next similar task gets +2 complexity
- If opus agent passes with zero revisions → next similar task gets -1 complexity
- Stored in `.forge/memory/model-routing-history.json`
