/**
 * @jagreehal/workflow/core
 *
 * Core Result primitives and run() function.
 * Use this module for minimal bundle size when you don't need the full workflow capabilities
 * (like retries, timeout, or state persistence) provided by `createWorkflow`.
 *
 * This module provides:
 * 1. `Result` types for error handling without try/catch
 * 2. `run()` function for executing steps with standardized error management
 * 3. Utilities for transforming and combining Results
 */

// =============================================================================
// Core Result Types
// =============================================================================

/**
 * Represents a successful computation or a failed one.
 * Use this type to represent the outcome of an operation that might fail,
 * instead of throwing exceptions.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value (defaults to unknown)
 * @template C - The type of the cause (defaults to unknown)
 */
export type Result<T, E = unknown, C = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: E; cause?: C };

/**
 * A Promise that resolves to a Result.
 * Use this for asynchronous operations that might fail.
 */
export type AsyncResult<T, E = unknown, C = unknown> = Promise<Result<T, E, C>>;

export type UnexpectedStepFailureCause =
  | {
      type: "STEP_FAILURE";
      origin: "result";
      error: unknown;
      cause?: unknown;
    }
  | {
      type: "STEP_FAILURE";
      origin: "throw";
      error: unknown;
      thrown: unknown;
    };

export type UnexpectedCause =
  | { type: "UNCAUGHT_EXCEPTION"; thrown: unknown }
  | UnexpectedStepFailureCause;

export type UnexpectedError = {
  type: "UNEXPECTED_ERROR";
  cause: UnexpectedCause;
};
export type PromiseRejectedError = { type: "PROMISE_REJECTED"; cause: unknown };
/** Cause type for promise rejections in async batch helpers */
export type PromiseRejectionCause = { type: "PROMISE_REJECTION"; reason: unknown };
export type EmptyInputError = { type: "EMPTY_INPUT"; message: string };
export type MaybeAsyncResult<T, E, C = unknown> = Result<T, E, C> | Promise<Result<T, E, C>>;

// =============================================================================
// Result Constructors
// =============================================================================

/**
 * Creates a successful Result.
 * Use this when an operation completes successfully.
 *
 * @param value - The success value to wrap
 * @returns A Result object with `{ ok: true, value }`
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err("Division by zero");
 *   return ok(a / b);
 * }
 * ```
 */
export const ok = <T>(value: T): Result<T, never, never> => ({ ok: true, value });

/**
 * Creates a failed Result.
 * Use this when an operation fails.
 *
 * @param error - The error value describing what went wrong (e.g., error code, object)
 * @param options - Optional context about the failure
 * @param options.cause - The underlying cause of the error (e.g., a caught exception)
 * @returns A Result object with `{ ok: false, error }` (and optional cause)
 *
 * @example
 * ```typescript
 * // Simple error
 * const r1 = err("NOT_FOUND");
 *
 * // Error with cause (useful for wrapping exceptions)
 * try {
 *   // ... unsafe code
 * } catch (e) {
 *   return err("PROCESSING_FAILED", { cause: e });
 * }
 * ```
 */
export const err = <E, C = unknown>(
  error: E,
  options?: { cause?: C }
): Result<never, E, C> => ({
  ok: false,
  error,
  ...(options?.cause !== undefined ? { cause: options.cause } : {}),
});

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Checks if a Result is successful.
 * Use this to narrow the type of a Result to the success case.
 *
 * @param r - The Result to check
 * @returns `true` if successful, allowing access to `r.value`
 *
 * @example
 * ```typescript
 * const r = someOperation();
 * if (isOk(r)) {
 *   // Use r.value (Type is T)
 *   processValue(r.value);
 * } else {
 *   // Handle r.error (Type is E)
 *   handleError(r.error);
 * }
 * ```
 */
export const isOk = <T, E, C>(r: Result<T, E, C>): r is { ok: true; value: T } =>
  r.ok;

/**
 * Checks if a Result is a failure.
 * Use this to narrow the type of a Result to the error case.
 *
 * @param r - The Result to check
 * @returns `true` if failed, allowing access to `r.error` and `r.cause`
 *
 * @example
 * ```typescript
 * if (isErr(r)) {
 *   // Handle error case early
 *   return;
 * }
 * // Proceed with success case
 * ```
 */
export const isErr = <T, E, C>(
  r: Result<T, E, C>
): r is { ok: false; error: E; cause?: C } => !r.ok;

/**
 * Checks if an error is an UnexpectedError.
 * Used internally by the framework but exported for advanced custom handling.
 * Indicates an error that wasn't typed/expected in the `run` signature.
 */
export const isUnexpectedError = (e: unknown): e is UnexpectedError =>
  typeof e === "object" &&
  e !== null &&
  (e as UnexpectedError).type === "UNEXPECTED_ERROR";

// =============================================================================
// Type Utilities
// =============================================================================

type AnyFunction = (...args: never[]) => unknown;

/**
 * Helper to extract the error type from Result or AsyncResult return values.
 * Works even when a function is declared to return a union of both forms.
 */
type ErrorOfReturn<R> = Extract<Awaited<R>, { ok: false }> extends { error: infer E }
  ? E
  : never;

/**
 * Extract error type from a single function's return type
 */
export type ErrorOf<T extends AnyFunction> = ErrorOfReturn<ReturnType<T>>;

/**
 * Extract union of error types from multiple functions
 */
export type Errors<T extends AnyFunction[]> = {
  [K in keyof T]: ErrorOf<T[K]>;
}[number];

/**
 * Extract value type from Result
 */
export type ExtractValue<T> = T extends { ok: true; value: infer U }
  ? U
  : never;

/**
 * Extract error type from Result
 */
export type ExtractError<T> = T extends { ok: false; error: infer E }
  ? E
  : never;

/**
 * Extract cause type from Result
 */
export type ExtractCause<T> = T extends { ok: false; cause?: infer C }
  ? C
  : never;

/**
 * Helper to extract the cause type from Result or AsyncResult return values.
 * Works even when a function is declared to return a union of both forms.
 */
type CauseOfReturn<R> = Extract<Awaited<R>, { ok: false }> extends { cause?: infer C }
  ? C
  : never;

/**
 * Extract cause type from a function's return type
 */
export type CauseOf<T extends AnyFunction> = CauseOfReturn<ReturnType<T>>;

// =============================================================================
// Step Options
// =============================================================================

/**
 * Options for configuring a step within a workflow.
 * Use these to enable tracing, caching, and state persistence.
 */
export type StepOptions = {
  /**
   * Human-readable label for the step.
   * Used in logs, traces, and error messages.
   * Highly recommended for debugging complex workflows.
   */
  name?: string;

  /**
   * Stable identity key for the step.
   * REQUIRED for:
   * 1. Caching: Used as the cache key.
   * 2. Resuming: Used to identify which steps have already completed.
   *
   * Must be unique within the workflow.
   */
  key?: string;
};

// =============================================================================
// RunStep Interface
// =============================================================================

/**
 * The `step` object passed to the function in `run(async (step) => { ... })`.
 * acts as the bridge between your business logic and the workflow engine.
 *
 * It provides methods to:
 * 1. Execute operations that return `Result` types.
 * 2. safely wrap operations that might throw exceptions (using `step.try`).
 * 3. Assign names and keys to operations for tracing and caching.
 *
 * @template E - The union of all known error types expected in this workflow.
 */
export interface RunStep<E = unknown> {
  /**
   * Execute a Result-returning operation (lazy function form).
   *
   * Use this form when the operation has side effects or is expensive,
   * so it's only executed if the step hasn't been cached/completed yet.
   *
   * @param operation - A function that returns a Result or AsyncResult
   * @param options - Step name or options object
   * @returns The success value (unwrapped)
   * @throws {EarlyExit} If the result is an error (stops execution safely)
   *
   * @example
   * ```typescript
   * const user = await step(() => fetchUser(id), "fetch-user");
   * ```
   */
  <T, StepE extends E, StepC = unknown>(
    operation: () => Result<T, StepE, StepC> | AsyncResult<T, StepE, StepC>,
    options?: StepOptions | string
  ): Promise<T>;

  /**
   * Execute a Result-returning operation (direct value form).
   *
   * Use this form for simple operations or when you already have a Result/Promise.
   * Note: The operation has already started/completed by the time `step` is called.
   *
   * @param result - A Result object or Promise resolving to a Result
   * @param options - Step name or options object
   * @returns The success value (unwrapped)
   * @throws {EarlyExit} If the result is an error (stops execution safely)
   *
   * @example
   * ```typescript
   * const user = await step(existingResult, "check-result");
   * ```
   */
  <T, StepE extends E, StepC = unknown>(
    result: Result<T, StepE, StepC> | AsyncResult<T, StepE, StepC>,
    options?: StepOptions | string
  ): Promise<T>;

  /**
   * Execute a standard throwing operation safely.
   * Catches exceptions and maps them to a typed error, or wraps them if no mapper is provided.
   *
   * Use this when integrating with libraries that throw exceptions.
   *
   * @param operation - A function that returns a value or Promise (may throw)
   * @param options - Configuration including error mapping
   * @returns The success value
   * @throws {EarlyExit} If the operation throws (stops execution safely)
   *
   * @example
   * ```typescript
   * const data = await step.try(
   *   () => db.query(),
   *   {
   *     name: "db-query",
   *     onError: (e) => ({ type: "DB_ERROR", cause: e })
   *   }
   * );
   * ```
   */
  try: <T, const Err extends E>(
    operation: () => T | Promise<T>,
    options:
      | { error: Err; name?: string; key?: string }
      | { onError: (cause: unknown) => Err; name?: string; key?: string }
  ) => Promise<T>;

  /**
   * Execute a Result-returning function and map its error to a typed error.
   *
   * Use this when calling functions that return Result<T, E> and you want to
   * map their typed errors to your workflow's error type. Unlike step.try(),
   * the error passed to onError is typed (not unknown).
   *
   * @param operation - A function that returns a Result or AsyncResult
   * @param options - Configuration including error mapping
   * @returns The success value (unwrapped)
   * @throws {EarlyExit} If the result is an error (stops execution safely)
   *
   * @example
   * ```typescript
   * const response = await step.fromResult(
   *   () => callProvider(input),
   *   {
   *     name: "call-provider",
   *     onError: (providerError) => ({
   *       type: "PROVIDER_FAILED",
   *       provider: providerError.provider,
   *       cause: providerError
   *     })
   *   }
   * );
   * ```
   */
  fromResult: <T, ResultE, const Err extends E>(
    operation: () => Result<T, ResultE, unknown> | AsyncResult<T, ResultE, unknown>,
    options:
      | { error: Err; name?: string; key?: string }
      | { onError: (resultError: ResultE) => Err; name?: string; key?: string }
  ) => Promise<T>;

  /**
   * Execute a parallel operation (allAsync) with scope events for visualization.
   *
   * This wraps the operation with scope_start and scope_end events, enabling
   * visualization of parallel execution branches.
   *
   * @param name - Name for this parallel block (used in visualization)
   * @param operation - A function that returns a Result from allAsync or allSettledAsync
   * @returns The success value (unwrapped array)
   *
   * @example
   * ```typescript
   * const [user, posts] = await step.parallel('Fetch all data', () =>
   *   allAsync([fetchUser(id), fetchPosts(id)])
   * );
   * ```
   */
  parallel: <T, StepE extends E, StepC = unknown>(
    name: string,
    operation: () => Result<T[], StepE, StepC> | AsyncResult<T[], StepE, StepC>
  ) => Promise<T[]>;

  /**
   * Execute a race operation (anyAsync) with scope events for visualization.
   *
   * This wraps the operation with scope_start and scope_end events, enabling
   * visualization of racing execution branches.
   *
   * @param name - Name for this race block (used in visualization)
   * @param operation - A function that returns a Result from anyAsync
   * @returns The success value (first to succeed)
   *
   * @example
   * ```typescript
   * const data = await step.race('Fastest API', () =>
   *   anyAsync([fetchFromPrimary(id), fetchFromFallback(id)])
   * );
   * ```
   */
  race: <T, StepE extends E, StepC = unknown>(
    name: string,
    operation: () => Result<T, StepE, StepC> | AsyncResult<T, StepE, StepC>
  ) => Promise<T>;

  /**
   * Execute an allSettled operation with scope events for visualization.
   *
   * This wraps the operation with scope_start and scope_end events, enabling
   * visualization of allSettled execution branches. Unlike step.parallel,
   * allSettled collects all results even if some fail.
   *
   * @param name - Name for this allSettled block (used in visualization)
   * @param operation - A function that returns a Result from allSettledAsync
   * @returns The success value (unwrapped array)
   *
   * @example
   * ```typescript
   * const [user, posts] = await step.allSettled('Fetch all data', () =>
   *   allSettledAsync([fetchUser(id), fetchPosts(id)])
   * );
   * ```
   */
  allSettled: <T, StepE extends E, StepC = unknown>(
    name: string,
    operation: () => Result<T[], StepE, StepC> | AsyncResult<T[], StepE, StepC>
  ) => Promise<T[]>;
}

// =============================================================================
// Event Types (for run() optional event support)
// =============================================================================

/**
 * Unified event stream for workflow execution.
 *
 * Note: step_complete.result uses Result<unknown, unknown, unknown> because events
 * aggregate results from heterogeneous steps. At runtime, the actual Result object
 * preserves its original types, but the event type cannot statically represent them.
 * Use runtime checks or the meta field to interpret cause values.
 */
/**
 * Scope types for parallel and race operations.
 */
export type ScopeType = "parallel" | "race" | "allSettled";

export type WorkflowEvent<E> =
  | { type: "workflow_start"; workflowId: string; ts: number }
  | { type: "workflow_success"; workflowId: string; ts: number; durationMs: number }
  | { type: "workflow_error"; workflowId: string; ts: number; durationMs: number; error: E }
  | { type: "step_start"; workflowId: string; stepId: string; stepKey?: string; name?: string; ts: number }
  | { type: "step_success"; workflowId: string; stepId: string; stepKey?: string; name?: string; ts: number; durationMs: number }
  | { type: "step_error"; workflowId: string; stepId: string; stepKey?: string; name?: string; ts: number; durationMs: number; error: E }
  | { type: "step_aborted"; workflowId: string; stepId: string; stepKey?: string; name?: string; ts: number; durationMs: number }
  | { type: "step_complete"; workflowId: string; stepKey: string; name?: string; ts: number; durationMs: number; result: Result<unknown, unknown, unknown>; meta?: StepFailureMeta }
  | { type: "step_cache_hit"; workflowId: string; stepKey: string; name?: string; ts: number }
  | { type: "step_cache_miss"; workflowId: string; stepKey: string; name?: string; ts: number }
  | { type: "step_skipped"; workflowId: string; stepKey?: string; name?: string; reason?: string; decisionId?: string; ts: number }
  | { type: "scope_start"; workflowId: string; scopeId: string; scopeType: ScopeType; name?: string; ts: number }
  | { type: "scope_end"; workflowId: string; scopeId: string; ts: number; durationMs: number; winnerId?: string };

// =============================================================================
// Run Options
// =============================================================================

export type RunOptionsWithCatch<E, C = void> = {
  /**
   * Handler for expected errors.
   * Called when a step fails with a known error type.
   */
  onError?: (error: E, stepName?: string) => void;
  /**
   * Listener for workflow events (start, success, error, step events).
   * Use this for logging, telemetry, or debugging.
   */
  onEvent?: (event: WorkflowEvent<E | UnexpectedError>, ctx: C) => void;
  /**
   * Catch-all mapper for unexpected exceptions.
   * Required for "Strict Mode".
   * Converts unknown exceptions (like network crashes or bugs) into your typed error union E.
   */
  catchUnexpected: (cause: unknown) => E;
  /**
   * Unique ID for this workflow execution.
   * Defaults to a random UUID.
   * Useful for correlating logs across distributed systems.
   */
  workflowId?: string;
  /**
   * Arbitrary context object passed to onEvent.
   * Useful for passing request IDs, user IDs, or loggers.
   */
  context?: C;
};

export type RunOptionsWithoutCatch<E, C = void> = {
  /**
   * Handler for expected errors AND unexpected errors.
   * Unexpected errors will be wrapped in `UnexpectedError`.
   */
  onError?: (error: E | UnexpectedError, stepName?: string) => void;
  onEvent?: (event: WorkflowEvent<E | UnexpectedError>, ctx: C) => void;
  catchUnexpected?: undefined;
  workflowId?: string;
  context?: C;
};

export type RunOptions<E, C = void> = RunOptionsWithCatch<E, C> | RunOptionsWithoutCatch<E, C>;

// =============================================================================
// Early Exit Mechanism (exported for caching layer)
// =============================================================================

/**
 * Symbol used to identify early exit throws.
 * Exported for the caching layer in workflow.ts.
 * @internal
 */
export const EARLY_EXIT_SYMBOL: unique symbol = Symbol("early-exit");

/**
 * Metadata about how a step failed.
 * @internal
 */
export type StepFailureMeta =
  | { origin: "result"; resultCause?: unknown }
  | { origin: "throw"; thrown: unknown };

/**
 * Early exit object thrown to short-circuit workflow execution.
 * @internal
 */
export type EarlyExit<E> = {
  [EARLY_EXIT_SYMBOL]: true;
  error: E;
  meta: StepFailureMeta;
};

/**
 * Create an early exit throw object.
 * Used by the caching layer to synthesize early exits for cached errors.
 * @internal
 */
export function createEarlyExit<E>(error: E, meta: StepFailureMeta): EarlyExit<E> {
  return {
    [EARLY_EXIT_SYMBOL]: true,
    error,
    meta,
  };
}

/**
 * Type guard for early exit objects.
 * @internal
 */
export function isEarlyExit<E>(e: unknown): e is EarlyExit<E> {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as Record<PropertyKey, unknown>)[EARLY_EXIT_SYMBOL] === true
  );
}

/**
 * Symbol to mark exceptions thrown by catchUnexpected mappers.
 * These should propagate without being re-processed.
 * @internal
 */
const MAPPER_EXCEPTION_SYMBOL: unique symbol = Symbol("mapper-exception");

type MapperException = {
  [MAPPER_EXCEPTION_SYMBOL]: true;
  thrown: unknown;
};

function createMapperException(thrown: unknown): MapperException {
  return { [MAPPER_EXCEPTION_SYMBOL]: true, thrown };
}

function isMapperException(e: unknown): e is MapperException {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as Record<PropertyKey, unknown>)[MAPPER_EXCEPTION_SYMBOL] === true
  );
}

/** Helper to parse step options - accepts string or object form */
function parseStepOptions(options?: StepOptions | string): { name?: string; key?: string } {
  if (typeof options === "string") {
    return { name: options };
  }
  return options ?? {};
}

// =============================================================================
// run() Function
// =============================================================================

/**
 * Execute a workflow with step-based error handling.
 *
 * ## When to Use run()
 *
 * Use `run()` when:
 * - Dependencies are dynamic (passed at runtime, not known at compile time)
 * - You don't need step caching or resume state
 * - Error types are known upfront and can be specified manually
 * - Building lightweight, one-off workflows
 *
 * For automatic error type inference from static dependencies, use `createWorkflow()`.
 *
 * ## Modes
 *
 * `run()` has three modes based on options:
 * - **Strict Mode** (`catchUnexpected`): Returns `Result<T, E>` (closed union)
 * - **Typed Mode** (`onError`): Returns `Result<T, E | UnexpectedError>`
 * - **Safe Default** (no options): Returns `Result<T, UnexpectedError>`
 *
 * @example
 * ```typescript
 * // Typed mode with explicit error union
 * const result = await run<Output, 'NOT_FOUND' | 'FETCH_ERROR'>(
 *   async (step) => {
 *     const user = await step(fetchUser(userId));
 *     return user;
 *   },
 *   { onError: (e) => console.log('Failed:', e) }
 * );
 * ```
 *
 * @see createWorkflow - For static dependencies with auto error inference
 */

/**
 * Execute a workflow with "Strict Mode" error handling.
 *
 * In this mode, you MUST provide `catchUnexpected` to map unknown exceptions
 * to your typed error union `E`. This guarantees that the returned Result
 * will only ever contain errors of type `E`.
 *
 * @param fn - The workflow function containing steps
 * @param options - Configuration options, including `catchUnexpected`
 * @returns A Promise resolving to `Result<T, E>`
 *
 * @example
 * ```typescript
 * const result = await run(async (step) => {
 *   // ... steps ...
 * }, {
 *   catchUnexpected: (e) => ({ type: 'UNKNOWN_ERROR', cause: e })
 * });
 * ```
 */
export function run<T, E, C = void>(
  fn: (step: RunStep<E>) => Promise<T> | T,
  options: RunOptionsWithCatch<E, C>
): AsyncResult<T, E, unknown>;

/**
 * Execute a workflow with "Typed Mode" error handling.
 *
 * In this mode, you provide an `onError` callback. The returned Result
 * may contain your typed errors `E` OR `UnexpectedError` if an uncaught
 * exception occurs.
 *
 * @param fn - The workflow function containing steps
 * @param options - Configuration options, including `onError`
 * @returns A Promise resolving to `Result<T, E | UnexpectedError>`
 */
export function run<T, E, C = void>(
  fn: (step: RunStep<E | UnexpectedError>) => Promise<T> | T,
  options: {
    onError: (error: E | UnexpectedError, stepName?: string) => void;
    onEvent?: (event: WorkflowEvent<E | UnexpectedError>, ctx: C) => void;
    workflowId?: string;
    context?: C;
  }
): AsyncResult<T, E | UnexpectedError, unknown>;

/**
 * Execute a workflow with "Safe Default" error handling.
 *
 * In this mode, you don't need to specify any error types.
 * Any error (Result error or thrown exception) will be returned as
 * an `UnexpectedError`.
 *
 * @param fn - The workflow function containing steps
 * @param options - Optional configuration
 * @returns A Promise resolving to `Result<T, UnexpectedError>`
 *
 * @example
 * ```typescript
 * const result = await run(async (step) => {
 *   return await step(someOp());
 * });
 * ```
 */
export function run<T, C = void>(
  fn: (step: RunStep) => Promise<T> | T,
  options?: {
    onEvent?: (event: WorkflowEvent<UnexpectedError>, ctx: C) => void;
    workflowId?: string;
    context?: C;
  }
): AsyncResult<T, UnexpectedError, unknown>;

// Implementation
export async function run<T, E, C = void>(
  fn: (step: RunStep<E | UnexpectedError>) => Promise<T> | T,
  options?: RunOptions<E, C>
): AsyncResult<T, E | UnexpectedError> {
  const {
    onError,
    onEvent,
    catchUnexpected,
    workflowId: providedWorkflowId,
    context,
  } = options && typeof options === "object"
    ? (options as RunOptions<E, C>)
    : ({} as RunOptions<E, C>);

  const workflowId = providedWorkflowId ?? crypto.randomUUID();
  const wrapMode = !onError && !catchUnexpected;

  // Track active scopes as a stack for proper nesting
  // When a step succeeds, only the innermost race scope gets the winner
  const activeScopeStack: Array<{ scopeId: string; type: "race" | "parallel" | "allSettled"; winnerId?: string }> = [];

  // Counter for generating unique step IDs
  let stepIdCounter = 0;

  // Generate a unique step ID
  // Uses stepKey when provided (for cache stability), otherwise generates a unique ID.
  // Note: name is NOT used for stepId because multiple concurrent steps may share a name,
  // which would cause them to collide in activeSteps tracking and race winner detection.
  const generateStepId = (stepKey?: string): string => {
    return stepKey ?? `step_${++stepIdCounter}`;
  };

  const emitEvent = (event: WorkflowEvent<E | UnexpectedError>) => {
    // Track first successful step in the innermost race scope for winnerId
    if (event.type === "step_success") {
      // Use the stepId from the event (already generated at step start)
      const stepId = event.stepId;

      // Find innermost race scope (search from end of stack)
      for (let i = activeScopeStack.length - 1; i >= 0; i--) {
        const scope = activeScopeStack[i];
        if (scope.type === "race" && !scope.winnerId) {
          scope.winnerId = stepId;
          break; // Only update innermost race scope
        }
      }
    }
    onEvent?.(event, context as C);
  };

  // Use the exported early exit function with proper type parameter
  const earlyExit = createEarlyExit<E>;

  // Local type guard that narrows to EarlyExit<E> specifically
  const isEarlyExitE = (e: unknown): e is EarlyExit<E> => isEarlyExit(e);

  const wrapForStep = (
    error: unknown,
    meta?: StepFailureMeta
  ): E | UnexpectedError => {
    if (!wrapMode) {
      return error as E;
    }

    if (meta?.origin === "result") {
      return {
        type: "UNEXPECTED_ERROR",
        cause: {
          type: "STEP_FAILURE",
          origin: "result",
          error,
          ...(meta.resultCause !== undefined
            ? { cause: meta.resultCause }
            : {}),
        },
      };
    }

    if (meta?.origin === "throw") {
      return {
        type: "UNEXPECTED_ERROR",
        cause: {
          type: "STEP_FAILURE",
          origin: "throw",
          error,
          thrown: meta.thrown,
        },
      };
    }

    return {
      type: "UNEXPECTED_ERROR",
      cause: {
        type: "STEP_FAILURE",
        origin: "result",
        error,
      },
    };
  };

  const causeFromMeta = (meta: StepFailureMeta): unknown => {
    if (meta.origin === "result") {
      return meta.resultCause;
    }
    return meta.thrown;
  };

  const unexpectedFromFailure = (failure: EarlyExit<E>): UnexpectedError => ({
    type: "UNEXPECTED_ERROR",
    cause:
      failure.meta.origin === "result"
        ? {
            type: "STEP_FAILURE" as const,
            origin: "result" as const,
            error: failure.error,
            ...(failure.meta.resultCause !== undefined
              ? { cause: failure.meta.resultCause }
              : {}),
          }
        : {
            type: "STEP_FAILURE" as const,
            origin: "throw" as const,
            error: failure.error,
            thrown: failure.meta.thrown,
          },
  });

  try {
    const stepFn = <T, StepE, StepC = unknown>(
      operationOrResult:
        | (() => Result<T, StepE, StepC> | AsyncResult<T, StepE, StepC>)
        | Result<T, StepE, StepC>
        | AsyncResult<T, StepE, StepC>,
      stepOptions?: StepOptions | string
    ): Promise<T> => {
      return (async () => {
        const { name: stepName, key: stepKey } = parseStepOptions(stepOptions);
        const stepId = generateStepId(stepKey);
        const hasEventListeners = onEvent;
        const startTime = hasEventListeners ? performance.now() : 0;

        if (onEvent) {
          emitEvent({
            type: "step_start",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
          });
        }

        let result: Result<T, StepE, StepC>;
        try {
          result = await (typeof operationOrResult === "function"
            ? operationOrResult()
            : operationOrResult);
        } catch (thrown) {
          const durationMs = performance.now() - startTime;
          if (isEarlyExitE(thrown)) {
            emitEvent({
              type: "step_aborted",
              workflowId,
              stepId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
            });
            throw thrown;
          }

          if (catchUnexpected) {
            // Strict mode: call catchUnexpected once, protect against mapper exceptions
            let mappedError: E;
            try {
              mappedError = catchUnexpected(thrown) as unknown as E;
            } catch (mapperError) {
              // Mapper threw - wrap and propagate so run()'s outer catch doesn't re-process
              throw createMapperException(mapperError);
            }
            emitEvent({
              type: "step_error",
              workflowId,
              stepId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              error: mappedError,
            });
            // Emit step_complete for keyed steps (for state persistence)
            if (stepKey) {
              emitEvent({
                type: "step_complete",
                workflowId,
                stepKey,
                name: stepName,
                ts: Date.now(),
                durationMs,
                result: err(mappedError, { cause: thrown }),
                meta: { origin: "throw", thrown },
              });
            }
            onError?.(mappedError as E, stepName);
            throw earlyExit(mappedError as E, { origin: "throw", thrown });
          } else {
            // Safe-default mode: emit event and re-throw original exception
            // run()'s outer catch will create UnexpectedError with UNCAUGHT_EXCEPTION
            const unexpectedError: UnexpectedError = {
              type: "UNEXPECTED_ERROR",
              cause: { type: "UNCAUGHT_EXCEPTION", thrown },
            };
            emitEvent({
              type: "step_error",
              workflowId,
              stepId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              error: unexpectedError,
            });
            // Emit step_complete for keyed steps (for state persistence)
            // In safe-default mode, the error is already an UnexpectedError
            // We use origin:"throw" so resume knows this came from an uncaught exception
            if (stepKey) {
              emitEvent({
                type: "step_complete",
                workflowId,
                stepKey,
                name: stepName,
                ts: Date.now(),
                durationMs,
                result: err(unexpectedError, { cause: thrown }),
                meta: { origin: "throw", thrown },
              });
            }
            throw thrown;
          }
        }

        const durationMs = performance.now() - startTime;

        if (result.ok) {
          emitEvent({
            type: "step_success",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
            durationMs,
          });
          // Emit step_complete for keyed steps (for state persistence)
          // Pass original result to preserve cause type (Result<T, StepE, StepC>)
          if (stepKey) {
            emitEvent({
              type: "step_complete",
              workflowId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              result,
            });
          }
          return result.value;
        }

        const wrappedError = wrapForStep(result.error, {
          origin: "result",
          resultCause: result.cause,
        });
        emitEvent({
          type: "step_error",
          workflowId,
          stepId,
          stepKey,
          name: stepName,
          ts: Date.now(),
          durationMs,
          error: wrappedError,
        });
        // Emit step_complete for keyed steps (for state persistence)
        // Pass original result to preserve cause type (Result<T, StepE, StepC>)
        if (stepKey) {
          emitEvent({
            type: "step_complete",
            workflowId,
            stepKey,
            name: stepName,
            ts: Date.now(),
            durationMs,
            result,
            meta: { origin: "result", resultCause: result.cause },
          });
        }
        onError?.(result.error as unknown as E, stepName);
        throw earlyExit(result.error as unknown as E, {
          origin: "result",
          resultCause: result.cause,
        });
      })();
    };

    stepFn.try = <T, Err>(
      operation: () => T | Promise<T>,
      opts:
        | { error: Err; name?: string; key?: string }
        | { onError: (cause: unknown) => Err; name?: string; key?: string }
    ): Promise<T> => {
      const stepName = opts.name;
      const stepKey = opts.key;
      const stepId = generateStepId(stepKey);
      const mapToError = "error" in opts ? () => opts.error : opts.onError;
      const hasEventListeners = onEvent;

      return (async () => {
        const startTime = hasEventListeners ? performance.now() : 0;

        if (onEvent) {
          emitEvent({
            type: "step_start",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
          });
        }

        try {
          const value = await operation();
          const durationMs = performance.now() - startTime;
          emitEvent({
            type: "step_success",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
            durationMs,
          });
          // Emit step_complete for keyed steps (for state persistence)
          if (stepKey) {
            emitEvent({
              type: "step_complete",
              workflowId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              result: ok(value),
            });
          }
          return value;
        } catch (error) {
          const mapped = mapToError(error);
          const durationMs = performance.now() - startTime;
          const wrappedError = wrapForStep(mapped, { origin: "throw", thrown: error });
          emitEvent({
            type: "step_error",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
            durationMs,
            error: wrappedError,
          });
          // Emit step_complete for keyed steps (for state persistence)
          // Note: For step.try errors, we encode the mapped error, not the original thrown
          if (stepKey) {
            emitEvent({
              type: "step_complete",
              workflowId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              result: err(mapped, { cause: error }),
              meta: { origin: "throw", thrown: error },
            });
          }
          onError?.(mapped as unknown as E, stepName);
          throw earlyExit(mapped as unknown as E, { origin: "throw", thrown: error });
        }
      })();
    };

    // step.fromResult: Execute a Result-returning function and map its typed error
    stepFn.fromResult = <T, ResultE, Err>(
      operation: () => Result<T, ResultE, unknown> | AsyncResult<T, ResultE, unknown>,
      opts:
        | { error: Err; name?: string; key?: string }
        | { onError: (resultError: ResultE) => Err; name?: string; key?: string }
    ): Promise<T> => {
      const stepName = opts.name;
      const stepKey = opts.key;
      const stepId = generateStepId(stepKey);
      const mapToError = "error" in opts ? () => opts.error : opts.onError;
      const hasEventListeners = onEvent;

      return (async () => {
        const startTime = hasEventListeners ? performance.now() : 0;

        if (onEvent) {
          emitEvent({
            type: "step_start",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
          });
        }

        const result = await operation();

        if (result.ok) {
          const durationMs = performance.now() - startTime;
          emitEvent({
            type: "step_success",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
            durationMs,
          });
          // Emit step_complete for keyed steps (for state persistence)
          if (stepKey) {
            emitEvent({
              type: "step_complete",
              workflowId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              result: ok(result.value),
            });
          }
          return result.value;
        } else {
          const mapped = mapToError(result.error);
          const durationMs = performance.now() - startTime;
          // For fromResult, the cause is the original result.error (what got mapped)
          // This is analogous to step.try using thrown exception as cause
          const wrappedError = wrapForStep(mapped, {
            origin: "result",
            resultCause: result.error,
          });
          emitEvent({
            type: "step_error",
            workflowId,
            stepId,
            stepKey,
            name: stepName,
            ts: Date.now(),
            durationMs,
            error: wrappedError,
          });
          // Emit step_complete for keyed steps (for state persistence)
          if (stepKey) {
            emitEvent({
              type: "step_complete",
              workflowId,
              stepKey,
              name: stepName,
              ts: Date.now(),
              durationMs,
              result: err(mapped, { cause: result.error }),
              meta: { origin: "result", resultCause: result.error },
            });
          }
          onError?.(mapped as unknown as E, stepName);
          throw earlyExit(mapped as unknown as E, {
            origin: "result",
            resultCause: result.error,
          });
        }
      })();
    };

    // step.parallel: Execute a parallel operation with scope events
    stepFn.parallel = <T, StepE, StepC>(
      name: string,
      operation: () => Result<T[], StepE, StepC> | AsyncResult<T[], StepE, StepC>
    ): Promise<T[]> => {
      const scopeId = `scope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return (async () => {
        const startTime = performance.now();
        let scopeEnded = false;

        // Push this scope onto the stack for proper nesting tracking
        activeScopeStack.push({ scopeId, type: "parallel" });

        // Helper to emit scope_end exactly once
        const emitScopeEnd = () => {
          if (scopeEnded) return;
          scopeEnded = true;
          // Pop this scope from the stack
          const idx = activeScopeStack.findIndex(s => s.scopeId === scopeId);
          if (idx !== -1) activeScopeStack.splice(idx, 1);
          emitEvent({
            type: "scope_end",
            workflowId,
            scopeId,
            ts: Date.now(),
            durationMs: performance.now() - startTime,
          });
        };

        // Emit scope_start event
        emitEvent({
          type: "scope_start",
          workflowId,
          scopeId,
          scopeType: "parallel",
          name,
          ts: Date.now(),
        });

        try {
          const result = await operation();

          // Emit scope_end before processing result
          emitScopeEnd();

          if (!result.ok) {
            onError?.(result.error as unknown as E, name);
            throw earlyExit(result.error as unknown as E, {
              origin: "result",
              resultCause: result.cause,
            });
          }

          return result.value;
        } catch (error) {
          // Always emit scope_end in finally-like fashion
          emitScopeEnd();
          throw error;
        }
      })();
    };

    // step.race: Execute a race operation with scope events
    stepFn.race = <T, StepE, StepC>(
      name: string,
      operation: () => Result<T, StepE, StepC> | AsyncResult<T, StepE, StepC>
    ): Promise<T> => {
      const scopeId = `scope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return (async () => {
        const startTime = performance.now();
        let scopeEnded = false;

        // Push this race scope onto the stack to track the first successful step as winner
        const scopeEntry = { scopeId, type: "race" as const, winnerId: undefined as string | undefined };
        activeScopeStack.push(scopeEntry);

        // Helper to emit scope_end exactly once, including winnerId
        const emitScopeEnd = () => {
          if (scopeEnded) return;
          scopeEnded = true;
          // Pop this scope from the stack
          const idx = activeScopeStack.findIndex(s => s.scopeId === scopeId);
          if (idx !== -1) activeScopeStack.splice(idx, 1);
          emitEvent({
            type: "scope_end",
            workflowId,
            scopeId,
            ts: Date.now(),
            durationMs: performance.now() - startTime,
            winnerId: scopeEntry.winnerId,
          });
        };

        // Emit scope_start event
        emitEvent({
          type: "scope_start",
          workflowId,
          scopeId,
          scopeType: "race",
          name,
          ts: Date.now(),
        });

        try {
          const result = await operation();

          // Emit scope_end before processing result
          emitScopeEnd();

          if (!result.ok) {
            onError?.(result.error as unknown as E, name);
            throw earlyExit(result.error as unknown as E, {
              origin: "result",
              resultCause: result.cause,
            });
          }

          return result.value;
        } catch (error) {
          // Always emit scope_end in finally-like fashion
          emitScopeEnd();
          throw error;
        }
      })();
    };

    // step.allSettled: Execute an allSettled operation with scope events
    stepFn.allSettled = <T, StepE, StepC>(
      name: string,
      operation: () => Result<T[], StepE, StepC> | AsyncResult<T[], StepE, StepC>
    ): Promise<T[]> => {
      const scopeId = `scope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return (async () => {
        const startTime = performance.now();
        let scopeEnded = false;

        // Push this scope onto the stack for proper nesting tracking
        activeScopeStack.push({ scopeId, type: "allSettled" });

        // Helper to emit scope_end exactly once
        const emitScopeEnd = () => {
          if (scopeEnded) return;
          scopeEnded = true;
          // Pop this scope from the stack
          const idx = activeScopeStack.findIndex(s => s.scopeId === scopeId);
          if (idx !== -1) activeScopeStack.splice(idx, 1);
          emitEvent({
            type: "scope_end",
            workflowId,
            scopeId,
            ts: Date.now(),
            durationMs: performance.now() - startTime,
          });
        };

        // Emit scope_start event
        emitEvent({
          type: "scope_start",
          workflowId,
          scopeId,
          scopeType: "allSettled",
          name,
          ts: Date.now(),
        });

        try {
          const result = await operation();

          // Emit scope_end before processing result
          emitScopeEnd();

          if (!result.ok) {
            onError?.(result.error as unknown as E, name);
            throw earlyExit(result.error as unknown as E, {
              origin: "result",
              resultCause: result.cause,
            });
          }

          return result.value;
        } catch (error) {
          // Always emit scope_end in finally-like fashion
          emitScopeEnd();
          throw error;
        }
      })();
    };

    const step = stepFn as RunStep<E | UnexpectedError>;
    const value = await fn(step);
    return ok(value);
  } catch (error) {
    // If a catchUnexpected mapper threw, propagate without re-processing
    if (isMapperException(error)) {
      throw error.thrown;
    }

    if (isEarlyExitE(error)) {
      const failureCause = causeFromMeta(error.meta);
      if (catchUnexpected || onError) {
        return err(error.error, { cause: failureCause });
      }
      // If the error is already an UnexpectedError (e.g., from resumed state),
      // return it directly without wrapping in another STEP_FAILURE
      if (isUnexpectedError(error.error)) {
        return err(error.error, { cause: failureCause });
      }
      const unexpectedError = unexpectedFromFailure(error);
      return err(unexpectedError, { cause: failureCause });
    }

    if (catchUnexpected) {
      const mapped = catchUnexpected(error);
      onError?.(mapped, "unexpected");
      return err(mapped, { cause: error });
    }

    const unexpectedError: UnexpectedError = {
      type: "UNEXPECTED_ERROR",
      cause: { type: "UNCAUGHT_EXCEPTION", thrown: error },
    };
    onError?.(unexpectedError as unknown as E, "unexpected");
    return err(unexpectedError, { cause: error });
  }
}

/**
 * Executes a workflow in "Strict Mode" with a closed error union.
 *
 * ## When to Use
 *
 * Use `run.strict()` when:
 * - You want a closed error union (no `UnexpectedError`)
 * - You need exhaustive error handling in production
 * - You want to guarantee all errors are explicitly typed
 * - You're building APIs where error types must be known
 *
 * ## Why Use This
 *
 * - **Closed union**: Error type is exactly `E`, no `UnexpectedError`
 * - **Exhaustive**: Forces you to handle all possible errors
 * - **Type-safe**: TypeScript ensures all errors are typed
 * - **Production-ready**: Better for APIs and libraries
 *
 * ## Important
 *
 * You MUST provide `catchUnexpected` to map any uncaught exceptions to your error type `E`.
 * This ensures the error union is truly closed.
 *
 * @param fn - The workflow function containing steps
 * @param options - Configuration options, MUST include `catchUnexpected`
 * @returns A Promise resolving to `Result<T, E>` (no UnexpectedError)
 *
 * @example
 * ```typescript
 * type AppError = 'NOT_FOUND' | 'UNAUTHORIZED' | 'UNEXPECTED';
 *
 * const result = await run.strict<User, AppError>(
 *   async (step) => {
 *     return await step(fetchUser(id));
 *   },
 *   {
 *     catchUnexpected: () => 'UNEXPECTED' as const
 *   }
 * );
 * // result.error: 'NOT_FOUND' | 'UNAUTHORIZED' | 'UNEXPECTED' (exactly)
 * ```
 */
run.strict = <T, E, C = void>(
  fn: (step: RunStep<E>) => Promise<T> | T,
  options: {
    onError?: (error: E, stepName?: string) => void;
    onEvent?: (event: WorkflowEvent<E | UnexpectedError>, ctx: C) => void;
    catchUnexpected: (cause: unknown) => E;
    workflowId?: string;
    context?: C;
  }
): AsyncResult<T, E, unknown> => {
  return run<T, E, C>(fn, options);
};

// =============================================================================
// Unwrap Utilities
// =============================================================================

/**
 * Error thrown when `unwrap()` is called on an error Result.
 *
 * This error is thrown to prevent silent failures when using `unwrap()`.
 * Prefer using `unwrapOr`, `unwrapOrElse`, or pattern matching with `match` or `isOk`/`isErr`.
 */
export class UnwrapError<E = unknown, C = unknown> extends Error {
  constructor(
    public readonly error: E,
    public readonly cause?: C
  ) {
    super(`Unwrap called on an error result: ${String(error)}`);
    this.name = "UnwrapError";
  }
}

/**
 * Unwraps a Result, throwing an error if it's a failure.
 *
 * ## When to Use
 *
 * Use `unwrap()` when:
 * - You're certain the Result is successful (e.g., after checking with `isOk`)
 * - You're in a context where errors should crash (e.g., tests, initialization)
 * - You need the value immediately and can't handle errors gracefully
 *
 * ## Why Avoid This
 *
 * **Prefer alternatives** in production code:
 * - `unwrapOr(defaultValue)` - Provide a fallback value
 * - `unwrapOrElse(fn)` - Compute fallback from error
 * - `match()` - Handle both cases explicitly
 * - `isOk()` / `isErr()` - Type-safe pattern matching
 *
 * Throwing errors makes error handling harder and can crash your application.
 *
 * @param r - The Result to unwrap
 * @returns The success value if the Result is successful
 * @throws {UnwrapError} If the Result is an error (includes the error and cause)
 *
 * @example
 * ```typescript
 * // Safe usage after checking
 * const result = someOperation();
 * if (isOk(result)) {
 *   const value = unwrap(result); // Safe - we know it's ok
 * }
 *
 * // Unsafe usage (not recommended)
 * const value = unwrap(someOperation()); // May throw!
 * ```
 */
export const unwrap = <T, E, C>(r: Result<T, E, C>): T => {
  if (r.ok) return r.value;
  throw new UnwrapError<E, C>(r.error, r.cause);
};

/**
 * Unwraps a Result, returning a default value if it's a failure.
 *
 * ## When to Use
 *
 * Use `unwrapOr()` when:
 * - You have a sensible default value for errors
 * - You want to continue execution even on failure
 * - The default value is cheap to compute (use `unwrapOrElse` if expensive)
 *
 * ## Why Use This
 *
 * - **Safe**: Never throws, always returns a value
 * - **Simple**: One-liner for common error handling
 * - **Type-safe**: TypeScript knows you'll always get a `T`
 *
 * @param r - The Result to unwrap
 * @param defaultValue - The value to return if the Result is an error
 * @returns The success value if successful, otherwise the default value
 *
 * @example
 * ```typescript
 * // Provide default for missing data
 * const user = unwrapOr(fetchUser(id), { id: 'anonymous', name: 'Guest' });
 *
 * // Provide default for numeric operations
 * const count = unwrapOr(parseCount(input), 0);
 *
 * // Provide default for optional features
 * const config = unwrapOr(loadConfig(), getDefaultConfig());
 * ```
 */
export const unwrapOr = <T, E, C>(r: Result<T, E, C>, defaultValue: T): T =>
  r.ok ? r.value : defaultValue;

/**
 * Unwraps a Result, computing a default value from the error if it's a failure.
 *
 * ## When to Use
 *
 * Use `unwrapOrElse()` when:
 * - The default value is expensive to compute (lazy evaluation)
 * - You need to log or handle the error before providing a default
 * - The default depends on the error type or cause
 * - You want to transform the error into a success value
 *
 * ## Why Use This Instead of `unwrapOr`
 *
 * - **Lazy**: Default is only computed if needed (better performance)
 * - **Error-aware**: You can inspect the error before providing default
 * - **Flexible**: Default can depend on error type or cause
 *
 * @param r - The Result to unwrap
 * @param fn - Function that receives the error and optional cause, returns the default value
 * @returns The success value if successful, otherwise the result of calling `fn(error, cause)`
 *
 * @example
 * ```typescript
 * // Compute default based on error type
 * const port = unwrapOrElse(parsePort(env.PORT), (error) => {
 *   if (error === 'INVALID_FORMAT') return 3000;
 *   if (error === 'OUT_OF_RANGE') return 8080;
 *   return 4000; // default
 * });
 *
 * // Log error before providing default
 * const data = unwrapOrElse(fetchData(), (error, cause) => {
 *   console.error('Failed to fetch:', error, cause);
 *   return getCachedData();
 * });
 *
 * // Transform error into success value
 * const result = unwrapOrElse(operation(), (error) => {
 *   return { success: false, reason: String(error) };
 * });
 * ```
 */
export const unwrapOrElse = <T, E, C>(
  r: Result<T, E, C>,
  fn: (error: E, cause?: C) => T
): T => (r.ok ? r.value : fn(r.error, r.cause));

// =============================================================================
// Wrapping Functions
// =============================================================================

/**
 * Wraps a synchronous throwing function in a Result.
 *
 * ## When to Use
 *
 * Use `from()` when:
 * - You have a synchronous function that throws exceptions
 * - You want to convert exceptions to typed errors
 * - You're integrating with libraries that throw (e.g., JSON.parse, fs.readFileSync)
 * - You need to handle errors without try/catch blocks
 *
 * ## Why Use This
 *
 * - **Type-safe errors**: Convert thrown exceptions to typed Result errors
 * - **No try/catch**: Cleaner code without nested try/catch blocks
 * - **Composable**: Results can be chained with `andThen`, `map`, etc.
 * - **Explicit errors**: Forces you to handle errors explicitly
 *
 * @param fn - The synchronous function to execute (may throw)
 * @returns A Result with the function's return value or the thrown error
 *
 * @example
 * ```typescript
 * // Wrap JSON.parse
 * const parsed = from(() => JSON.parse('{"key": "value"}'));
 * // parsed: { ok: true, value: { key: "value" } }
 *
 * const error = from(() => JSON.parse('invalid'));
 * // error: { ok: false, error: SyntaxError }
 * ```
 */
export function from<T>(fn: () => T): Result<T, unknown>;
/**
 * Wraps a synchronous throwing function in a Result with custom error mapping.
 *
 * Use this overload when you want to map thrown exceptions to your typed error union.
 *
 * @param fn - The synchronous function to execute (may throw)
 * @param onError - Function to map the thrown exception to a typed error
 * @returns A Result with the function's return value or the mapped error
 *
 * @example
 * ```typescript
 * // Map exceptions to typed errors
 * const parsed = from(
 *   () => JSON.parse(input),
 *   (cause) => ({ type: 'PARSE_ERROR' as const, cause })
 * );
 * // parsed.error: { type: 'PARSE_ERROR', cause: SyntaxError }
 *
 * // Map to simple error codes
 * const value = from(
 *   () => riskyOperation(),
 *   () => 'OPERATION_FAILED' as const
 * );
 * ```
 */
export function from<T, E>(fn: () => T, onError: (cause: unknown) => E): Result<T, E>;
export function from<T, E>(fn: () => T, onError?: (cause: unknown) => E) {
  try {
    return ok(fn());
  } catch (cause) {
    return onError ? err(onError(cause), { cause }) : err(cause);
  }
}

/**
 * Wraps a Promise in a Result, converting rejections to errors.
 *
 * ## When to Use
 *
 * Use `fromPromise()` when:
 * - You have an existing Promise that might reject
 * - You want to convert Promise rejections to typed errors
 * - You're working with libraries that return Promises (fetch, database clients)
 * - You need to handle rejections without .catch() chains
 *
 * ## Why Use This
 *
 * - **Type-safe errors**: Convert Promise rejections to typed Result errors
 * - **Composable**: Results can be chained with `andThen`, `map`, etc.
 * - **Explicit handling**: Forces you to handle errors explicitly
 * - **No .catch() chains**: Cleaner than Promise.catch() patterns
 *
 * @param promise - The Promise to await (may reject)
 * @returns A Promise resolving to a Result with the resolved value or rejection reason
 *
 * @example
 * ```typescript
 * // Wrap fetch
 * const result = await fromPromise(
 *   fetch('/api').then(r => r.json())
 * );
 * // result.ok: true if fetch succeeded, false if rejected
 * ```
 */
export function fromPromise<T>(promise: Promise<T>): AsyncResult<T, unknown>;
/**
 * Wraps a Promise in a Result with custom error mapping.
 *
 * Use this overload when you want to map Promise rejections to your typed error union.
 *
 * @param promise - The Promise to await (may reject)
 * @param onError - Function to map the rejection reason to a typed error
 * @returns A Promise resolving to a Result with the resolved value or mapped error
 *
 * @example
 * ```typescript
 * // Map fetch errors to typed errors
 * const result = await fromPromise(
 *   fetch('/api').then(r => {
 *     if (!r.ok) throw new Error(`HTTP ${r.status}`);
 *     return r.json();
 *   }),
 *   () => 'FETCH_FAILED' as const
 * );
 * // result.error: 'FETCH_FAILED' if fetch failed
 *
 * // Map with error details
 * const data = await fromPromise(
 *   db.query(sql),
 *   (cause) => ({ type: 'DB_ERROR' as const, message: String(cause) })
 * );
 * ```
 */
export function fromPromise<T, E>(
  promise: Promise<T>,
  onError: (cause: unknown) => E
): AsyncResult<T, E>;
export async function fromPromise<T, E>(
  promise: Promise<T>,
  onError?: (cause: unknown) => E
): AsyncResult<T, E | unknown> {
  try {
    return ok(await promise);
  } catch (cause) {
    return onError ? err(onError(cause), { cause }) : err(cause);
  }
}

/**
 * Wraps an async function in a Result, catching both thrown exceptions and Promise rejections.
 *
 * ## When to Use
 *
 * Use `tryAsync()` when:
 * - You have an async function that might throw or reject
 * - You want to convert both exceptions and rejections to typed errors
 * - You're creating new async functions (use `fromPromise` for existing Promises)
 * - You need to handle errors without try/catch or .catch()
 *
 * ## Why Use This Instead of `fromPromise`
 *
 * - **Function form**: Takes a function, not a Promise (lazy evaluation)
 * - **Catches both**: Handles both thrown exceptions and Promise rejections
 * - **Cleaner syntax**: No need to wrap in Promise manually
 *
 * @param fn - The async function to execute (may throw or reject)
 * @returns A Promise resolving to a Result with the function's return value or error
 *
 * @example
 * ```typescript
 * // Wrap async function
 * const result = await tryAsync(async () => {
 *   const data = await fetchData();
 *   return processData(data);
 * });
 * ```
 */
export function tryAsync<T>(fn: () => Promise<T>): AsyncResult<T, unknown>;
/**
 * Wraps an async function in a Result with custom error mapping.
 *
 * Use this overload when you want to map errors to your typed error union.
 *
 * @param fn - The async function to execute (may throw or reject)
 * @param onError - Function to map the error (exception or rejection) to a typed error
 * @returns A Promise resolving to a Result with the function's return value or mapped error
 *
 * @example
 * ```typescript
 * // Map errors to typed errors
 * const result = await tryAsync(
 *   async () => await fetchData(),
 *   () => 'FETCH_ERROR' as const
 * );
 *
 * // Map with error details
 * const data = await tryAsync(
 *   async () => await processFile(path),
 *   (cause) => ({ type: 'PROCESSING_ERROR' as const, cause })
 * );
 * ```
 */
export function tryAsync<T, E>(
  fn: () => Promise<T>,
  onError: (cause: unknown) => E
): AsyncResult<T, E>;
export async function tryAsync<T, E>(
  fn: () => Promise<T>,
  onError?: (cause: unknown) => E
): AsyncResult<T, E | unknown> {
  try {
    return ok(await fn());
  } catch (cause) {
    return onError ? err(onError(cause), { cause }) : err(cause);
  }
}

/**
 * Converts a nullable value to a Result.
 *
 * ## When to Use
 *
 * Use `fromNullable()` when:
 * - You have a value that might be `null` or `undefined`
 * - You want to treat null/undefined as an error case
 * - You're working with APIs that return nullable values (DOM APIs, optional properties)
 * - You want to avoid null checks scattered throughout your code
 *
 * ## Why Use This
 *
 * - **Type-safe**: Converts nullable types to non-nullable Results
 * - **Explicit errors**: Forces you to handle null/undefined cases
 * - **Composable**: Results can be chained with `andThen`, `map`, etc.
 * - **No null checks**: Eliminates need for `if (value == null)` checks
 *
 * @param value - The value that may be null or undefined
 * @param onNull - Function that returns an error when value is null/undefined
 * @returns A Result with the value if not null/undefined, otherwise the error from `onNull`
 *
 * @example
 * ```typescript
 * // Convert DOM element lookup
 * const element = fromNullable(
 *   document.getElementById('app'),
 *   () => 'ELEMENT_NOT_FOUND' as const
 * );
 *
 * // Convert optional property
 * const userId = fromNullable(
 *   user.id,
 *   () => 'USER_ID_MISSING' as const
 * );
 *
 * // Convert database query result
 * const record = fromNullable(
 *   await db.find(id),
 *   () => ({ type: 'NOT_FOUND' as const, id })
 * );
 * ```
 */
export function fromNullable<T, E>(
  value: T | null | undefined,
  onNull: () => E
): Result<T, E> {
  return value != null ? ok(value) : err(onNull());
}

// =============================================================================
// Transformers
// =============================================================================

/**
 * Transforms the success value of a Result.
 *
 * ## When to Use
 *
 * Use `map()` when:
 * - You need to transform a success value to another type
 * - You want to apply a pure function to the value
 * - You're building a pipeline of transformations
 * - The transformation cannot fail (use `andThen` if it can fail)
 *
 * ## Why Use This
 *
 * - **Functional style**: Composable, chainable transformations
 * - **Error-preserving**: Errors pass through unchanged
 * - **Type-safe**: TypeScript tracks the transformation
 * - **No unwrapping**: Avoids manual `if (r.ok)` checks
 *
 * @param r - The Result to transform
 * @param fn - Pure function that transforms the success value (must not throw)
 * @returns A new Result with the transformed value, or the original error if `r` was an error
 *
 * @example
 * ```typescript
 * // Transform numeric value
 * const doubled = map(ok(21), n => n * 2);
 * // doubled: { ok: true, value: 42 }
 *
 * // Transform object property
 * const name = map(fetchUser(id), user => user.name);
 *
 * // Chain transformations
 * const formatted = map(
 *   map(parseNumber(input), n => n * 2),
 *   n => `Result: ${n}`
 * );
 * ```
 */
export function map<T, U, E, C>(
  r: Result<T, E, C>,
  fn: (value: T) => U
): Result<U, E, C> {
  return r.ok ? ok(fn(r.value)) : r;
}

/**
 * Transforms the error value of a Result.
 *
 * ## When to Use
 *
 * Use `mapError()` when:
 * - You need to normalize or transform error types
 * - You want to convert errors to a different error type
 * - You're building error handling pipelines
 * - You need to format error messages or codes
 *
 * ## Why Use This
 *
 * - **Error normalization**: Convert errors to a common format
 * - **Type transformation**: Change error type while preserving value type
 * - **Composable**: Can be chained with other transformers
 * - **Success-preserving**: Success values pass through unchanged
 *
 * @param r - The Result to transform
 * @param fn - Function that transforms the error value (must not throw)
 * @returns A new Result with the original value, or the transformed error if `r` was an error
 *
 * @example
 * ```typescript
 * // Normalize error codes
 * const normalized = mapError(err('not_found'), e => e.toUpperCase());
 * // normalized: { ok: false, error: 'NOT_FOUND' }
 *
 * // Convert error types
 * const typed = mapError(
 *   err('404'),
 *   code => ({ type: 'HTTP_ERROR' as const, status: parseInt(code) })
 * );
 *
 * // Format error messages
 * const formatted = mapError(
 *   err('PARSE_ERROR'),
 *   code => `Failed to parse: ${code}`
 * );
 * ```
 */
export function mapError<T, E, F, C>(
  r: Result<T, E, C>,
  fn: (error: E) => F
): Result<T, F, C> {
  return r.ok ? r : err(fn(r.error), { cause: r.cause });
}

/**
 * Pattern matches on a Result, calling the appropriate handler.
 *
 * ## When to Use
 *
 * Use `match()` when:
 * - You need to handle both success and error cases
 * - You want to transform a Result to a different type
 * - You need exhaustive handling (both cases must be handled)
 * - You're building user-facing messages or responses
 *
 * ## Why Use This
 *
 * - **Exhaustive**: Forces you to handle both success and error cases
 * - **Type-safe**: TypeScript ensures both handlers are provided
 * - **Functional**: Pattern matching style, similar to Rust's `match` or Haskell's `case`
 * - **Single expression**: Can be used in expressions, not just statements
 *
 * @param r - The Result to match
 * @param handlers - Object with `ok` and `err` handler functions
 * @param handlers.ok - Function called with the success value
 * @param handlers.err - Function called with the error and optional cause
 * @returns The return value of the appropriate handler (both must return the same type `R`)
 *
 * @example
 * ```typescript
 * // Build user-facing messages
 * const message = match(result, {
 *   ok: (user) => `Hello ${user.name}`,
 *   err: (error) => `Error: ${error}`,
 * });
 *
 * // Transform to API response
 * const response = match(operation(), {
 *   ok: (data) => ({ status: 200, body: data }),
 *   err: (error) => ({ status: 400, error: String(error) }),
 * });
 *
 * // Handle with cause
 * const response = match(result, {
 *   ok: (value) => ({ status: 'success', data: value }),
 *   err: (error, cause) => ({ status: 'error', error, cause }),
 * });
 * ```
 */
export function match<T, E, C, R>(
  r: Result<T, E, C>,
  handlers: { ok: (value: T) => R; err: (error: E, cause?: C) => R }
): R {
  return r.ok ? handlers.ok(r.value) : handlers.err(r.error, r.cause);
}

/**
 * Chains Results together (flatMap/monadic bind).
 *
 * ## When to Use
 *
 * Use `andThen()` when:
 * - You need to chain operations that can fail
 * - The next operation depends on the previous success value
 * - You're building a pipeline of dependent operations
 * - You want to avoid nested `if (r.ok)` checks
 *
 * ## Why Use This Instead of `map`
 *
 * - **Can fail**: The chained function returns a Result (can fail)
 * - **Short-circuits**: If first Result fails, second operation never runs
 * - **Error accumulation**: Errors from both operations are in the union
 * - **Composable**: Can chain multiple operations together
 *
 * ## Common Pattern
 *
 * This is the fundamental building block for Result pipelines:
 * ```typescript
 * andThen(operation1(), value1 =>
 *   andThen(operation2(value1), value2 =>
 *     ok({ value1, value2 })
 *   )
 * )
 * ```
 *
 * @param r - The first Result
 * @param fn - Function that takes the success value and returns a new Result (may fail)
 * @returns The Result from `fn` if `r` was successful, otherwise the original error
 *
 * @example
 * ```typescript
 * // Chain dependent operations
 * const userPosts = andThen(
 *   fetchUser('1'),
 *   user => fetchPosts(user.id)
 * );
 *
 * // Build complex pipelines
 * const result = andThen(parseInput(input), parsed =>
 *   andThen(validate(parsed), validated =>
 *     process(validated)
 *   )
 * );
 *
 * // Chain with different error types
 * const data = andThen(
 *   fetchUser(id), // Returns Result<User, 'FETCH_ERROR'>
 *   user => fetchPosts(user.id) // Returns Result<Post[], 'NOT_FOUND'>
 * );
 * // data.error: 'FETCH_ERROR' | 'NOT_FOUND'
 * ```
 */
export function andThen<T, U, E, F, C1, C2>(
  r: Result<T, E, C1>,
  fn: (value: T) => Result<U, F, C2>
): Result<U, E | F, C1 | C2> {
  return r.ok ? fn(r.value) : r;
}

/**
 * Executes a side effect on a successful Result without changing it.
 *
 * ## When to Use
 *
 * Use `tap()` when:
 * - You need to log, debug, or observe success values
 * - You want to perform side effects in a pipeline
 * - You need to mutate external state based on success
 * - You're debugging and want to inspect values without breaking the chain
 *
 * ## Why Use This
 *
 * - **Non-breaking**: Doesn't change the Result, just performs side effect
 * - **Composable**: Can be inserted anywhere in a pipeline
 * - **Type-preserving**: Returns the same Result type
 * - **Lazy**: Side effect only runs if Result is successful
 *
 * @param r - The Result to tap
 * @param fn - Side effect function called with the success value (return value ignored)
 * @returns The original Result unchanged (for chaining)
 *
 * @example
 * ```typescript
 * // Log success values
 * const logged = tap(result, user => console.log('Got user:', user.name));
 * // logged === result, but console.log was called
 *
 * // Debug in pipeline
 * const debugged = pipe(
 *   fetchUser(id),
 *   r => tap(r, user => console.log('Fetched:', user)),
 *   r => map(r, user => user.name)
 * );
 *
 * // Mutate external state
 * const tracked = tap(result, data => {
 *   analytics.track('operation_success', data);
 * });
 * ```
 */
export function tap<T, E, C>(
  r: Result<T, E, C>,
  fn: (value: T) => void
): Result<T, E, C> {
  if (r.ok) fn(r.value);
  return r;
}

/**
 * Executes a side effect on an error Result without changing it.
 *
 * ## When to Use
 *
 * Use `tapError()` when:
 * - You need to log, debug, or observe error values
 * - You want to perform side effects on errors in a pipeline
 * - You need to report errors to external systems (logging, monitoring)
 * - You're debugging and want to inspect errors without breaking the chain
 *
 * ## Why Use This
 *
 * - **Non-breaking**: Doesn't change the Result, just performs side effect
 * - **Composable**: Can be inserted anywhere in a pipeline
 * - **Type-preserving**: Returns the same Result type
 * - **Lazy**: Side effect only runs if Result is an error
 *
 * @param r - The Result to tap
 * @param fn - Side effect function called with the error and optional cause (return value ignored)
 * @returns The original Result unchanged (for chaining)
 *
 * @example
 * ```typescript
 * // Log errors
 * const logged = tapError(result, (error, cause) => {
 *   console.error('Error:', error, cause);
 * });
 *
 * // Report to error tracking
 * const tracked = tapError(result, (error, cause) => {
 *   errorTracker.report(error, cause);
 * });
 *
 * // Debug in pipeline
 * const debugged = pipe(
 *   operation(),
 *   r => tapError(r, (err, cause) => console.error('Failed:', err)),
 *   r => mapError(r, err => 'FORMATTED_ERROR')
 * );
 * ```
 */
export function tapError<T, E, C>(
  r: Result<T, E, C>,
  fn: (error: E, cause?: C) => void
): Result<T, E, C> {
  if (!r.ok) fn(r.error, r.cause);
  return r;
}

/**
 * Transforms the success value of a Result, catching any errors thrown by the transform.
 *
 * ## When to Use
 *
 * Use `mapTry()` when:
 * - Your transform function might throw exceptions
 * - You want to convert transform errors to typed errors
 * - You're working with libraries that throw (e.g., JSON.parse, Date parsing)
 * - You need to handle both Result errors and transform exceptions
 *
 * ## Why Use This Instead of `map`
 *
 * - **Exception-safe**: Catches exceptions from the transform function
 * - **Error mapping**: Converts thrown exceptions to typed errors
 * - **Dual error handling**: Handles both Result errors and transform exceptions
 *
 * @param result - The Result to transform
 * @param transform - Function to transform the success value (may throw exceptions)
 * @param onError - Function to map thrown exceptions to a typed error
 * @returns A Result with:
 *   - Transformed value if both Result and transform succeed
 *   - Original error if Result was an error
 *   - Transform error if transform threw an exception
 *
 * @example
 * ```typescript
 * // Safe JSON parsing
 * const parsed = mapTry(
 *   ok('{"key": "value"}'),
 *   JSON.parse,
 *   () => 'PARSE_ERROR' as const
 * );
 *
 * // Safe date parsing
 * const date = mapTry(
 *   ok('2024-01-01'),
 *   str => new Date(str),
 *   () => 'INVALID_DATE' as const
 * );
 *
 * // Transform with error details
 * const processed = mapTry(
 *   result,
 *   value => riskyTransform(value),
 *   (cause) => ({ type: 'TRANSFORM_ERROR' as const, cause })
 * );
 * ```
 */
export function mapTry<T, U, E, F, C>(
  result: Result<T, E, C>,
  transform: (value: T) => U,
  onError: (cause: unknown) => F
): Result<U, E | F, C | unknown> {
  if (!result.ok) return result;
  try {
    return ok(transform(result.value));
  } catch (error) {
    return err(onError(error), { cause: error });
  }
}

/**
 * Transforms the error value of a Result, catching any errors thrown by the transform.
 *
 * ## When to Use
 *
 * Use `mapErrorTry()` when:
 * - Your error transform function might throw exceptions
 * - You're doing complex error transformations (e.g., string formatting, object construction)
 * - You want to handle both Result errors and transform exceptions
 * - You need to safely normalize error types
 *
 * ## Why Use This Instead of `mapError`
 *
 * - **Exception-safe**: Catches exceptions from the error transform function
 * - **Error mapping**: Converts thrown exceptions to typed errors
 * - **Dual error handling**: Handles both Result errors and transform exceptions
 *
 * @param result - The Result to transform
 * @param transform - Function to transform the error value (may throw exceptions)
 * @param onError - Function to map thrown exceptions to a typed error
 * @returns A Result with:
 *   - Original value if Result was successful
 *   - Transformed error if both Result was error and transform succeeded
 *   - Transform error if transform threw an exception
 *
 * @example
 * ```typescript
 * // Safe error formatting
 * const formatted = mapErrorTry(
 *   err('not_found'),
 *   e => e.toUpperCase(), // Might throw if e is not a string
 *   () => 'FORMAT_ERROR' as const
 * );
 *
 * // Complex error transformation
 * const normalized = mapErrorTry(
 *   result,
 *   error => ({ type: 'NORMALIZED', message: String(error) }),
 *   () => 'TRANSFORM_ERROR' as const
 * );
 * ```
 */
export function mapErrorTry<T, E, F, G, C>(
  result: Result<T, E, C>,
  transform: (error: E) => F,
  onError: (cause: unknown) => G
): Result<T, F | G, C | unknown> {
  if (result.ok) return result;
  try {
    return err(transform(result.error), { cause: result.cause });
  } catch (error) {
    return err(onError(error), { cause: error });
  }
}

// =============================================================================
// Batch Operations
// =============================================================================

type AllValues<T extends readonly Result<unknown, unknown, unknown>[]> = {
  [K in keyof T]: T[K] extends Result<infer V, unknown, unknown> ? V : never;
};
type AllErrors<T extends readonly Result<unknown, unknown, unknown>[]> = {
  [K in keyof T]: T[K] extends Result<unknown, infer E, unknown> ? E : never;
}[number];
type AllCauses<T extends readonly Result<unknown, unknown, unknown>[]> = {
  [K in keyof T]: T[K] extends Result<unknown, unknown, infer C> ? C : never;
}[number];

/**
 * Combines multiple Results into one, requiring all to succeed.
 *
 * ## When to Use
 *
 * Use `all()` when:
 * - You have multiple independent operations that all must succeed
 * - You want to short-circuit on the first error (fail-fast)
 * - You need all values together (e.g., combining API responses)
 * - Performance matters (stops on first error, doesn't wait for all)
 *
 * ## Why Use This
 *
 * - **Fail-fast**: Stops immediately on first error (better performance)
 * - **Type-safe**: TypeScript infers the array type from input
 * - **Short-circuit**: Doesn't evaluate remaining Results after error
 * - **Composable**: Can be chained with other operations
 *
 * ## Important
 *
 * - **Short-circuits**: Returns first error immediately, doesn't wait for all Results
 * - **All must succeed**: If any Result fails, the entire operation fails
 * - **Use `allSettled`**: If you need to collect all errors (e.g., form validation)
 *
 * @param results - Array of Results to combine (all must succeed)
 * @returns A Result with an array of all success values, or the first error encountered
 *
 * @example
 * ```typescript
 * // Combine multiple successful Results
 * const combined = all([ok(1), ok(2), ok(3)]);
 * // combined: { ok: true, value: [1, 2, 3] }
 *
 * // Short-circuits on first error
 * const error = all([ok(1), err('ERROR'), ok(3)]);
 * // error: { ok: false, error: 'ERROR' }
 * // Note: ok(3) is never evaluated
 *
 * // Combine API responses
 * const data = all([
 *   fetchUser(id),
 *   fetchPosts(id),
 *   fetchComments(id)
 * ]);
 * // data.value: [user, posts, comments] if all succeed
 * ```
 */
export function all<const T extends readonly Result<unknown, unknown, unknown>[]>(
  results: T
): Result<AllValues<T>, AllErrors<T>, AllCauses<T>> {
  const values: unknown[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result as unknown as Result<AllValues<T>, AllErrors<T>, AllCauses<T>>;
    }
    values.push(result.value);
  }
  return ok(values) as Result<AllValues<T>, AllErrors<T>, AllCauses<T>>;
}

/**
 * Combines multiple Results or Promises of Results into one (async version of `all`).
 *
 * ## When to Use
 *
 * Use `allAsync()` when:
 * - You have multiple async operations that all must succeed
 * - You want to run operations in parallel (better performance)
 * - You want to short-circuit on the first error (fail-fast)
 * - You need all values together from parallel operations
 *
 * ## Why Use This Instead of `all`
 *
 * - **Parallel execution**: All Promises start immediately (faster)
 * - **Async support**: Works with Promises and AsyncResults
 * - **Promise rejection handling**: Converts Promise rejections to `PromiseRejectedError`
 *
 * ## Important
 *
 * - **Short-circuits**: Returns first error immediately, cancels remaining operations
 * - **Parallel**: All operations start simultaneously (unlike sequential `andThen`)
 * - **Use `allSettledAsync`**: If you need to collect all errors
 *
 * @param results - Array of Results or Promises of Results to combine (all must succeed)
 * @returns A Promise resolving to a Result with an array of all success values, or the first error
 *
 * @example
 * ```typescript
 * // Parallel API calls
 * const combined = await allAsync([
 *   fetchUser('1'),
 *   fetchPosts('1'),
 *   fetchComments('1')
 * ]);
 * // All three calls start simultaneously
 * // combined: { ok: true, value: [user, posts, comments] } if all succeed
 *
 * // Mix Results and Promises
 * const data = await allAsync([
 *   ok(cachedUser), // Already resolved
 *   fetchPosts(userId), // Promise
 * ]);
 * ```
 */
export async function allAsync<
  const T extends readonly (Result<unknown, unknown, unknown> | Promise<Result<unknown, unknown, unknown>>)[]
>(
  results: T
): Promise<
  Result<
    { [K in keyof T]: T[K] extends Result<infer V, unknown, unknown> | Promise<Result<infer V, unknown, unknown>> ? V : never },
    { [K in keyof T]: T[K] extends Result<unknown, infer E, unknown> | Promise<Result<unknown, infer E, unknown>> ? E : never }[number] | PromiseRejectedError,
    { [K in keyof T]: T[K] extends Result<unknown, unknown, infer C> | Promise<Result<unknown, unknown, infer C>> ? C : never }[number] | PromiseRejectionCause
  >
> {
  type Values = { [K in keyof T]: T[K] extends Result<infer V, unknown, unknown> | Promise<Result<infer V, unknown, unknown>> ? V : never };
  type Errors = { [K in keyof T]: T[K] extends Result<unknown, infer E, unknown> | Promise<Result<unknown, infer E, unknown>> ? E : never }[number] | PromiseRejectedError;
  type Causes = { [K in keyof T]: T[K] extends Result<unknown, unknown, infer C> | Promise<Result<unknown, unknown, infer C>> ? C : never }[number] | PromiseRejectionCause;

  if (results.length === 0) {
    return ok([]) as Result<Values, Errors, Causes>;
  }

  return new Promise((resolve) => {
    let settled = false;
    let pendingCount = results.length;
    const values: unknown[] = new Array(results.length);

    for (let i = 0; i < results.length; i++) {
      const index = i;
      Promise.resolve(results[index])
        .catch((reason) => err(
          { type: "PROMISE_REJECTED" as const, cause: reason },
          { cause: { type: "PROMISE_REJECTION" as const, reason } as PromiseRejectionCause }
        ))
        .then((result) => {
          if (settled) return;

          if (!result.ok) {
            settled = true;
            resolve(result as Result<Values, Errors, Causes>);
            return;
          }

          values[index] = result.value;
          pendingCount--;

          if (pendingCount === 0) {
            resolve(ok(values) as Result<Values, Errors, Causes>);
          }
        });
    }
  });
}

export type SettledError<E, C = unknown> = { error: E; cause?: C };

type AllSettledResult<T extends readonly Result<unknown, unknown, unknown>[]> = Result<
  AllValues<T>,
  SettledError<AllErrors<T>, AllCauses<T>>[]
>;

/**
 * Combines multiple Results, collecting all errors instead of short-circuiting.
 *
 * ## When to Use
 *
 * Use `allSettled()` when:
 * - You need to see ALL errors, not just the first one
 * - You're doing form validation (show all field errors)
 * - You want to collect partial results (some succeed, some fail)
 * - You need to process all Results regardless of failures
 *
 * ## Why Use This Instead of `all`
 *
 * - **Collects all errors**: Returns array of all errors, not just first
 * - **No short-circuit**: Evaluates all Results even if some fail
 * - **Partial success**: Can see which operations succeeded and which failed
 * - **Better UX**: Show users all validation errors at once
 *
 * ## Important
 *
 * - **No short-circuit**: All Results are evaluated (slower if many fail early)
 * - **Error array**: Returns array of `{ error, cause }` objects, not single error
 * - **Use `all`**: If you want fail-fast behavior (better performance)
 *
 * @param results - Array of Results to combine (all are evaluated)
 * @returns A Result with:
 *   - Array of all success values if all succeed
 *   - Array of `{ error, cause }` objects if any fail
 *
 * @example
 * ```typescript
 * // Form validation - show all errors
 * const validated = allSettled([
 *   validateEmail(email),
 *   validatePassword(password),
 *   validateAge(age),
 * ]);
 * // If email and password fail:
 * // { ok: false, error: [
 * //   { error: 'INVALID_EMAIL' },
 * //   { error: 'WEAK_PASSWORD' }
 * // ]}
 *
 * // Collect partial results
 * const results = allSettled([
 *   fetchUser('1'), // succeeds
 *   fetchUser('2'), // fails
 *   fetchUser('3'), // succeeds
 * ]);
 * // Can see which succeeded and which failed
 * ```
 */
export function allSettled<const T extends readonly Result<unknown, unknown, unknown>[]>(
  results: T
): AllSettledResult<T> {
  const values: unknown[] = [];
  const errors: SettledError<unknown>[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push({ error: result.error, cause: result.cause });
    }
  }

  if (errors.length > 0) {
    return err(errors) as unknown as AllSettledResult<T>;
  }

  return ok(values) as unknown as AllSettledResult<T>;
}

/**
 * Splits an array of Results into separate arrays of success values and errors.
 *
 * ## When to Use
 *
 * Use `partition()` when:
 * - You have an array of Results and need to separate successes from failures
 * - You want to process successes and errors separately
 * - You're collecting results from multiple operations (some may fail)
 * - You need to handle partial success scenarios
 *
 * ## Why Use This
 *
 * - **Simple separation**: One call splits successes and errors
 * - **Type-safe**: TypeScript knows `values` is `T[]` and `errors` is `E[]`
 * - **No unwrapping**: Doesn't require manual `if (r.ok)` checks
 * - **Preserves order**: Maintains original array order in both arrays
 *
 * ## Common Pattern
 *
 * Often used after `Promise.all()` with Results:
 * ```typescript
 * const results = await Promise.all(ids.map(id => fetchUser(id)));
 * const { values: users, errors } = partition(results);
 * // Process successful users, handle errors separately
 * ```
 *
 * @param results - Array of Results to partition
 * @returns An object with:
 *   - `values`: Array of all success values (type `T[]`)
 *   - `errors`: Array of all error values (type `E[]`)
 *
 * @example
 * ```typescript
 * // Split successes and errors
 * const results = [ok(1), err('ERROR_1'), ok(3), err('ERROR_2')];
 * const { values, errors } = partition(results);
 * // values: [1, 3]
 * // errors: ['ERROR_1', 'ERROR_2']
 *
 * // Process batch operations
 * const userResults = await Promise.all(userIds.map(id => fetchUser(id)));
 * const { values: users, errors: fetchErrors } = partition(userResults);
 *
 * // Process successful users
 * users.forEach(user => processUser(user));
 *
 * // Handle errors
 * fetchErrors.forEach(error => logError(error));
 * ```
 */
export function partition<T, E, C>(
  results: readonly Result<T, E, C>[]
): { values: T[]; errors: E[] } {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return { values, errors };
}

type AnyValue<T extends readonly Result<unknown, unknown, unknown>[]> =
  T[number] extends Result<infer U, unknown, unknown> ? U : never;
type AnyErrors<T extends readonly Result<unknown, unknown, unknown>[]> = {
  -readonly [K in keyof T]: T[K] extends Result<unknown, infer E, unknown> ? E : never;
}[number];
type AnyCauses<T extends readonly Result<unknown, unknown, unknown>[]> = {
  -readonly [K in keyof T]: T[K] extends Result<unknown, unknown, infer C> ? C : never;
}[number];

/**
 * Returns the first successful Result from an array (succeeds fast).
 *
 * ## When to Use
 *
 * Use `any()` when:
 * - You have multiple fallback options and need the first that succeeds
 * - You're trying multiple strategies (e.g., cache → DB → API)
 * - You want fail-fast success (stops on first success)
 * - You have redundant data sources and any one will do
 *
 * ## Why Use This
 *
 * - **Succeeds fast**: Returns immediately on first success (better performance)
 * - **Fallback pattern**: Perfect for trying multiple options
 * - **Short-circuits**: Stops evaluating after first success
 * - **Type-safe**: TypeScript infers the success type
 *
 * ## Important
 *
 * - **First success wins**: Returns first successful Result, ignores rest
 * - **All errors**: If all fail, returns first error (not all errors)
 * - **Empty array**: Returns `EmptyInputError` if array is empty
 * - **Use `all`**: If you need ALL to succeed
 *
 * @param results - Array of Results to check (evaluated in order)
 * @returns The first successful Result, or first error if all fail, or `EmptyInputError` if empty
 *
 * @example
 * ```typescript
 * // Try multiple fallback strategies
 * const data = any([
 *   fetchFromCache(id),
 *   fetchFromDB(id),
 *   fetchFromAPI(id)
 * ]);
 * // Returns first that succeeds
 *
 * // Try multiple formats
 * const parsed = any([
 *   parseJSON(input),
 *   parseXML(input),
 *   parseYAML(input)
 * ]);
 *
 * // All errors case
 * const allErrors = any([err('A'), err('B'), err('C')]);
 * // allErrors: { ok: false, error: 'A' } (first error)
 * ```
 */
export function any<const T extends readonly Result<unknown, unknown, unknown>[]>(
  results: T
): Result<AnyValue<T>, AnyErrors<T> | EmptyInputError, AnyCauses<T>> {
  type ReturnErr = Result<never, AnyErrors<T> | EmptyInputError, AnyCauses<T>>;
  type ReturnOk = Result<AnyValue<T>, never, AnyCauses<T>>;

  if (results.length === 0) {
    return err({
      type: "EMPTY_INPUT",
      message: "any() requires at least one Result",
    }) as ReturnErr;
  }
  let firstError: Result<never, unknown, unknown> | null = null;
  for (const result of results) {
    if (result.ok) return result as ReturnOk;
    if (!firstError) firstError = result;
  }
  return firstError as ReturnErr;
}

type AnyAsyncValue<T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[]> =
  Awaited<T[number]> extends Result<infer U, unknown, unknown> ? U : never;
type AnyAsyncErrors<T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[]> = {
  -readonly [K in keyof T]: Awaited<T[K]> extends Result<unknown, infer E, unknown>
    ? E
    : never;
}[number];
type AnyAsyncCauses<T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[]> = {
  -readonly [K in keyof T]: Awaited<T[K]> extends Result<unknown, unknown, infer C>
    ? C
    : never;
}[number];

/**
 * Returns the first successful Result from an array of Results or Promises (async version of `any`).
 *
 * ## When to Use
 *
 * Use `anyAsync()` when:
 * - You have multiple async fallback options and need the first that succeeds
 * - You're trying multiple async strategies in parallel (cache → DB → API)
 * - You want fail-fast success from parallel operations
 * - You have redundant async data sources and any one will do
 *
 * ## Why Use This Instead of `any`
 *
 * - **Parallel execution**: All Promises start immediately (faster)
 * - **Async support**: Works with Promises and AsyncResults
 * - **Promise rejection handling**: Converts Promise rejections to `PromiseRejectedError`
 *
 * ## Important
 *
 * - **First success wins**: Returns first successful Result (from any Promise)
 * - **Parallel**: All operations run simultaneously
 * - **All errors**: If all fail, returns first error encountered
 *
 * @param results - Array of Results or Promises of Results to check (all start in parallel)
 * @returns A Promise resolving to the first successful Result, or first error if all fail
 *
 * @example
 * ```typescript
 * // Try multiple async fallbacks in parallel
 * const data = await anyAsync([
 *   fetchFromCache(id), // Fastest wins
 *   fetchFromDB(id),
 *   fetchFromAPI(id)
 * ]);
 *
 * // Try multiple API endpoints
 * const response = await anyAsync([
 *   fetch('/api/v1/data'),
 *   fetch('/api/v2/data'),
 *   fetch('/backup-api/data')
 * ]);
 * ```
 */
export async function anyAsync<
  const T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[],
>(
  results: T
): Promise<
  Result<AnyAsyncValue<T>, AnyAsyncErrors<T> | EmptyInputError | PromiseRejectedError, AnyAsyncCauses<T> | PromiseRejectionCause>
> {
  type ReturnErr = Result<
    never,
    AnyAsyncErrors<T> | EmptyInputError | PromiseRejectedError,
    AnyAsyncCauses<T> | PromiseRejectionCause
  >;
  type ReturnOk = Result<AnyAsyncValue<T>, never, AnyAsyncCauses<T>>;

  if (results.length === 0) {
    return err({
      type: "EMPTY_INPUT",
      message: "anyAsync() requires at least one Result",
    }) as ReturnErr;
  }

  return new Promise((resolve) => {
    let settled = false;
    let pendingCount = results.length;
    let firstError: Result<never, unknown, unknown> | null = null;

    for (const item of results) {
      Promise.resolve(item)
        .catch((reason) =>
          err(
            { type: "PROMISE_REJECTED" as const, cause: reason },
            { cause: { type: "PROMISE_REJECTION" as const, reason } as PromiseRejectionCause }
          )
        )
        .then((result) => {
          if (settled) return;

          if (result.ok) {
            settled = true;
            resolve(result as ReturnOk);
            return;
          }

          if (!firstError) firstError = result;
          pendingCount--;

          if (pendingCount === 0) {
            resolve(firstError as ReturnErr);
          }
        });
    }
  });
}

type AllAsyncValues<T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[]> = {
  [K in keyof T]: Awaited<T[K]> extends Result<infer V, unknown, unknown> ? V : never;
};
type AllAsyncErrors<T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[]> = {
  [K in keyof T]: Awaited<T[K]> extends Result<unknown, infer E, unknown> ? E : never;
}[number];
type AllAsyncCauses<T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[]> = {
  [K in keyof T]: Awaited<T[K]> extends Result<unknown, unknown, infer C> ? C : never;
}[number];

/**
 * Combines multiple Results or Promises of Results, collecting all errors (async version of `allSettled`).
 *
 * ## When to Use
 *
 * Use `allSettledAsync()` when:
 * - You have multiple async operations and need ALL errors
 * - You're doing async form validation (show all field errors)
 * - You want to run operations in parallel and collect all results
 * - You need partial results from parallel operations
 *
 * ## Why Use This Instead of `allSettled`
 *
 * - **Parallel execution**: All Promises start immediately (faster)
 * - **Async support**: Works with Promises and AsyncResults
 * - **Promise rejection handling**: Converts Promise rejections to `PromiseRejectedError`
 *
 * ## Important
 *
 * - **No short-circuit**: All operations complete (even if some fail)
 * - **Parallel**: All operations run simultaneously
 * - **Error array**: Returns array of `{ error, cause }` objects
 *
 * @param results - Array of Results or Promises of Results to combine (all are evaluated)
 * @returns A Promise resolving to a Result with:
 *   - Array of all success values if all succeed
 *   - Array of `{ error, cause }` objects if any fail
 *
 * @example
 * ```typescript
 * // Async form validation
 * const validated = await allSettledAsync([
 *   validateEmailAsync(email),
 *   validatePasswordAsync(password),
 *   checkUsernameAvailableAsync(username),
 * ]);
 *
 * // Parallel API calls with error collection
 * const results = await allSettledAsync([
 *   fetchUser('1'),
 *   fetchUser('2'),
 *   fetchUser('3'),
 * ]);
 * // Can see which succeeded and which failed
 * ```
 */
export async function allSettledAsync<
  const T extends readonly MaybeAsyncResult<unknown, unknown, unknown>[],
>(
  results: T
): Promise<Result<AllAsyncValues<T>, SettledError<AllAsyncErrors<T> | PromiseRejectedError, AllAsyncCauses<T> | PromiseRejectionCause>[]>> {
  const settled = await Promise.all(
    results.map((item) =>
      Promise.resolve(item)
        .then((result) => ({ status: "result" as const, result }))
        .catch((reason) => ({
          status: "rejected" as const,
          error: { type: "PROMISE_REJECTED" as const, cause: reason } as PromiseRejectedError,
          cause: { type: "PROMISE_REJECTION" as const, reason } as PromiseRejectionCause,
        }))
    )
  );

  const values: unknown[] = [];
  const errors: SettledError<unknown, unknown>[] = [];

  for (const item of settled) {
    if (item.status === "rejected") {
      errors.push({ error: item.error, cause: item.cause });
    } else if (item.result.ok) {
      values.push(item.result.value);
    } else {
      errors.push({ error: item.result.error, cause: item.result.cause });
    }
  }

  if (errors.length > 0) {
    return err(errors) as unknown as Result<AllAsyncValues<T>, SettledError<AllAsyncErrors<T> | PromiseRejectedError, AllAsyncCauses<T> | PromiseRejectionCause>[]>;
  }
  return ok(values) as unknown as Result<AllAsyncValues<T>, SettledError<AllAsyncErrors<T> | PromiseRejectedError, AllAsyncCauses<T> | PromiseRejectionCause>[]>;
}
