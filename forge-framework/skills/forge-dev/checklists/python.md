# Python Code Review Checklist

Language-specific items for Python projects.

## Build/Test Command
```
pytest          # or: python -m pytest
mypy .          # type checking (if configured)
ruff check .    # linting (if configured)
```

## Python-Specific Items (8)

### 1. Type Hints
- Are function signatures annotated with type hints?
- Are `Optional[T]` / `T | None` used correctly for nullable parameters?
- Does `mypy` pass without new errors?

### 2. Exception Handling
- Are bare `except:` or `except Exception:` catching too broadly?
- Are specific exceptions caught and handled appropriately?
- Is exception context preserved with `raise ... from e`?

### 3. Async/Await
- Is `async def` used consistently? No mixing sync blocking calls in async context?
- Is `await` present for all coroutine calls?
- Are `asyncio.gather()` / `TaskGroup` used for concurrent operations?

### 4. Import Order & Circular Imports
- Standard lib → third-party → local (PEP 8 / isort convention)
- Are there circular import risks? (A imports B, B imports A)
- Use lazy imports or restructure if circular

### 5. Mutable Default Arguments
- No `def func(items=[])` — use `def func(items=None)` + `items = items or []`
- No mutable class-level defaults shared across instances

### 6. Resource Management
- Files, connections, locks: using `with` statement / context manager?
- `__enter__` / `__exit__` implemented for custom resources?

### 7. String Formatting
- Prefer f-strings for readability
- No `format()` or `%` for SQL/shell — use parameterized queries / subprocess lists

### 8. Path Handling
- Using `pathlib.Path` instead of string concatenation for file paths?
- Cross-platform: no hardcoded `/` or `\\` separators
