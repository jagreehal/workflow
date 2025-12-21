# API Reference

## Workflows

### createWorkflow

```typescript
createWorkflow(deps)                                    // Auto-inferred error types
createWorkflow(deps, { strict: true, catchUnexpected }) // Closed error union
createWorkflow(deps, { onEvent, createContext })        // Event stream + context
createWorkflow(deps, { cache })                         // Step caching
createWorkflow(deps, { resumeState })                   // Resume from saved state
```

### step

```typescript
step(result)                        // Unwrap Result or exit early
step(result, { name, key })         // With tracing/caching options
step(() => result)                  // Lazy form (for caching/resume)
step(() => result, { name, key })   // Lazy with options
```

### step.try

```typescript
step.try(fn, { error })             // Static error type
step.try(fn, { onError })           // Dynamic error from caught value
step.try(fn, { error, name, key })  // With tracing options
```

### Low-level run

```typescript
run(fn)                             // One-off workflow
run(fn, { onError })                // With error callback
run.strict(fn, { catchUnexpected }) // Closed error union
```

### Event helpers

```typescript
isStepComplete(event)               // Type guard for step_complete events
```

## Results

### Constructors

```typescript
ok(value)                           // Create success
err(error)                          // Create error
err(error, { cause })               // Create error with cause
```

### Type guards

```typescript
isOk(result)                        // result is { ok: true, value }
isErr(result)                       // result is { ok: false, error }
isUnexpectedError(error)            // error is UnexpectedError
```

## Unwrap

```typescript
unwrap(result)                      // Value or throw UnwrapError
unwrapOr(result, defaultValue)      // Value or default
unwrapOrElse(result, fn)            // Value or compute from error
```

## Wrap

```typescript
from(fn)                            // Sync throwing → Result
from(fn, onError)                   // With error mapper
fromPromise(promise)                // Promise → Result
fromPromise(promise, onError)       // With error mapper
tryAsync(fn)                        // Async fn → Result
tryAsync(fn, onError)               // With error mapper
fromNullable(value, onNull)         // Nullable → Result
```

## Transform

```typescript
map(result, fn)                     // Transform value
mapError(result, fn)                // Transform error
mapTry(result, fn, onError)         // Transform value, catch throws
mapErrorTry(result, fn, onError)    // Transform error, catch throws
andThen(result, fn)                 // Chain (flatMap)
match(result, { ok, err })          // Pattern match
tap(result, fn)                     // Side effect on success
tapError(result, fn)                // Side effect on error
```

## Batch

```typescript
all(results)                        // All succeed (sync, short-circuits)
allAsync(results)                   // All succeed (async, short-circuits)
any(results)                        // First success (sync)
anyAsync(results)                   // First success (async)
allSettled(results)                 // Collect all; error array if any fail (sync)
allSettledAsync(results)            // Collect all; error array if any fail (async)
partition(results)                  // Split into { values, errors }
```

## Human-in-the-Loop (HITL)

### Creating approval steps

```typescript
createApprovalStep<T>(options)      // Create approval-gated step function
// options: { key, checkApproval, pendingReason?, rejectedReason? }
```

### Checking approval status

```typescript
isPendingApproval(error)            // error is PendingApproval
isApprovalRejected(error)           // error is ApprovalRejected
pendingApproval(stepKey, options?)  // Create PendingApproval error
```

### Managing approval state

```typescript
createHITLCollector()               // Collect step events for resume
injectApproval(state, { stepKey, value })  // Add approval to resume state
clearStep(state, stepKey)           // Remove step from resume state
hasPendingApproval(state, stepKey)  // Check if step is pending
getPendingApprovals(state)          // Get all pending step keys
```

## Types

### Core Result types

```typescript
Result<T, E, C>                     // { ok: true, value: T } | { ok: false, error: E, cause?: C }
AsyncResult<T, E, C>                // Promise<Result<T, E, C>>
UnexpectedError                     // { type: 'UNEXPECTED_ERROR', cause: unknown }
```

### Workflow types

```typescript
Workflow<E, Deps>                   // Non-strict workflow return type
WorkflowStrict<E, U, Deps>          // Strict workflow return type
WorkflowOptions<E, C>               // Options for createWorkflow
WorkflowOptionsStrict<E, U, C>      // Options for strict createWorkflow
AnyResultFn                         // Constraint for Result-returning functions
```

### Event types

```typescript
WorkflowEvent<E>                    // Union of all event types
StepOptions                         // { name?: string, key?: string }
```

### Cache & Resume types

```typescript
StepCache                           // Cache interface (get/set/has/delete/clear)
ResumeState                         // { steps: Map<string, ResumeStateEntry> }
ResumeStateEntry                    // { result: Result, meta?: StepFailureMeta }
```

### HITL types

```typescript
PendingApproval                     // { type: 'PENDING_APPROVAL', stepKey, reason? }
ApprovalRejected                    // { type: 'APPROVAL_REJECTED', stepKey, reason? }
```

### Type extraction utilities

```typescript
ErrorOf<Fn>                         // Extract error type from function
CauseOf<Fn>                         // Extract cause type from function
Errors<[Fn1, Fn2, ...]>             // Union of error types from functions
ErrorsOfDeps<Deps>                  // Extract errors from deps object
CausesOfDeps<Deps>                  // Extract causes from deps object
ExtractValue<Result>                // Extract value type from Result
ExtractError<Result>                // Extract error type from Result
ExtractCause<Result>                // Extract cause type from Result
```

### Error types

```typescript
UnwrapError<E, C>                   // Error thrown by unwrap()
```
