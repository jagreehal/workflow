# @jagreehal/workflow

## 1.12.0

### Minor Changes

- 59b7be7: Enhance type precision throughout the Result API with improved type guards, function overloads, and conditional return types. `Result<T, E, C>` now uses `Ok<T> | Err<E, C>` union instead of inline object types. Type guards `isOk()` and `isErr()` now narrow to `Ok<T>` and `Err<E, C>` types. Functions like `recover()`, `recoverAsync()`, `encodeCachedError()`, and `pendingApproval()` now return precise `Ok<T>` or `Err<E, C>` types instead of generic `Result` types. Added function overloads for `map()`, `andThen()`, and `match()` that provide more precise return types when inputs are known to be `Ok<T>` or `Err<E, C>`. `all()` and `allSettled()` now return `Ok<T>` when all inputs are successful (no errors possible). Improved return types for `from()` and `fromPromise()` to use explicit `Ok<T> | Err<E, C>` unions.

## 1.11.0

### Minor Changes

- d26d20c: Improve type precision for type guards and error functions. `isOk()` and `isErr()` now narrow to `Ok<T>` and `Err<E, C>` types instead of inline object types. `recover()` and `recoverAsync()` now return `Ok<T>` instead of `Result<T, never, never>`. Error functions like `encodeCachedError()` and `pendingApproval()` now return `Err<E, C>` instead of `Result<never, E, C>`.

## 1.10.0

### Minor Changes

- dc01e2e: Improve type display for `ok()` and `err()` functions. They now return `Ok<T>` and `Err<E, C>` types instead of the more verbose `Result<T, never, never>` and `Result<never, E, C>`. This provides cleaner IDE tooltips and better developer experience while maintaining full type safety. The `Ok` and `Err` types are now exported for use in type annotations.

## 1.9.0

### Minor Changes

- 95faa3f: Add batch processing and resource management utilities

  **New Features:**

  - **Batch Processing** (`processInBatches`): Process items in batches with bounded concurrency, progress tracking, and checkpoint hooks. Useful for I/O-heavy operations like generating embeddings, API calls, or database writes.

    - Configurable batch size, concurrency, and inter-batch delays
    - Progress callbacks for UI updates
    - Checkpoint hooks for database WAL flushing or state persistence
    - Preset configurations (conservative, balanced, aggressive)
    - Available via `@jagreehal/workflow/batch` entry point

  - **Resource Management** (`withScope`, `createResourceScope`, `createResource`): RAII-style resource cleanup with automatic guarantees. Ensures resources are closed even if operations fail.
    - LIFO cleanup order (last added = first closed)
    - Automatic cleanup on scope exit (success or failure)
    - Type-safe resource tracking
    - Convenience helpers for acquire/release patterns
    - Available via `@jagreehal/workflow/resource` entry point

  **API:**

  - `processInBatches(items, process, config, options?)` - Process items in batches
  - `batchPresets` - Preset configurations for common scenarios
  - `withScope(fn)` - Run function with automatic resource cleanup
  - `createResourceScope()` - Create a resource scope manually
  - `createResource(acquire, release)` - Create resource from factory functions

## 1.8.0

### Minor Changes

- af48f01: Add TaggedError factory function for structured error types with exhaustive pattern matching

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

- e61464b: Add context propagation to workflow events and conditional helpers

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

## 1.7.0

### Minor Changes

- 59b22bd: ### Documentation Improvements

  **Save & Resume:**

  - Added prominent "Save & Resume" section to README with complete 3-step examples
  - Added persistence quickstart section showing database integration patterns
  - Updated all examples to use `createStepCollector()` as the recommended approach
  - Enhanced payment retry example to show full save/restore flow with database persistence
  - Expanded advanced docs with detailed database integration patterns (PostgreSQL, DynamoDB, Redis)

  **Workflow Hooks:**

  - Expanded workflow hooks documentation with detailed use cases and code examples
  - Added 13+ concrete examples for `shouldRun`, `onBeforeStart`, and `onAfterStep` hooks
  - Documented use cases: distributed locking, rate limiting, checkpointing, queue visibility, metrics, dead letter queues, and more

  These improvements make save/resume functionality and workflow hooks more discoverable and easier to use.

## 1.6.0

### Minor Changes

- 48f66b0: Add production-ready workflow features for resilience, observability, and testing.

  ### New Features

  - **Circuit Breaker** (`createCircuitBreaker`): Prevent cascading failures with configurable failure thresholds and recovery
  - **Saga/Compensation** (`createSagaWorkflow`, `runSaga`): Define compensating actions for automatic rollback on downstream failures
  - **Rate Limiting** (`createRateLimiter`, `createConcurrencyLimiter`): Control throughput with token bucket and concurrency limiters
  - **Workflow Versioning** (`migrateState`, `createVersionedStateLoader`): Handle schema migrations when resuming persisted workflows
  - **Conditional Execution** (`when`, `unless`, `whenOr`, `unlessOr`): Declarative guards for conditional step execution
  - **Webhook Adapters** (`createWebhookHandler`, `createEventHandler`): Expose workflows as HTTP endpoints or queue consumers
  - **Policy Middleware** (`withPolicy`, `servicePolicies`): Reusable bundles of retry/timeout options
  - **Persistence Adapters** (`createMemoryCache`, `createFileCache`, `createKVCache`): Pluggable storage for step cache and resume state
  - **Devtools** (`createDevtools`): Debugging, visualization, timeline rendering, and run diffing
  - **HITL Orchestration** (`createHITLOrchestrator`): Production-ready helpers for approval workflows with polling and webhooks
  - **Testing Harness** (`createWorkflowHarness`, `createMockFn`): Deterministic testing with scripted step outcomes
  - **OpenTelemetry** (`createAutotelAdapter`): First-class metrics and tracing integration

  ### Improvements

  - Updated ESLint config to allow underscore-prefixed unused variables
  - Expanded documentation with comprehensive examples for all new features

- 48f66b0: - Added comprehensive test suite (39 tests) covering all README code examples
  - Fixed incorrect `step.retry` example in README (now uses `timeout` option directly)
  - Replaced all em dashes with regular hyphens for better compatibility
  - Ensured all documented examples are verified to work correctly

## 1.5.0

### Minor Changes

- 8aa9655: Add production-ready workflow features for resilience, observability, and testing.

  ### New Features

  - **Circuit Breaker** (`createCircuitBreaker`): Prevent cascading failures with configurable failure thresholds and recovery
  - **Saga/Compensation** (`createSagaWorkflow`, `runSaga`): Define compensating actions for automatic rollback on downstream failures
  - **Rate Limiting** (`createRateLimiter`, `createConcurrencyLimiter`): Control throughput with token bucket and concurrency limiters
  - **Workflow Versioning** (`migrateState`, `createVersionedStateLoader`): Handle schema migrations when resuming persisted workflows
  - **Conditional Execution** (`when`, `unless`, `whenOr`, `unlessOr`): Declarative guards for conditional step execution
  - **Webhook Adapters** (`createWebhookHandler`, `createEventHandler`): Expose workflows as HTTP endpoints or queue consumers
  - **Policy Middleware** (`withPolicy`, `servicePolicies`): Reusable bundles of retry/timeout options
  - **Persistence Adapters** (`createMemoryCache`, `createFileCache`, `createKVCache`): Pluggable storage for step cache and resume state
  - **Devtools** (`createDevtools`): Debugging, visualization, timeline rendering, and run diffing
  - **HITL Orchestration** (`createHITLOrchestrator`): Production-ready helpers for approval workflows with polling and webhooks
  - **Testing Harness** (`createWorkflowHarness`, `createMockFn`): Deterministic testing with scripted step outcomes
  - **OpenTelemetry** (`createAutotelAdapter`): First-class metrics and tracing integration

  ### Improvements

  - Updated ESLint config to allow underscore-prefixed unused variables
  - Expanded documentation with comprehensive examples for all new features

## 1.4.0

### Minor Changes

- 537b7b6: Add retry and timeout capabilities to workflow steps. Steps can now automatically retry on failures with configurable backoff strategies (fixed, linear, exponential), jitter, and retry predicates. Steps can also be wrapped with timeouts, with optional AbortSignal support for proper cancellation. Retry and timeout information is automatically tracked and visualized in workflow visualizations.

## 1.3.0

### Minor Changes

- f5269aa: Add documentation for composing workflows together. Workflows can be combined by calling one workflow from within another using `step()`, and error types automatically aggregate into a union.

## 1.2.0

### Minor Changes

- 3058262: ## Enhanced Workflow Visualization

  ### New Features

  - **Decision Tracking**: Visualize conditional logic (if/switch statements) with explicit decision points showing which branches were taken or skipped
  - **Input/Output Display**: Step nodes now show input and output values in both ASCII and Mermaid diagrams for better debugging
  - **Skipped Steps**: Steps that are skipped due to conditional logic are now clearly marked in visualizations
  - **Mermaid Validation**: All generated Mermaid diagrams are now validated to ensure they render correctly without parse errors

  ### Improvements

  - **Better Conditional Flow**: Decision nodes show the condition, decision value, and which branch was taken
  - **Robust Text Escaping**: All user-generated text (step names, conditions, values) is properly escaped to prevent Mermaid syntax errors
  - **Comprehensive Testing**: Added validation tests for special characters in step names, subgraph names, and decision labels

  ### Technical Details

  - Added `trackDecision`, `trackIf`, and `trackSwitch` helper functions for explicit decision tracking
  - Enhanced `WorkflowIR` with `DecisionNode` type and `skipped` step state
  - Improved Mermaid renderer with centralized text escaping functions

## 1.1.0

### Minor Changes

- 41249eb: Add `step.fromResult()` for mapping typed Result errors

  - Added `step.fromResult()` method that accepts Result-returning functions and maps their typed errors
  - Unlike `step.try()` where `onError` receives `unknown`, `step.fromResult()` preserves the error type in the callback
  - Updated documentation with `run()` vs `createWorkflow()` decision guide
  - Added JSDoc explaining when to use each workflow execution method
