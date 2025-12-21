/**
 * @jreehal/workflow
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
 * - `@jreehal/workflow/core` - Result primitives and `run()` (smallest bundle)
 * - `@jreehal/workflow/workflow` - `createWorkflow` and workflow features
 * - `@jreehal/workflow` - Everything (convenient, but larger bundle)
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createWorkflow, ok, err, type AsyncResult } from '@jreehal/workflow';
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
  type RunOptions,
  type RunOptionsWithCatch,
  type RunOptionsWithoutCatch,

  // Constructors
  ok,
  err,

  // Type guards
  isOk,
  isErr,
  isUnexpectedError,

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
} from "./core";

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
