# Java Code Review Checklist

Language-specific items for Java projects.

## Build/Test Command
```
mvn compile          # or: gradle build
mvn test             # or: gradle test
```

## Java-Specific Items (8)

### 1. Null Safety
- Are `Optional<T>` used for nullable return types?
- No raw `null` returns from public methods without documentation?
- `Objects.requireNonNull()` for constructor/method preconditions?
- NullPointerException risk in chained method calls?

### 2. Exception Handling
- No empty `catch` blocks (swallowing exceptions)?
- Checked vs unchecked: appropriate exception type chosen?
- Resources in `try-with-resources` (AutoCloseable)?
- Exception messages include context (what failed, with what input)?

### 3. Concurrency
- Shared mutable state protected by `synchronized` or `java.util.concurrent`?
- `ConcurrentHashMap` instead of `Collections.synchronizedMap()`?
- `volatile` for visibility of shared fields without atomicity needs?
- Thread pool sizing appropriate for workload type (CPU vs IO bound)?

### 4. Collections & Generics
- Raw types avoided — always parameterized?
- Unmodifiable collections returned from public APIs?
- `List.of()` / `Map.of()` for immutable collections?
- No `ClassCastException` risk from unchecked casts?

### 5. Stream API
- Streams used appropriately (not for simple iterations)?
- No side effects in `map()` / `filter()`?
- `parallel()` justified by actual performance need?
- Collectors chosen correctly (`toList()`, `toUnmodifiableList()`)?

### 6. Memory Management
- No resource leaks (streams, connections, files)?
- Large object references released when no longer needed?
- StringBuilder for string concatenation in loops?
- Weak/soft references for caches where appropriate?

### 7. API Design
- Methods return interfaces, not implementations (`List` not `ArrayList`)?
- Builder pattern for >3 constructor parameters?
- `equals()` / `hashCode()` contract maintained?
- `Comparable` / `Comparator` correctly implemented?

### 8. Security
- SQL: parameterized queries (PreparedStatement), never string concat?
- Input validation at API boundaries?
- Sensitive data not logged or exposed in error messages?
- Dependency versions checked for known vulnerabilities?
