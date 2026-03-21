/**
 * Workspace Context API — Forge Framework v8.0
 *
 * Manages workspace-context.json: creation, loading, file classification,
 * and scope expansion. Used by engine-init and gate guard.
 *
 * Exports:
 *   createContext(root, stackProfile, artifactDir) → context
 *   loadContext(artifactDir, cwd) → context | null
 *   classifyFile(absFilePath, context) → "ignore"|"readonly"|"scope"|"external"|"out-of-scope"
 *   expandScope(artifactDir, cwd, pattern, reason, step) → void
 *
 * CommonJS module — no ES module syntax.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Default ignore patterns always included regardless of caller-provided ignore.
const DEFAULT_IGNORE = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  ".forge/**",
];

// ---------------------------------------------------------------------------
// Internal: picomatch with simple-glob fallback
// ---------------------------------------------------------------------------

/**
 * Simple glob matcher used when picomatch is unavailable.
 * Handles common patterns: **, *, literal segments, dots.
 * Not a full picomatch replacement — just enough for typical scope patterns.
 *
 * @param {string} filepath - relative or absolute path to test
 * @param {string} pattern  - glob pattern
 * @returns {boolean}
 */
function simpleGlobMatch(filepath, pattern) {
  // Normalize separators to forward slash
  const fp = filepath.replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");

  // Build regex from glob:
  //   **  → .*          (any path segment, including separators)
  //   *   → [^/]*       (any chars except separator)
  //   .   → \.          (literal dot)
  // Everything else: literal
  let regexStr = "";
  let i = 0;
  while (i < pat.length) {
    if (pat[i] === "*" && pat[i + 1] === "*") {
      regexStr += ".*";
      i += 2;
      // Consume a trailing slash after ** so "src/**" matches "src/foo" not "src//foo"
      if (pat[i] === "/") i++;
    } else if (pat[i] === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (pat[i] === ".") {
      regexStr += "\\.";
      i++;
    } else if (pat[i] === "?") {
      regexStr += "[^/]";
      i++;
    } else {
      // Escape regex metacharacters (except those handled above)
      regexStr += pat[i].replace(/[+^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }

  const regex = new RegExp("^" + regexStr + "$");
  return regex.test(fp);
}

/**
 * Returns a matcher function (filepath: string) => boolean.
 * Tries picomatch first; falls back to simpleGlobMatch.
 *
 * @param {string} pattern
 * @returns {(filepath: string) => boolean}
 */
function buildMatcher(pattern) {
  try {
    const picomatch = require("picomatch");
    const isMatch = picomatch(pattern, { dot: true });
    return (fp) => isMatch(fp);
  } catch {
    return (fp) => simpleGlobMatch(fp, pattern);
  }
}

// ---------------------------------------------------------------------------
// Internal: atomic file write
// ---------------------------------------------------------------------------

/**
 * Write data to filePath atomically: write to .tmp then rename.
 * Creates parent directories if missing.
 *
 * @param {string} filePath
 * @param {object} data - will be JSON.stringify'd with 2-space indent
 */
function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Internal: resolve context file path
// ---------------------------------------------------------------------------

/**
 * Returns the absolute path to workspace-context.json given artifactDir and cwd.
 *
 * @param {string} artifactDir - relative path (resolved against cwd)
 * @param {string} cwd         - absolute base path
 * @returns {string}
 */
function resolveContextPath(artifactDir, cwd) {
  const base = path.resolve(cwd || process.cwd(), artifactDir);
  return path.join(base, "workspace-context.json");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a workspace-context.json in the artifact directory.
 *
 * @param {string} root         - absolute path to project root
 * @param {object} stackProfile - { scope: string[], readonly: string[], ignore: string[] }
 * @param {string} artifactDir  - relative path to pipeline artifact dir (e.g. ".forge/2026-03-21/session-1234")
 * @returns {object} The context object that was written
 */
function createContext(root, stackProfile, artifactDir) {
  const sp = stackProfile || {};

  // Merge default ignores with caller-provided ignores, deduplicating.
  const callerIgnore = Array.isArray(sp.ignore) ? sp.ignore : [];
  const mergedIgnore = Array.from(new Set([...DEFAULT_IGNORE, ...callerIgnore]));

  const context = {
    version: "1.0",
    root: path.resolve(root),
    scope: Array.isArray(sp.scope) ? sp.scope : [],
    readonly: Array.isArray(sp.readonly) ? sp.readonly : [],
    ignore: mergedIgnore,
    external_write: [],
    artifacts: artifactDir,
    created_by: "engine-init",
    created_at: new Date().toISOString(),
    scope_expansions: [],
  };

  // Artifact dir is relative to root; write file there.
  const contextPath = path.join(context.root, artifactDir, "workspace-context.json");
  atomicWriteJson(contextPath, context);

  return context;
}

/**
 * Load workspace-context.json from artifactDir (resolved against cwd).
 * Returns null if the file is missing or if released_at is set.
 *
 * @param {string} artifactDir - relative path to artifact dir
 * @param {string} cwd         - absolute base path used to resolve artifactDir
 * @returns {object|null}
 */
function loadContext(artifactDir, cwd) {
  const contextPath = resolveContextPath(artifactDir, cwd);

  let raw;
  try {
    raw = fs.readFileSync(contextPath, "utf8");
  } catch {
    // Missing file → no active context
    return null;
  }

  let ctx;
  try {
    ctx = JSON.parse(raw);
  } catch {
    // Malformed JSON → treat as missing
    return null;
  }

  // Released pipelines are no longer active
  if (ctx.released_at) {
    return null;
  }

  return ctx;
}

/**
 * Classify a file path against the workspace context.
 *
 * Precedence: ignore > readonly > scope + scope_expansions > external_write > out-of-scope
 *
 * @param {string} absFilePath - absolute path to the file being tested
 * @param {object} context     - workspace context object from createContext/loadContext
 * @returns {"ignore"|"readonly"|"scope"|"external"|"out-of-scope"}
 */
function classifyFile(absFilePath, context) {
  const resolved = path.resolve(absFilePath);
  const relPath = path.relative(context.root, resolved);

  // Files outside root: check external_write, else out-of-scope
  if (relPath.startsWith("..")) {
    for (const pattern of context.external_write || []) {
      const matcher = buildMatcher(pattern);
      if (matcher(resolved)) return "external";
    }
    return "out-of-scope";
  }

  // Normalize to forward slashes for glob matching
  const relFwd = relPath.replace(/\\/g, "/");

  // Ignore (highest precedence — invisible to pipeline)
  for (const pattern of context.ignore || []) {
    if (buildMatcher(pattern)(relFwd)) return "ignore";
  }

  // Readonly (writes blocked unconditionally)
  for (const pattern of context.readonly || []) {
    if (buildMatcher(pattern)(relFwd)) return "readonly";
  }

  // Writable scope (base)
  for (const pattern of context.scope || []) {
    if (buildMatcher(pattern)(relFwd)) return "scope";
  }

  // Writable scope (runtime expansions)
  for (const expansion of context.scope_expansions || []) {
    if (expansion && expansion.pattern) {
      if (buildMatcher(expansion.pattern)(relFwd)) return "scope";
    }
  }

  return "out-of-scope";
}

/**
 * Append a scope expansion entry to workspace-context.json.
 * Reads existing context, appends, then writes atomically.
 *
 * @param {string} artifactDir - relative path to artifact dir
 * @param {string} cwd         - absolute base path
 * @param {string} pattern     - glob pattern to add to scope
 * @param {string} reason      - human-readable rationale
 * @param {string} step        - pipeline step name (e.g. "execute")
 */
function expandScope(artifactDir, cwd, pattern, reason, step) {
  const contextPath = resolveContextPath(artifactDir, cwd);

  let ctx;
  try {
    ctx = JSON.parse(fs.readFileSync(contextPath, "utf8"));
  } catch (err) {
    throw new Error(`expandScope: cannot read workspace-context.json at ${contextPath}: ${err.message}`);
  }

  if (!Array.isArray(ctx.scope_expansions)) {
    ctx.scope_expansions = [];
  }

  ctx.scope_expansions.push({
    pattern,
    reason,
    added_at: new Date().toISOString(),
    step: step || null,
  });

  atomicWriteJson(contextPath, ctx);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  createContext,
  loadContext,
  classifyFile,
  expandScope,
  // Exported for testing and direct use in gate guard fallback path
  simpleGlobMatch,
};
