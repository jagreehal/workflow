# @jagreehal/workflow

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
