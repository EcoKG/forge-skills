# config.json Field Reference

| Field | Values | Default | Description |
|---|---|---|---|
| mode | interactive, autonomous | interactive | interactive: confirm each step. autonomous: auto-proceed |
| granularity | coarse, standard, fine | standard | Phase count: coarse(3-5), standard(5-8), fine(8-12) |
| model | quality, balanced, budget | balanced | Model selection profile |
| review | strict, normal, light | normal | Code review intensity |
| git_branching | none, phase, milestone | none | Branch strategy |
| skip_tests | true, false | false | Skip test generation/execution |
| auto_discuss | true, false | true | Auto-detect gray areas before planning |
| workflow.research | true, false | true | Enable research phase |
| workflow.plan_check | true, false | true | Enable plan-checker verification |
| workflow.verifier | true, false | true | Enable goal-backward verification |
| workflow.quick_mode | true, false | false | Default to quick mode (3-step pipeline) |
| workflow.nyquist_validation | true, false | false | Enable test coverage sampling |
| parallelization.enabled | true, false | true | Enable wave-based parallel execution |
| parallelization.max_concurrent_agents | 1-5 | 3 | Max parallel agents per wave |
| safety.always_confirm_destructive | true, false | true | Require confirmation for destructive ops |
| safety.always_confirm_external_services | true, false | true | Require confirmation for external API calls |

## Priority
CLI flags > config.json > defaults
