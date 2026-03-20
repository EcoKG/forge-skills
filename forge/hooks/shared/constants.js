/**
 * Shared constants for forge hooks (gate-guard + tracker).
 * Single source of truth — do NOT duplicate in individual hooks.
 */

// Code file extensions — excludes docs/config-only formats:
// .md, .mdx, .env, .ini, .conf, .properties are NOT code
const CODE_EXTENSIONS = new Set([
  // Languages
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".mts", ".cjs", ".cts",
  ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
  ".kt", ".scala", ".vue", ".svelte", ".astro", ".ex", ".exs",
  ".lua", ".r", ".pl", ".groovy", ".gradle",
  // Web/Markup + Server Pages
  ".html", ".css", ".scss", ".sass", ".less",
  ".ejs", ".pug", ".hbs", ".njk",
  ".jsp", ".jspx", ".asp", ".aspx", ".erb", ".twig", ".blade.php",
  // Data/Config (code-like)
  ".sql", ".graphql", ".proto",
  ".yaml", ".yml", ".toml", ".json", ".xml",
  // Shell
  ".sh", ".bash", ".zsh",
  // Infrastructure
  ".tf", ".hcl", ".dockerfile",
  ".ipynb",
]);

// Paths to skip when checking code files (full list)
const SKIP_PATHS = [
  ".forge/", "node_modules/", ".git/",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "package.json", "tsconfig.json", "composer.json", "Cargo.lock", "go.sum",
  // Build output directories
  "dist/", "build/", "out/",
  // Vendor directories
  "vendor/",
  // Cache directories
  "__pycache__/",
  // Framework build directories
  ".next/",
  // Compiled output directories
  "target/",
];

// Sensitive file basenames — never write to these directly
const SENSITIVE_FILES = [".env", ".env.local", ".env.production", "credentials.json", "secrets.yaml", "secrets.yml"];

// Unified safe Bash command regex — commands that cannot modify code files.
// Merged from gate-guard's pipeline and no-pipeline allowlists.
const SAFE_BASH_COMMANDS = /^(git\b|npm\s+(install|test|run|ci|start)\b|npx\s+(tsc|jest|vitest|eslint)\b|yarn\s+(install|test|build)\b|pnpm\s+(install|test|build)\b|pip\s+install\b|cargo\s+(build|test|run)\b|go\s+(build|test|run|get|mod)\b|dotnet\s+(build|test|run)\b|mvn\s+(compile|test|package)\b|gradle\s+(build|test)\b|make\b|cmake\b|ls\b|cd\b|pwd\b|cat\b|head\b|tail\b|wc\b|find\b|grep\b|which\b|env\b|echo\s+\$)/;

// Bash write patterns — detect file-writing commands and capture target path.
// Single canonical list (was duplicated in gate-guard).
const BASH_WRITE_PATTERNS = [
  /(?:echo|printf)\s+.*?>\s*(\S+)/,
  /cat\s+.*?>\s*(\S+)/,
  /tee\s+(?:-a\s+)?(\S+)/,
  /sed\s+-i\S*\s+.*?(\S+)\s*$/,
  /perl\s+-(?:i|pi)\S*\s+.*?(\S+)\s*$/,
  /cp\s+\S+\s+(\S+)/,
  /mv\s+\S+\s+(\S+)/,
  /curl\s+.*?-o\s+(\S+)/,
  /wget\s+.*?-O\s+(\S+)/,
  /patch\s+(?:.*?\s)?(\S+)/,
  /python[3]?\s+-c\s+.*?(?:open|write).*?["'](\S+?)["']/,
  /node\s+-e\s+.*?(?:writeFile|appendFile).*?["'](\S+?)["']/,
  /ruby\s+-e\s+.*?(?:File\.write|IO\.write).*?["'](\S+?)["']/,
  // Heredoc write: <<EOF > file or <<'EOF' > file
  /<<\s*['"]?(\w+)['"]?.*?>\s*(\S+)/,
  // dd output file
  /\bdd\b.*?\bof=(\S+)/,
];

module.exports = {
  CODE_EXTENSIONS,
  SKIP_PATHS,
  SENSITIVE_FILES,
  SAFE_BASH_COMMANDS,
  BASH_WRITE_PATTERNS,
};
