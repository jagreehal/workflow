---
'@jagreehal/workflow': minor
---

Add context propagation to workflow events and conditional helpers

**New Features:**
- Context is now automatically included in all workflow events when provided via `createContext` or `context` option
- `WorkflowContext` parameter added to `createWorkflow` callbacks (always provided) containing `workflowId`, `onEvent`, and `context`
- Conditional helpers (`when`, `unless`, `whenOr`, `unlessOr`) now support context propagation in `step_skipped` events
- `createConditionalHelpers` accepts `WorkflowContext` directly (same shape as `ConditionalContext`)

**Improvements:**
- Simplified conditional helper usage with `createWorkflow` - pass `ctx` directly to `createConditionalHelpers(ctx)`
- Better type safety - `ctx` is always provided, no need for null checks
- All events maintain context correlation for better observability

**Breaking Changes:**
- `WorkflowEvent<E, C>` default context generic changed from `void` to `unknown` (makes context visible to existing consumers)
- `onError` callbacks now receive `ctx` as third parameter: `(error, stepName?, ctx?) => void`
- `onEvent` callbacks receive context as second parameter: `(event, ctx) => void`

**Backward Compatibility:**
- Existing code without context continues to work
- `ctx` parameter in `createWorkflow` callbacks can be ignored if not needed
- All existing tests pass without modification
