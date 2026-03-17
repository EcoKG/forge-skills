# {Stack} Conventions

> Auto-generated and maintained by Forge.
> Extracted from high-quality executions (quality_score > 0.8).
> Location: `~/.forge/knowledge/{stack}/conventions.md`

## Project Structure
- {Typical directory layout for this stack}

## Naming Conventions
- Files: {e.g., kebab-case for components, camelCase for utilities}
- Functions: {e.g., camelCase for JS, snake_case for Python}
- Types/Interfaces: {e.g., PascalCase with I prefix or not}
- Constants: {e.g., UPPER_SNAKE_CASE}

## Code Patterns
- {Pattern 1: e.g., "Use factory pattern for service instantiation"}
- {Pattern 2: e.g., "Error handling via Result type, not exceptions"}
- {Pattern 3: e.g., "Dependency injection via constructor, not global"}

## Testing Patterns
- Framework: {e.g., Jest + React Testing Library}
- Pattern: {e.g., "Arrange-Act-Assert with factory functions"}
- Mocking: {e.g., "MSW for API mocking, jest.mock for modules"}
- Coverage threshold: {e.g., "80% minimum"}

## Configuration
- {Config patterns: e.g., "env-based config with zod validation"}
- {Build tool: e.g., "Vite for dev, esbuild for production"}

## API Patterns (if applicable)
- {e.g., "RESTful with /api/v1 prefix, JSON responses"}
- {e.g., "Error format: { error: string, code: number }"}

---

## Rules
- Max 50 entries per section (oldest trimmed)
- Updated automatically at Step 9 when quality_score > 0.8
- Stack detected from project-profile.json language + framework
- Stale entries (>6 months unused) auto-archived
