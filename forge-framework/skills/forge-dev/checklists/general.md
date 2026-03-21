# General Code Review Checklist

Common bug patterns to verify in every code review, regardless of language.

## Mandatory Items (6)

### 1. Circular / Self Reference
- Does method A call method B which depends on A's result?
- Is a field being read to assign back to itself? (`obj.Value = GetValue()` where `GetValue()` returns `obj.Value`)
- Check: trace the data flow of assignments — source must differ from destination

### 2. Initialization Order
- Does constructor or initialization code trigger events?
- Do those events execute save/persist logic that overwrites stored values?
- Check: in constructors, verify events are not yet subscribed or are suppressed during init

### 3. Null / Empty Value Safety
- Is `Convert.ToXxx()` used where input could be null, empty, or malformed?
- Is `TryParse` used instead for external/user input?
- Are empty string paths handled (empty collection, missing key, default value)?

### 4. Save → Load Roundtrip
- Trace the save path: Value → Storage mechanism → Persist call
- Trace the load path: Load call → Storage mechanism → Value assignment
- Verify: saved value restores identically after restart
- Watch for: intermediate transformations, type conversions, encoding changes

### 5. Event Timing
- Are events firing during component initialization before values are loaded from storage?
- Does `ValueChanged` or similar fire when setting initial/default values?
- Check: is there a guard flag or unsubscribe pattern during initialization?

### 6. Build Verification
- Does the project build successfully after changes?
- Are there new warnings introduced?
- Are all referenced types/namespaces available?
