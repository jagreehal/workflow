---
'@jagreehal/workflow': minor
---

Add TaggedError factory function for structured error types with exhaustive pattern matching

**New Feature:**
- `TaggedError` factory function creates tagged error classes with type-safe pattern matching
- Two usage patterns:
  1. Props via generic: `class NotFoundError extends TaggedError("NotFoundError")<{ id: string }> {}`
  2. Props inferred from message callback: `class ValidationError extends TaggedError("ValidationError", { message: (p: { field: string }) => ... }) {}`
- Exhaustive pattern matching with `TaggedError.match()` - TypeScript enforces all variants are handled
- Partial matching with `TaggedError.matchPartial()` for catch-all scenarios
- Type-safe message generation from props (optional)
- `instanceof TaggedError` checks work via `Symbol.hasInstance`
- Framework-agnostic alternative to Effect.js `Data.TaggedError`

**API:**
- `TaggedError(tag)` - Factory function returning class constructor
- `TaggedError.match(error, handlers)` - Exhaustive pattern matching
- `TaggedError.matchPartial(error, handlers, otherwise)` - Partial matching with fallback
- `TaggedError.isTaggedError(value)` - Type guard
- Helper types: `TagOf<E>`, `ErrorByTag<E, Tag>`, `PropsOf<E>`

**Use Cases:**
- Errors with contextual data (e.g., `NotFoundError { id, resource }`)
- Multiple error variants requiring exhaustive handling
- API responses or user messages with structured error details
- When string literals aren't sufficient for error context

**Documentation:**
- Added comprehensive examples in README showing when to use TaggedError vs string literals
- Clear guidance: use string literals for simple cases, TaggedError for rich error objects
