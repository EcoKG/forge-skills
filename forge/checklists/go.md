# Go Code Review Checklist

Language-specific items for Go projects.

## Build/Test Command
```
go build ./...
go test ./...
go vet ./...
```

## Go-Specific Items (8)

### 1. Error Returns
- Is every returned `error` checked? No `_ = SomeFunc()` silently discarding errors
- Are errors wrapped with context? `fmt.Errorf("doing X: %w", err)`
- Sentinel errors: using `errors.Is()` / `errors.As()` for comparison

### 2. Goroutine Leaks
- Does every spawned goroutine have a termination path?
- Is `context.Context` passed and respected for cancellation?
- Channel-based goroutines: is the channel closed or select-with-done used?

### 3. Context Propagation
- Is `context.Context` the first parameter of functions that do I/O?
- No `context.Background()` in request handlers — use the request's context
- Timeout/deadline set for external calls?

### 4. Concurrency Safety
- Shared state protected by `sync.Mutex` or `sync.RWMutex`?
- Race condition risk: use `go test -race` to verify
- Prefer channels for communication over shared memory

### 5. defer Correctness
- `defer` captures variable values at declaration time — loop variable issue?
- File/connection `defer Close()`: is error from Close() handled?
- `defer` in loops: deferred calls accumulate — move to function scope

### 6. Interface Design
- Interfaces declared where they're consumed, not where they're implemented
- Keep interfaces small (1-3 methods)
- Accept interfaces, return structs

### 7. Slice / Map Safety
- Nil slice vs empty slice: behavior difference understood?
- Map: concurrent read/write? Use `sync.Map` or mutex
- Append to slice from function: returning new slice, not modifying in place

### 8. Package Design
- No import cycles
- Internal packages used for non-exported code?
- Exported names: clear, package-qualified (no `config.Config` stutter)
