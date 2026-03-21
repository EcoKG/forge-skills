---
name: release
description: |
  Release management skill for version bumping, changelog generation, tagging, and publish preparation.
  Follows semantic versioning. Manages package.json, CHANGELOG.md, and git tags.
  Part of the Forge Framework v8.0 ecosystem.
routing:
  triggers:
    - release, 릴리즈
    - version bump, 버전 올려줘
    - changelog, 체인지로그
    - tag, 태그
    - cut a release, 릴리즈 만들어줘
    - bump patch, bump minor, bump major
    - prepare release
  anti-triggers:
    - explain release process, 릴리즈 프로세스 설명
    - what is semver, semver이란
    - how does versioning work
    - what is a changelog
  modes:
    patch: "Bug fix release — bump Z in X.Y.Z"
    minor: "New feature release — bump Y, reset Z"
    major: "Breaking change release — bump X, reset Y.Z"
  priority: normal
  categories:
    - command
    - code-modify
framework:
  pipeline: release-pipeline
  workspace:
    scope:
      - package.json
      - package-lock.json
      - CHANGELOG.md
      - version.txt
      - VERSION
      - pyproject.toml
      - Cargo.toml
      - build.gradle
    readonly:
      - src/**
      - tests/**
    ignore:
      - node_modules/
      - .git/
      - dist/
      - build/
  quality:
    inherit: true
---

# release — Release Management Skill

> Part of the Forge Framework v8.0 "Nova".
> Pipeline: version-check → changelog → bump → tag → publish-prep.
> Manages version files and CHANGELOG.md. Read-only access to src/** and tests/**.

---

## 1. Pipeline Overview

```
version-check   — Read current version, validate semver, confirm bump type
changelog       — Collect commits since last tag, draft CHANGELOG entry
bump            — Update version in all version files
tag             — Create annotated git tag
publish-prep    — Final checklist before push/publish
```

---

## 2. Mode Behavior

### patch (X.Y.Z → X.Y.Z+1)
- For: bug fixes, security patches, dependency updates with no API change
- Changelog section: `### Fixed`, `### Security`
- Example: 1.4.2 → 1.4.3

### minor (X.Y.Z → X.Y+1.0)
- For: new backwards-compatible features, deprecations (no removal)
- Changelog sections: `### Added`, `### Changed`, `### Deprecated`
- Example: 1.4.2 → 1.5.0

### major (X.Y.Z → X+1.0.0)
- For: breaking changes, removed APIs, incompatible behavior changes
- Changelog sections: `### Breaking`, `### Added`, `### Changed`, `### Removed`
- Requires explicit user confirmation: "This is a major version bump — proceed?"
- Example: 1.4.2 → 2.0.0

---

## 3. Step Instructions

### version-check
1. Read the current version from `package.json` (or `pyproject.toml`, `Cargo.toml`, `VERSION` — whichever exists).
2. Parse and validate it is a valid semver string (X.Y.Z).
3. Determine the bump type from the mode or from the user's request.
4. Calculate the next version string.
5. Show the user: "Current: X.Y.Z → Next: A.B.C — proceed?"
6. For major bumps: require explicit confirmation before continuing.

### changelog
1. Run `git log <last-tag>..HEAD --oneline` to get commits since the last release.
2. Group commits by conventional commit prefix:
   - `feat:` → Added
   - `fix:` → Fixed
   - `feat!:` / `BREAKING CHANGE:` → Breaking
   - `perf:` → Changed
   - `docs:`, `chore:`, `ci:` → omit unless significant
3. If conventional commits are not used: list commits as-is and ask the user to review the grouping.
4. Draft the CHANGELOG entry in Keep-a-Changelog format:

   ```
   ## [A.B.C] — YYYY-MM-DD

   ### Added
   - ...

   ### Fixed
   - ...
   ```

5. Show the draft to the user and ask for edits before writing.
6. Prepend the confirmed entry to `CHANGELOG.md` (after the `# Changelog` header).

### bump
1. Update the version field in all detected version files:
   - `package.json` → `"version": "A.B.C"`
   - `package-lock.json` → top-level `"version"` field (if present)
   - `pyproject.toml` → `version = "A.B.C"` under `[tool.poetry]` or `[project]`
   - `Cargo.toml` → `version = "A.B.C"` under `[package]`
   - `version.txt` / `VERSION` → replace entire content with `A.B.C`
2. Do NOT modify `src/**` or `tests/**`.
3. Show a diff summary of all changed files before writing.

### tag
1. Stage only the version files and `CHANGELOG.md`.
2. Produce the commit message:
   ```
   chore(release): v A.B.C
   ```
3. Show the commit and tag plan to the user:
   - Commit: `chore(release): vA.B.C`
   - Tag: `vA.B.C` (annotated, message: `Release vA.B.C`)
4. Wait for user confirmation, then create the commit and annotated tag.
5. Do NOT push. Pushing is the user's responsibility.

### publish-prep
Produce `release-checklist.md` — a final pre-push checklist:

```markdown
## Release vA.B.C — Pre-publish Checklist

- [ ] Version bumped: package.json (and all version files)
- [ ] CHANGELOG.md updated with this release
- [ ] Git tag created: vA.B.C
- [ ] CI passes on the release commit
- [ ] Breaking changes documented (if major)
- [ ] Migration guide written (if major)
- [ ] npm publish / cargo publish / pypi upload ready
- [ ] git push origin main && git push origin vA.B.C
```

Report to the user: "Release vA.B.C prepared. Review `release-checklist.md` before pushing."

---

## 4. Workspace Rules

- Version files and `CHANGELOG.md` are the only writable files.
- `src/**` and `tests/**` are read-only. Never modify them during a release.
- Never commit secrets, local config, or build artifacts.
- Never push to the remote. The `tag` step commits locally only.

---

## 5. Artifacts

| File | Produced by |
|---|---|
| `CHANGELOG.md` (updated) | changelog step |
| `release-checklist.md` | publish-prep step |
