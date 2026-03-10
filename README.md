# forge-skills

Claude Code skills and hooks for autonomous development workflow.

## What's Inside

```
forge-skills/
├── forge/                  # Forge skill — autonomous execution engine
│   ├── SKILL.md            # Main skill definition (install to ~/.claude/skills/forge/)
│   ├── checklists/         # Language-specific code review checklists
│   │   ├── general.md
│   │   ├── javascript.md
│   │   ├── python.md
│   │   ├── go.md
│   │   └── csharp-wpf.md
│   ├── prompts/            # Agent role prompts
│   │   ├── implementer.md
│   │   ├── code-reviewer.md
│   │   ├── doc-reviewer.md
│   │   ├── qa-inspector.md
│   │   └── analyst.md
│   ├── resources/
│   │   └── type-guides.md  # Per-type workflow guides (code, docs, analysis, infra, design)
│   └── templates/          # Output templates (research, plan, report)
│
└── hooks/                  # Hook auto-activation system
    ├── src/
    │   ├── types.ts            # Core type definitions
    │   ├── rules-matcher.ts    # Keyword + intent pattern matching engine
    │   ├── session-tracker.ts  # Session-based dedup tracking
    │   └── skill-activation.ts # UserPromptSubmit hook entry point
    ├── tests/
    │   ├── matcher.test.ts
    │   ├── session-tracker.test.ts
    │   └── skill-activation.test.ts
    ├── skill-rules.json    # Trigger rules (keywords, intent patterns per skill)
    ├── install.sh          # One-command installer
    ├── package.json
    └── tsconfig.json
```

## Forge Skill

Autonomous execution engine that manages the full development lifecycle:

```
research → plan → implement → review → QA
```

Supports task types: `code`, `docs`, `analysis`, `infra`, `design`.

**Usage:**
```
/forge "implement user authentication with JWT"
/forge "refactor the payment module" --scale medium
/forge "security audit on API endpoints" --type analysis
```

## Hook Auto-Activation

A `UserPromptSubmit` hook that analyzes every prompt and suggests relevant skills automatically.

**How it works:**

```
User types prompt → Claude Code triggers UserPromptSubmit hook
                              │
                        stdin: JSON {session_id, prompt}
                              │
                    ┌─────────▼──────────┐
                    │ RulesMatcher        │
                    │  ├─ keyword match   │
                    │  └─ intent regex    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ SessionTracker      │
                    │  └─ filter repeats  │
                    └─────────┬──────────┘
                              │
                        stdout → Claude context
                        exit 0 (always)
```

**Design principles:**
- **Zero-dependency** — only Node.js built-in APIs
- **Fail-open** — all errors exit 0 with empty stdout (never blocks Claude)
- **Fast** — TypeScript pre-compiled via `tsc`, no `npx tsx` cold start
- **Session dedup** — same skill not suggested twice per session

## Installation

### Prerequisites

- **Node.js** v18+ (v22 recommended)
- **Claude Code** CLI installed and configured

### Quick Install (Recommended)

```bash
git clone https://github.com/EcoKG/forge-skills.git
cd forge-skills
```

#### 1. Install the Forge skill

Copy the entire `forge/` directory to your Claude Code skills location:

```bash
# Create skills directory if it doesn't exist
mkdir -p ~/.claude/skills/forge

# Copy all forge files
cp -r forge/* ~/.claude/skills/forge/
```

Verify the skill is loaded by starting Claude Code — you should see `forge` in the available skills list.

#### 2. Install the Hook Auto-Activation system

Run the installer script:

```bash
bash hooks/install.sh
```

The installer will:

1. **Check Node.js** — detects system Node.js or nvm
2. **Build TypeScript** — compiles `hooks/src/` to `hooks/dist/` via `tsc`
3. **Copy skill-rules.json** — deploys trigger rules to `~/.claude/skills/`
4. **Create state directory** — `~/.claude/hooks/state/` for session tracking
5. **Register the hook** — adds `UserPromptSubmit` entry to `~/.claude/settings.json`

> The installer merges into your existing `settings.json` — it will not overwrite your current settings.

#### 3. Verify installation

Test the hook manually:

```bash
echo '{"session_id":"test","prompt":"기능 구현 해줘"}' | node hooks/dist/src/skill-activation.js
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED SKILLS:
  → forge [high] (keywords: 기능 구현; intents: 1)

ACTION: Consider using the Skill tool for the above skill(s) if relevant.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Start a new Claude Code session and type a prompt like "implement a new feature" — the hook will suggest the forge skill automatically.

### Manual Install (Advanced)

If you prefer not to use the installer:

**1. Build the hook:**

```bash
cd hooks
npm install
npx tsc
# or: node ./node_modules/typescript/bin/tsc
```

**2. Copy rules file:**

```bash
mkdir -p ~/.claude/skills
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

**3. Create state directory:**

```bash
mkdir -p ~/.claude/hooks/state
```

**4. Register in settings.json:**

Add the following to `~/.claude/settings.json` under `hooks.UserPromptSubmit`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/node /absolute/path/to/hooks/dist/src/skill-activation.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

> Replace `/path/to/node` with your Node.js binary path (run `which node`) and `/absolute/path/to/hooks/` with the actual path to the cloned repo's `hooks/` directory.

## Customizing Trigger Rules

Edit `hooks/skill-rules.json` (or `~/.claude/skills/skill-rules.json` after install) to add your own skills:

```json
{
  "skills": {
    "my-skill": {
      "type": "domain",
      "enforcement": "suggest",
      "priority": "medium",
      "description": "What this skill does",
      "promptTriggers": {
        "keywords": ["keyword1", "keyword2"],
        "intentPatterns": [
          "(create|build).*?(widget|component)"
        ]
      },
      "skipConditions": {
        "sessionSkillUsed": true
      }
    }
  }
}
```

| Field | Values | Description |
|---|---|---|
| `type` | `domain` / `guardrail` | Skill category |
| `enforcement` | `suggest` / `block` / `warn` | How aggressively to recommend |
| `priority` | `critical` / `high` / `medium` / `low` | Ranking when multiple skills match |
| `keywords` | string[] | Substring match (case-insensitive) |
| `intentPatterns` | string[] | Regex patterns (case-insensitive) |
| `skipConditions.sessionSkillUsed` | boolean | Skip if already suggested this session |

After editing, copy the updated file:
```bash
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

## Running Tests

```bash
cd hooks
npm install
npx tsc
node --test dist/tests/matcher.test.js
node --test dist/tests/session-tracker.test.js
node --test dist/tests/skill-activation.test.js
```

## Uninstall

Remove the hook entry from `~/.claude/settings.json` (delete the `UserPromptSubmit` block containing `skill-activation`), then optionally:

```bash
rm -rf ~/.claude/hooks/state
rm ~/.claude/skills/skill-rules.json
rm -rf ~/.claude/skills/forge
```

## License

MIT
