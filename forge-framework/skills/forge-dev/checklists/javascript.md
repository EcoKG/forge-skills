# JavaScript / TypeScript Code Review Checklist

Language-specific items for JS/TS projects.

## Build/Test Command
```
npm run build    # or: bun build, pnpm build
npm test         # or: bun test, vitest, jest
npx tsc --noEmit # type checking (TS only)
```

## JS/TS-Specific Items (8)

### 1. XSS Prevention
- Is user input sanitized before insertion into DOM?
- No `innerHTML = userInput` — use `textContent` or sanitization library
- React: no `dangerouslySetInnerHTML` with unsanitized data
- Template literals in HTML: escaped properly?

### 2. Async Error Handling
- Are all Promises `.catch()`-ed or in `try/catch` with `await`?
- No unhandled promise rejections?
- `Promise.all()` — does one rejection crash the batch? Consider `Promise.allSettled()`

### 3. Type Safety (TypeScript)
- No `any` types without justification
- Are union types narrowed before use?
- Generic constraints appropriate?
- `as` type assertions: is the cast actually safe?

### 4. Bundle Size Impact
- New dependencies: are they tree-shakeable?
- Import specific modules, not entire libraries (`import { debounce } from 'lodash-es'`)
- Dynamic imports for code splitting where appropriate

### 5. Memory Leaks
- Event listeners removed in cleanup (React: `useEffect` return, Vue: `onUnmounted`)
- `setInterval` / `setTimeout` cleared on component unmount
- Closures: do they capture large objects unnecessarily?

### 6. Null / Undefined Safety
- Optional chaining `?.` for potentially null chains
- Nullish coalescing `??` instead of `||` for falsy-safe defaults
- Array access: bounds checked or `.at()` used?

### 7. API / Fetch Safety
- Request timeout configured?
- Response status checked before parsing body?
- Sensitive data: not in URL query params, not logged

### 8. Environment / Config
- No hardcoded secrets or API keys in source
- Environment variables accessed via config layer, not scattered `process.env`
- `.env` files in `.gitignore`?
