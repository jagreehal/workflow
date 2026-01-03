---
'@jagreehal/workflow': minor
---

Add production-ready workflow features for resilience, observability, and testing.

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
