/**
 * @jagreehal/workflow
 *
 * Typed async workflows with early-exit, using async/await and Result types.
 *
 * ## Overview
 *
 * This library provides two complementary patterns for handling errors in async workflows:
 *
 * 1. **Pipeline style** (`core`): Use `map`, `andThen`, `match` for transforming Results
 * 2. **Workflow style** (`workflow`): Use `createWorkflow` with async/await for orchestrating
 *    dependent steps with automatic early-exit
 *
 * ## When to Use What
 *
 * ### Use `createWorkflow` (workflow.ts) when:
 * - You have multiple dependent async operations that need to run sequentially
 * - You want automatic error type inference from declared functions
 * - You need step caching, resume state, or event streams
 * - You're building complex workflows with human-in-the-loop (HITL) approvals
 * - You want the error union computed automatically from your dependencies
 *
 * **Example**: User signup flow, checkout process, deployment pipelines
 *
 * ### Use `run()` (core.ts) when:
 * - You need a one-off workflow without declaring dependencies upfront
 * - You want more control over error handling without automatic inference
 * - You're building simple workflows that don't need caching/resume
 * - Bundle size is critical and you don't need workflow features
 *
 * **Example**: Simple data transformation, one-time operations
 *
 * ### Use Result primitives (core.ts) when:
 * - You're working with individual Results, not workflows
 * - You need to transform, combine, or unwrap Results
 * - You're integrating with other libraries that return Results
 * - You want functional-style error handling without workflows
 *
 * **Example**: API response handling, validation, data parsing
 *
 * ## Entry Points
 *
 * For minimal bundle size, import from specific entry points:
 * - `@jagreehal/workflow/core` - Result primitives and `run()` (smallest bundle)
 * - `@jagreehal/workflow/workflow` - `createWorkflow` and workflow features
 * - `@jagreehal/workflow` - Everything (convenient, but larger bundle)
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createWorkflow, ok, err, type AsyncResult } from '@jagreehal/workflow';
 *
 * const fetchUser = async (id: string): AsyncResult<User, 'NOT_FOUND'> =>
 *   id === '1' ? ok({ id, name: 'Alice' }) : err('NOT_FOUND');
 *
 * const workflow = createWorkflow({ fetchUser });
 *
 * const result = await workflow(async (step) => {
 *   const user = await step(fetchUser('1'));
 *   return user;
 * });
 * // result.error: 'NOT_FOUND' | UnexpectedError
 * ```
 */

// =============================================================================
// Core - Result primitives and run()
// =============================================================================

export {
  // Types
  type Ok,
  type Err,
  type Result,
  type AsyncResult,
  type UnexpectedError,
  type UnexpectedCause,
  type UnexpectedStepFailureCause,
  type PromiseRejectedError,
  type PromiseRejectionCause,
  type EmptyInputError,
  type MaybeAsyncResult,

  // Type utilities
  type ErrorOf,
  type Errors,
  type ExtractValue,
  type ExtractError,
  type ExtractCause,
  type CauseOf,

  // Step types
  type RunStep,
  type StepOptions,
  type WorkflowEvent,
  type ScopeType,
  type RunOptions,
  type RunOptionsWithCatch,
  type RunOptionsWithoutCatch,

  // Retry and timeout types
  type BackoffStrategy,
  type RetryOptions,
  type TimeoutOptions,
  type StepTimeoutError,
  type StepTimeoutMarkerMeta,
  STEP_TIMEOUT_MARKER,

  // Constructors
  ok,
  err,

  // Type guards
  isOk,
  isErr,
  isUnexpectedError,
  isStepTimeoutError,
  getStepTimeoutMeta,

  // Unwrap
  UnwrapError,
  unwrap,
  unwrapOr,
  unwrapOrElse,

  // Wrap
  from,
  fromPromise,
  tryAsync,
  fromNullable,

  // Transform
  map,
  mapError,
  match,
  andThen,
  tap,
  tapError,
  mapTry,
  mapErrorTry,
  bimap,
  orElse,
  orElseAsync,
  recover,
  recoverAsync,

  // Batch
  type SettledError,
  all,
  allAsync,
  allSettled,
  allSettledAsync,
  any,
  anyAsync,
  partition,

  // Run
  run,

  // Hydration / Serialization
  hydrate,
  isSerializedResult,
} from "./core";

// =============================================================================
// Tagged Errors
// =============================================================================

export {
  // Factory function
  TaggedError,

  // Types
  type TaggedErrorBase,
  type TaggedErrorOptions,
  type TaggedErrorCreateOptions,
  type TaggedErrorConstructor,

  // Type utilities
  type TagOf,
  type ErrorByTag,
  type PropsOf,
} from "./tagged-error";

// =============================================================================
// Workflow - createWorkflow
// =============================================================================

export {
  // Types
  type AnyResultFn,
  type ErrorsOfDeps,
  type CausesOfDeps,
  type WorkflowOptions,
  type WorkflowOptionsStrict,
  type Workflow,
  type WorkflowStrict,
  type WorkflowContext,
  type StepCache,
  type ResumeState,
  type ResumeStateEntry,

  // HITL types
  type PendingApproval,
  type ApprovalRejected,
  type ApprovalStepOptions,

  // Functions
  createWorkflow,
  isStepComplete,
  createStepCollector,

  // HITL functions
  isPendingApproval,
  isApprovalRejected,
  pendingApproval,
  createApprovalStep,
  injectApproval,
  clearStep,
  hasPendingApproval,
  getPendingApprovals,
  createHITLCollector,
} from "./workflow";

// =============================================================================
// Conditional - when/unless helpers
// =============================================================================

export {
  // Types
  type ConditionalOptions,
  type ConditionalContext,

  // Functions
  when,
  unless,
  whenOr,
  unlessOr,
  createConditionalHelpers,
} from "./conditional";

// =============================================================================
// Circuit Breaker
// =============================================================================

export {
  // Types
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitBreaker,

  // Classes and functions
  CircuitOpenError,
  isCircuitOpenError,
  createCircuitBreaker,
  circuitBreakerPresets,
} from "./circuit-breaker";

// =============================================================================
// Saga / Compensation Pattern
// =============================================================================

export {
  // Types
  type CompensationAction,
  type SagaStepOptions,
  type SagaCompensationError,
  type SagaContext,
  type SagaEvent,
  type SagaWorkflowOptions,
  type SagaResult,

  // Functions
  isSagaCompensationError,
  createSagaWorkflow,
  runSaga,
} from "./saga";

// =============================================================================
// Rate Limiting / Concurrency Control
// =============================================================================

export {
  // Types
  type RateLimiterConfig,
  type ConcurrencyLimiterConfig,
  type RateLimitExceededError,
  type QueueFullError,
  type RateLimiterStats,
  type ConcurrencyLimiterStats,
  type RateLimiter,
  type ConcurrencyLimiter,
  type CombinedLimiterConfig,

  // Functions
  isRateLimitExceededError,
  isQueueFullError,
  createRateLimiter,
  createConcurrencyLimiter,
  createCombinedLimiter,
  rateLimiterPresets,
} from "./rate-limiter";

// =============================================================================
// Workflow Versioning and Migration
// =============================================================================

export {
  // Types
  type Version,
  type MigrationFn,
  type Migrations,
  type VersionedState,
  type VersionedWorkflowConfig,
  type MigrationError,
  type VersionIncompatibleError,

  // Functions
  isMigrationError,
  isVersionIncompatibleError,
  migrateState,
  createVersionedStateLoader,
  createVersionedState,
  parseVersionedState,
  stringifyVersionedState,

  // Migration helpers
  createKeyRenameMigration,
  createKeyRemoveMigration,
  createValueTransformMigration,
  composeMigrations,
} from "./versioning";

// =============================================================================
// Autotel Integration
// =============================================================================

export {
  // Types
  type AutotelAdapterConfig,
  type AutotelMetrics,
  type AutotelAdapter,
  type AutotelTraceFn,

  // Functions
  createAutotelAdapter,
  createAutotelEventHandler,
  withAutotelTracing,
} from "./autotel";

// =============================================================================
// Webhook / Event Trigger Adapters
// =============================================================================

export {
  // Request/Response Types
  type WebhookRequest,
  type WebhookResponse,
  type ErrorResponseBody,

  // Validation Types
  type ValidationResult,
  type ValidationError,
  isValidationError,

  // Handler Types
  type WebhookHandlerConfig,
  type WebhookHandler,
  type SimpleHandlerConfig,

  // Error Mapping
  type ErrorMapping,

  // Event Trigger Types
  type EventMessage,
  type EventProcessingResult,
  type EventTriggerConfig,
  type EventHandler,

  // Framework Adapter Types
  type ExpressLikeRequest,
  type ExpressLikeResponse,

  // Factory Functions
  createWebhookHandler,
  createSimpleHandler,
  createEventHandler,
  createResultMapper,

  // Default Mappers
  defaultValidationErrorMapper,
  defaultUnexpectedErrorMapper,

  // Framework Adapters
  toWebhookRequest,
  sendWebhookResponse,
  createExpressHandler,

  // Validation Helpers
  validationError,
  requireFields,
  composeValidators,
} from "./webhook";

// =============================================================================
// Policy-Driven Step Middleware
// =============================================================================

export {
  // Types
  type Policy,
  type PolicyFactory,
  type NamedPolicy,
  type WithPoliciesOptions,
  type PolicyRegistry,
  type StepOptionsBuilder,

  // Policy Composition
  mergePolicies,
  createPolicyApplier,
  createPolicyBundle,

  // Retry Policies
  retryPolicy,
  retryPolicies,

  // Timeout Policies
  timeoutPolicy,
  timeoutPolicies,

  // Combined Policies
  servicePolicies,

  // Policy Decorators
  withPolicy,
  withPolicies,

  // Conditional Policies
  conditionalPolicy,
  envPolicy,

  // Policy Registry
  createPolicyRegistry,

  // Fluent Builder
  stepOptions,
} from "./policies";

// =============================================================================
// Pluggable Persistence Adapters
// =============================================================================

export {
  // Serialization Types
  type SerializedResult,
  type SerializedCause,
  type SerializedMeta,
  type SerializedEntry,
  type SerializedState,

  // Serialization Helpers
  serializeCause,
  deserializeCause,
  serializeResult,
  deserializeResult,
  serializeMeta,
  deserializeMeta,
  serializeEntry,
  deserializeEntry,
  serializeState,
  deserializeState,
  stringifyState,
  parseState,

  // In-Memory Adapter
  type MemoryCacheOptions,
  createMemoryCache,

  // File System Adapter
  type FileCacheOptions,
  type FileSystemInterface,
  createFileCache,

  // Key-Value Store Adapter
  type KeyValueStore,
  type KVCacheOptions,
  createKVCache,

  // State Persistence
  type StatePersistence,
  createStatePersistence,

  // Hydrating Cache
  createHydratingCache,
} from "./persistence";

// =============================================================================
// Devtools
// =============================================================================

export {
  // Types
  type WorkflowRun,
  type RunDiff,
  type StepDiff,
  type TimelineEntry,
  type DevtoolsOptions,
  type Devtools,

  // Factory
  createDevtools,

  // Helpers
  renderDiff,
  quickVisualize,
  createConsoleLogger,
} from "./devtools";

// =============================================================================
// HITL Orchestration Helpers
// =============================================================================

export {
  // Types
  type ApprovalStatus,
  type ApprovalStore,
  type SavedWorkflowState,
  type WorkflowStateStore,
  type HITLOrchestratorOptions,
  type HITLExecutionResult,
  type PollerOptions,
  type HITLOrchestrator,
  type HITLWorkflowFactoryOptions,
  type ApprovalWebhookRequest,
  type ApprovalWebhookResponse,

  // In-Memory Stores
  createMemoryApprovalStore,
  createMemoryWorkflowStateStore,

  // Orchestrator
  createHITLOrchestrator,

  // Webhook Handlers
  createApprovalWebhookHandler,

  // Approval Checker
  createApprovalChecker,
} from "./hitl";

// =============================================================================
// Deterministic Workflow Testing Harness
// =============================================================================

export {
  // Types
  type ScriptedOutcome,
  type StepInvocation,
  type AssertionResult,
  type TestHarnessOptions,
  type MockStep,
  type WorkflowHarness,
  type MockFunction,
  type WorkflowSnapshot,

  // Test Harness
  createWorkflowHarness,

  // Mock Factories
  createMockFn,

  // Snapshot Testing
  createSnapshot,
  compareSnapshots,

  // Test Utilities
  createTestClock,
  okOutcome,
  errOutcome,
  throwOutcome,
} from "./testing";

// =============================================================================
// Batch Processing
// =============================================================================

export {
  // Types
  type BatchConfig,
  type BatchProgress,
  type BatchOptions,
  type BatchProcessingError,
  type InvalidBatchConfigError,

  // Functions
  processInBatches,
  isBatchProcessingError,
  isInvalidBatchConfigError,

  // Presets
  batchPresets,
} from "./batch";

// =============================================================================
// Resource Management
// =============================================================================

export {
  // Types
  type Resource,
  type ResourceScope,
  type ResourceCleanupError,

  // Functions
  createResourceScope,
  withScope,
  createResource,
  isResourceCleanupError,
} from "./resource";

// =============================================================================
// Duration - Type-safe time units
// =============================================================================

export {
  // Types
  type Duration as DurationType,

  // Namespace
  Duration,

  // Individual exports (for tree-shaking)
  millis,
  seconds,
  minutes,
  hours,
  days,
  toMillis,
  toSeconds,
  toMinutes,
  toHours,
  toDays,
  isDuration,
} from "./duration";

// =============================================================================
// Match - Exhaustive pattern matching
// =============================================================================

export {
  // Types
  type Tagged,
  type Matcher,

  // Namespace
  Match,

  // Individual exports
  matchValue,
  tag as matchTag,
  tags as matchTags,
  exhaustive,
  orElse as matchOrElse,
  orElseValue,
  is as isTag,
  isOneOf,
} from "./match";

// =============================================================================
// Schedule - Composable scheduling primitives
// =============================================================================

export {
  // Types
  type Schedule as ScheduleType,
  type ScheduleState,
  type ScheduleDecision,

  // Namespace
  Schedule,

  // Individual exports (for tree-shaking)
  forever,
  recurs,
  spaced,
  exponential,
  linear,
  fibonacci,
  upTo,
  upToElapsed,
  maxDelay,
  minDelay,
  whileInput,
  whileOutput,
  untilInput,
  untilOutput,
  jittered,
  addDelay,
  andThen as scheduleAndThen,
  union as scheduleUnion,
  intersect,
  modifyDelay,
  delays,
} from "./schedule";
