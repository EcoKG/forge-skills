# Forge Framework v8.0 "Nova"

A skill execution platform for Claude Code — Gatekeeper routes intent, Pipeline Engine executes, Gate Guard enforces.

---

## What is it?

Forge Framework v8.0 "Nova" is a paradigm shift from v7.0: where the old `forge` was one skill among many, Nova is the platform that all skills run on. Every code modification request flows through a Haiku-powered Gatekeeper that classifies intent and routes to the right skill — no manual invocation required. Skills declare what they do in a YAML manifest; the framework handles routing, workspace sandboxing, pipeline execution, and quality enforcement.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Claude Code                       │
│                                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │          Forge Framework v8.0 "Nova"         │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │         Core Services                 │  │ │
│  │  │                                       │  │ │
│  │  │  ① Gatekeeper    ④ Pipeline Engine   │  │ │
│  │  │  ② Workspace Ctx ⑤ Agent Orchestr.  │  │ │
│  │  │  ③ Gate Guard    ⑥ Quality System   │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  │                    ▲                         │ │
│  │                    │ Framework API           │ │
│  │  ┌─────────┬──────┴───┬──────────────────┐  │ │
│  │  │forge-dev│ deploy   │ skill-creator    │  │ │
│  │  │(개발)   │ (배포)    │ (스킬 생성)      │  │ │
│  │  │         │          │                  │  │ │
│  │  │ 현재의  │ 커스텀    │ 기존 스킬        │  │ │
│  │  │ forge   │ 스킬     │                  │  │ │
│  │  └─────────┴──────────┴──────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Core Modules

| Module | Role |
|---|---|
| **Gatekeeper** | Haiku sub-agent that classifies every user turn and routes to the correct skill — zero manual invocation needed |
| **Workspace Context** | Docker-mount-style file scope: declares what a skill can read, write, or must ignore per pipeline run |
| **Gate Guard** | Final hard enforcer — PreToolUse hook that blocks scope violations and pipeline order violations via `exit(2)` |
| **Pipeline Engine** | Universal step executor: manages state, validates gates, and dispatches agents for any skill's declared pipeline |
| **Agent Orchestration** | Model-routing layer: assigns Haiku / Sonnet / Opus to each agent role based on cost and capability needs |
| **Quality System** | Framework-provided 7-layer quality stack (deep work, self-check, peer review, QA gate, VPM) — skills extend, never disable |

---

## Quick Start

**One-line install:**
```bash
curl -fsSL https://raw.githubusercontent.com/EcoKG/forge-skills/main/forge-framework/setup.sh | bash
```

**Or manual:**
```bash
# 1. Clone
git clone https://github.com/EcoKG/forge-skills.git ~/.claude/skills/forge-skills

# 2. Install hooks
node ~/.claude/skills/forge-skills/forge-framework/core/install.js

# 3. Restart Claude Code
# That's it! Gatekeeper + Gate Guard are now active.
```

After installation, every Claude Code session automatically:
- Spawns the Gatekeeper agent on first user turn
- Routes code-modification requests to the appropriate skill
- Enforces Gate Guard on all file writes

---

## Creating Your First Skill

A minimal skill is five lines of YAML:

```yaml
---
name: my-skill
description: "What this skill does — used by Gatekeeper for routing"
routing:
  triggers: ["deploy", "release", "rollback"]
---
Skill instructions here...
```

This alone gives you Gatekeeper routing and Gate Guard protection. Add `framework.pipeline`, `framework.workspace`, and `framework.quality` progressively as complexity grows.

See the [Developer Guide](templates/skill-template/SKILL.md) and the [skill template](templates/skill-template/) to get started.

---

## Example Skills

| Skill | Description |
|---|---|
| **forge-dev** | Full autonomous development pipeline — research, plan, execute, verify, finalize with 6 pipeline modes |
| **deploy** *(example)* | CI/CD and infrastructure deployment with approval gates and rollback support |
| **skill-creator** *(example)* | Scaffolds a new skill from the template, generates SKILL.md, prompts, and pipeline config |

---

## Project Structure

```
forge-framework/
├── SKILL.md                    # Framework entry point
├── README.md                   # This file
│
├── core/
│   ├── gatekeeper-init.js      # SessionStart: builds skill catalog, initializes state
│   ├── gatekeeper-router.js    # UserPromptSubmit: injects routing instructions
│   ├── gate-guard.js           # PreToolUse: enforces pipeline gates, blocks violations
│   ├── workspace-context.js    # Workspace Context API (scope/readonly/ignore)
│   ├── pipeline-engine.js      # Universal pipeline executor
│   ├── orchestrator.js         # Pipeline state injection per turn
│   ├── tracker.js              # Structured logging
│   ├── install.js              # Hook registration installer
│   └── package.json
│
├── prompts/
│   └── gatekeeper.md           # Gatekeeper agent prompt
│
├── shared/
│   ├── constants.js            # Shared constants across core modules
│   └── pipeline.js             # Pipeline schema helpers
│
├── skills/
│   └── forge-dev/              # Built-in development skill
│       ├── SKILL.md
│       ├── prompts/            # 17 agent prompts (researcher, planner, implementer, ...)
│       ├── templates/          # Pipeline definitions + artifact templates
│       ├── checklists/         # Language-specific quality checklists
│       └── references/         # Extended reference docs for agents
│
└── templates/
    └── skill-template/         # Copy-paste starter for new skills
        ├── SKILL.md
        └── prompts/
            └── agent.md
```

---

## Design Principles

1. **Declaration-Decision-Execution separation** — Skills declare *what*, Gatekeeper decides *when*, Pipeline Engine handles *how*. Each layer has one job.

2. **User intent first** — User configuration always overrides framework defaults. The framework serves the developer, not the other way around.

3. **Protocol invariance** — Core contracts (step interface, gate API, manifest schema) are preserved across versions. Skills written for v8.0 remain compatible.

4. **Optimization is not a security boundary** — Gatekeeper can fail safely (fail-open); Gate Guard never fails open (fail-closed, `exit(2)`). Removing Gatekeeper degrades UX, not safety.

5. **Progressive complexity** — A 5-line skill gets routing and protection. A production skill adds pipelines, workspace scopes, and custom quality layers incrementally. No big-bang adoption required.

---

## Contributing

1. Fork the repository and create a branch: `git checkout -b feat/your-feature`
2. Follow the existing code style — ES modules, JSDoc on public functions.
3. For new core modules, add a corresponding entry to `core/install.js` hook registration.
4. For new example skills, use `templates/skill-template/` as the starting point and ensure the manifest validates against the skill schema.
5. Open a pull request with a clear description of the change and its motivation.
6. Breaking changes to the Framework API (step interface, gate contract, manifest schema) require an ADR in `skills/forge-dev/references/`.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

## License

MIT — see [LICENSE](LICENSE) for details.

---

## 한국어 문서

Forge Framework v8.0 "Nova"는 Claude Code 위에서 동작하는 스킬 실행 플랫폼으로, Gatekeeper가 의도를 분류하고 Pipeline Engine이 실행하며 Gate Guard가 품질을 강제합니다.

### 문서 링크

- [시작하기](docs/getting-started-ko.md) — 설치부터 첫 스킬 실행까지
- [사용 시나리오](docs/usage-scenarios-ko.md) — 실전 사용 예시
- [스킬 개발 가이드](docs/skill-developer-guide-ko.md) — Level 0~4 튜토리얼

### 설치

```bash
git clone https://github.com/EcoKG/forge-skills.git ~/.claude/skills/forge-skills
node ~/.claude/skills/forge-skills/forge-framework/core/install.js
# Claude Code 재시작 — 완료!
```
