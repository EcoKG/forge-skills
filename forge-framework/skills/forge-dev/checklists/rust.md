# Rust Code Review Checklist

Language-specific items for Rust projects.

## Build/Test Command
```
cargo build
cargo test
cargo clippy -- -D warnings
```

## Rust-Specific Items (8)

### 1. Ownership & Borrowing
- Are borrow checker errors resolved without unnecessary `.clone()`?
- Lifetimes explicit where needed, elided where possible?
- No dangling references or use-after-move?

### 2. Error Handling
- Using `Result<T, E>` instead of `panic!()` for recoverable errors?
- Custom error types implement `std::error::Error` + `Display`?
- `?` operator used for propagation with proper context (`anyhow`, `thiserror`)?
- No `.unwrap()` on user input or external data?

### 3. Unsafe Code
- Is `unsafe` block justified and documented?
- Invariants maintained within unsafe block?
- Can the unsafe be replaced with safe abstractions?

### 4. Concurrency
- `Send` and `Sync` bounds satisfied for cross-thread types?
- `Arc<Mutex<T>>` vs `Arc<RwLock<T>>` — read-heavy uses RwLock?
- No data races — compiler enforces, but verify logical races
- Async: `.await` points don't hold locks across suspension?

### 5. Memory & Performance
- No unnecessary allocations in hot paths?
- `&str` preferred over `String` for read-only access?
- `Vec::with_capacity()` used when size is known?
- Iterator chains preferred over manual loops?

### 6. Pattern Matching
- `match` arms exhaustive? No catch-all `_` hiding new variants?
- `if let` / `while let` used for single-variant matches?

### 7. Trait Design
- Traits are small and focused (ISP principle)?
- Default implementations provided where sensible?
- `impl Trait` vs `dyn Trait` — static dispatch unless dynamic needed?

### 8. Clippy & Formatting
- `cargo clippy` passes without warnings?
- `cargo fmt` applied?
- No `#[allow(clippy::...)]` without justification?
