/**
 * @jagreehal/workflow/conditional
 *
 * Conditional step execution helpers for workflows.
 * These helpers allow you to conditionally execute steps based on runtime conditions,
 * with proper event emission for skipped steps.
 */

import type { WorkflowEvent } from "./core";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for conditional execution.
 */
export type ConditionalOptions = {
  /**
   * Human-readable name for the conditional step.
   * Used in step_skipped events for debugging and visualization.
   */
  name?: string;

  /**
   * Stable identity key for the conditional step.
   * Used in step_skipped events for tracking and visualization.
   */
  key?: string;

  /**
   * Optional reason explaining why the step was skipped.
   * Included in step_skipped events.
   */
  reason?: string;
};

/**
 * Context for conditional execution, used to emit events.
 */
export type ConditionalContext = {
  /**
   * The workflow ID for event emission.
   */
  workflowId: string;

  /**
   * Event emitter function.
   */
  onEvent?: (event: WorkflowEvent<unknown>) => void;
};

/**
 * Type for operations that can be either sync or async.
 */
type MaybeAsync<T> = T | Promise<T>;

/**
 * Type for the operation function passed to conditional helpers.
 */
type Operation<T> = () => MaybeAsync<T>;

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Generate a unique decision ID for tracking conditional decisions.
 * @internal
 */
function generateDecisionId(): string {
  return `decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Emit a step_skipped event.
 * @internal
 */
function emitSkipped(
  ctx: ConditionalContext | undefined,
  options: ConditionalOptions | undefined,
  decisionId: string
): void {
  if (!ctx?.onEvent) return;

  ctx.onEvent({
    type: "step_skipped",
    workflowId: ctx.workflowId,
    stepKey: options?.key,
    name: options?.name,
    reason: options?.reason,
    decisionId,
    ts: Date.now(),
  });
}

// =============================================================================
// Conditional Helpers
// =============================================================================

/**
 * Run a step only if condition is true, return undefined if skipped.
 *
 * Use this when you want to conditionally execute a step and handle
 * the undefined case yourself. For a version with a default value,
 * use `whenOr`.
 *
 * @param condition - Boolean condition to evaluate
 * @param operation - Function that performs the step (only called if condition is true)
 * @param options - Optional configuration for the conditional step
 * @param ctx - Optional context for event emission
 * @returns The result of the operation if condition is true, undefined otherwise
 *
 * @example
 * ```typescript
 * const result = await workflow(async (step) => {
 *   const user = await step(fetchUser(id));
 *
 *   // Only runs if user is premium
 *   const premium = await when(
 *     user.isPremium,
 *     () => step(() => fetchPremiumData(user.id), { name: 'premium-data' }),
 *     { name: 'check-premium', reason: 'User is not premium' }
 *   );
 *
 *   return { user, premium };
 * });
 * ```
 */
export function when<T>(
  condition: boolean,
  operation: Operation<T>,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): Promise<T | undefined>;

/**
 * Synchronous overload for when the operation returns a non-Promise value.
 */
export function when<T>(
  condition: boolean,
  operation: () => T,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): T | undefined | Promise<T | undefined>;

export function when<T>(
  condition: boolean,
  operation: Operation<T>,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): MaybeAsync<T | undefined> {
  if (condition) {
    return operation();
  }

  const decisionId = generateDecisionId();
  emitSkipped(ctx, options, decisionId);
  return undefined;
}

/**
 * Run a step only if condition is false, return undefined if skipped.
 *
 * Use this when you want to conditionally execute a step when a condition
 * is NOT met. For a version with a default value, use `unlessOr`.
 *
 * @param condition - Boolean condition to evaluate
 * @param operation - Function that performs the step (only called if condition is false)
 * @param options - Optional configuration for the conditional step
 * @param ctx - Optional context for event emission
 * @returns The result of the operation if condition is false, undefined otherwise
 *
 * @example
 * ```typescript
 * const result = await workflow(async (step) => {
 *   const user = await step(fetchUser(id));
 *
 *   // Only runs if user is NOT verified
 *   const verification = await unless(
 *     user.isVerified,
 *     () => step(() => sendVerificationEmail(user.email), { name: 'send-verification' }),
 *     { name: 'check-verification', reason: 'User is already verified' }
 *   );
 *
 *   return { user, verification };
 * });
 * ```
 */
export function unless<T>(
  condition: boolean,
  operation: Operation<T>,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): Promise<T | undefined>;

/**
 * Synchronous overload for unless when the operation returns a non-Promise value.
 */
export function unless<T>(
  condition: boolean,
  operation: () => T,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): T | undefined | Promise<T | undefined>;

export function unless<T>(
  condition: boolean,
  operation: Operation<T>,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): MaybeAsync<T | undefined> {
  return when(!condition, operation, options, ctx);
}

/**
 * Run a step only if condition is true, return default value if skipped.
 *
 * Use this when you want to conditionally execute a step and provide
 * a fallback value when the condition is not met.
 *
 * @param condition - Boolean condition to evaluate
 * @param operation - Function that performs the step (only called if condition is true)
 * @param defaultValue - Value to return if condition is false
 * @param options - Optional configuration for the conditional step
 * @param ctx - Optional context for event emission
 * @returns The result of the operation if condition is true, defaultValue otherwise
 *
 * @example
 * ```typescript
 * const result = await workflow(async (step) => {
 *   const user = await step(fetchUser(id));
 *
 *   // Get premium limits or use default for non-premium users
 *   const limits = await whenOr(
 *     user.isPremium,
 *     () => step(() => fetchPremiumLimits(user.id), { name: 'premium-limits' }),
 *     { maxRequests: 100, maxStorage: 1000 }, // default for non-premium
 *     { name: 'check-premium-limits', reason: 'Using default limits for non-premium user' }
 *   );
 *
 *   return { user, limits };
 * });
 * ```
 */
export function whenOr<T, D>(
  condition: boolean,
  operation: Operation<T>,
  defaultValue: D,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): Promise<T | D>;

/**
 * Synchronous overload for whenOr when the operation returns a non-Promise value.
 */
export function whenOr<T, D>(
  condition: boolean,
  operation: () => T,
  defaultValue: D,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): T | D | Promise<T | D>;

export function whenOr<T, D>(
  condition: boolean,
  operation: Operation<T>,
  defaultValue: D,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): MaybeAsync<T | D> {
  if (condition) {
    return operation();
  }

  const decisionId = generateDecisionId();
  emitSkipped(ctx, options, decisionId);
  return defaultValue;
}

/**
 * Run a step only if condition is false, return default value if skipped.
 *
 * Use this when you want to conditionally execute a step when a condition
 * is NOT met, with a fallback value for when the condition is true.
 *
 * @param condition - Boolean condition to evaluate
 * @param operation - Function that performs the step (only called if condition is false)
 * @param defaultValue - Value to return if condition is true
 * @param options - Optional configuration for the conditional step
 * @param ctx - Optional context for event emission
 * @returns The result of the operation if condition is false, defaultValue otherwise
 *
 * @example
 * ```typescript
 * const result = await workflow(async (step) => {
 *   const user = await step(fetchUser(id));
 *
 *   // Generate new token if user is NOT authenticated, otherwise use existing
 *   const token = await unlessOr(
 *     user.isAuthenticated,
 *     () => step(() => generateNewToken(user.id), { name: 'generate-token' }),
 *     user.existingToken, // use existing token if authenticated
 *     { name: 'check-auth-for-token', reason: 'Using existing token for authenticated user' }
 *   );
 *
 *   return { user, token };
 * });
 * ```
 */
export function unlessOr<T, D>(
  condition: boolean,
  operation: Operation<T>,
  defaultValue: D,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): Promise<T | D>;

/**
 * Synchronous overload for unlessOr when the operation returns a non-Promise value.
 */
export function unlessOr<T, D>(
  condition: boolean,
  operation: () => T,
  defaultValue: D,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): T | D | Promise<T | D>;

export function unlessOr<T, D>(
  condition: boolean,
  operation: Operation<T>,
  defaultValue: D,
  options?: ConditionalOptions,
  ctx?: ConditionalContext
): MaybeAsync<T | D> {
  return whenOr(!condition, operation, defaultValue, options, ctx);
}

// =============================================================================
// Factory Functions for Workflow Integration
// =============================================================================

/**
 * Create a set of conditional helpers bound to a workflow context.
 *
 * Use this factory when you want to automatically emit step_skipped events
 * to the workflow's event stream without passing context manually.
 *
 * @param ctx - The workflow context containing workflowId and onEvent
 * @returns Object with bound when, unless, whenOr, and unlessOr functions
 *
 * @example
 * ```typescript
 * const result = await run(async (step) => {
 *   const ctx = { workflowId, onEvent };
 *   const { when, whenOr } = createConditionalHelpers(ctx);
 *
 *   const user = await step(fetchUser(id));
 *
 *   const premium = await when(
 *     user.isPremium,
 *     () => step(() => fetchPremiumData(user.id)),
 *     { name: 'premium-data' }
 *   );
 *
 *   return { user, premium };
 * }, { onEvent, workflowId });
 * ```
 */
export function createConditionalHelpers(ctx: ConditionalContext) {
  return {
    /**
     * Run a step only if condition is true, return undefined if skipped.
     */
    when: <T>(
      condition: boolean,
      operation: Operation<T>,
      options?: ConditionalOptions
    ): MaybeAsync<T | undefined> => when(condition, operation, options, ctx),

    /**
     * Run a step only if condition is false, return undefined if skipped.
     */
    unless: <T>(
      condition: boolean,
      operation: Operation<T>,
      options?: ConditionalOptions
    ): MaybeAsync<T | undefined> => unless(condition, operation, options, ctx),

    /**
     * Run a step only if condition is true, return default value if skipped.
     */
    whenOr: <T, D>(
      condition: boolean,
      operation: Operation<T>,
      defaultValue: D,
      options?: ConditionalOptions
    ): MaybeAsync<T | D> => whenOr(condition, operation, defaultValue, options, ctx),

    /**
     * Run a step only if condition is false, return default value if skipped.
     */
    unlessOr: <T, D>(
      condition: boolean,
      operation: Operation<T>,
      defaultValue: D,
      options?: ConditionalOptions
    ): MaybeAsync<T | D> => unlessOr(condition, operation, defaultValue, options, ctx),
  };
}
