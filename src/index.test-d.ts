/**
 * Type tests for @jagreehal/workflow
 * Run with: pnpm tsd
 *
 * REALITY CHECK: TypeScript cannot infer error types from inside callback bodies.
 * These tests define REALISTIC expected behavior based on TypeScript's capabilities.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expectType } from "tsd";
import {
  run,
  ok,
  err,
  Result,
  AsyncResult,
  UnexpectedError,
  Errors,
  ErrorOf,
  createWorkflow,
  ErrorsOfDeps,
} from "./index";

// =============================================================================
// TEST HELPERS
// =============================================================================

type User = { id: string; name: string };
type Post = { id: number; title: string };

declare const fetchUser: (id: string) => AsyncResult<User, "NOT_FOUND">;
declare const fetchPosts: (userId: string) => AsyncResult<Post[], "FETCH_ERROR">;
declare const validateUser: (user: User) => Result<User, "INVALID_USER">;

// =============================================================================
// TEST 1: run() with onError includes UnexpectedError (sound behavior)
// For a closed union, use run.strict() with catchUnexpected
// =============================================================================


async function _test1() {
  type AppError = "NOT_FOUND" | "FETCH_ERROR";

  const result = await run<{ user: User; posts: Post[] }, AppError>(
    async (step) => {
      const user = await step(() => fetchUser("123"));
      const posts = await step(() => fetchPosts(user.id));
      return { user, posts };
    },
    {
      onError: (error) => console.log(error),
    }
  );

  if (!result.ok) {
    // Error type includes UnexpectedError because exceptions are always possible
    expectType<AppError | UnexpectedError>(result.error);
  }
}

// =============================================================================
// TEST 2: run() with catchUnexpected - error union must include step errors
// =============================================================================

async function _test2() {
  // When using catchUnexpected, error type includes step errors + catchUnexpected return
  // The step errors flow through; catchUnexpected only handles unexpected exceptions
  type AppError = ErrorOf<typeof fetchUser> | "UNEXPECTED";
  // AppError = "NOT_FOUND" | "UNEXPECTED"

  const result = await run<User, AppError>(
    async (step) => {
      const user = await step(() => fetchUser("123"));
      return user;
    },
    {
      catchUnexpected: () => "UNEXPECTED" as const,
    }
  );

  if (!result.ok) {
    // Error type is AppError - includes step errors and catchUnexpected return type
    expectType<AppError>(result.error);
  }
}

// =============================================================================
// TEST 3: Errors<[...]> utility - Extract error types from functions
// =============================================================================

 
function _test3() {
  // Single function
  type UserError = ErrorOf<typeof fetchUser>;
  expectType<"NOT_FOUND">({} as UserError);

  // Multiple functions
  type CombinedErrors = Errors<[typeof fetchUser, typeof fetchPosts]>;
  expectType<"NOT_FOUND" | "FETCH_ERROR">({} as CombinedErrors);

  // With sync function
  type AllErrors = Errors<
    [typeof fetchUser, typeof fetchPosts, typeof validateUser]
  >;
  expectType<"NOT_FOUND" | "FETCH_ERROR" | "INVALID_USER">({} as AllErrors);
}

// =============================================================================
// TEST 4: step() unwraps value correctly
// =============================================================================

 
async function _test4() {
  type AppError = "NOT_FOUND" | "FETCH_ERROR";

  const result = await run<{ user: User; posts: Post[] }, AppError>(
    async (step) => {
      const user = await step(() => fetchUser("123"));
      // user should be User, not Result<User, ...>
      expectType<User>(user);

      const posts = await step(() => fetchPosts(user.id));
      expectType<Post[]>(posts);

      return { user, posts };
    },
    { onError: () => {} }
  );

  if (result.ok) {
    expectType<{ user: User; posts: Post[] }>(result.value);
  }
}

// =============================================================================
// TEST 5: step.try() unwraps value correctly
// =============================================================================

 
async function _test5() {
  type AppError = "NETWORK" | "PARSE";

  const result = await run<Response, AppError>(
    async (step) => {
      const response = await step.try(() => fetch("/api"), {
        error: "NETWORK" as const,
      });
      // response should be Response, not wrapped
      expectType<Response>(response);

      return response;
    },
    { onError: () => {} }
  );

  if (result.ok) {
    expectType<Response>(result.value);
  }
}

// =============================================================================
// TEST 6: ok() and err() basic types
// =============================================================================

 
function _test6() {
  const success = ok(42);
  expectType<Result<number, never, never>>(success);
  if (success.ok) {
    expectType<number>(success.value);
  }

  const failure = err("NOT_FOUND" as const);
  expectType<Result<never, "NOT_FOUND", unknown>>(failure);
  if (!failure.ok) {
    expectType<"NOT_FOUND">(failure.error);
  }

  // With cause - now typed!
  const withCause = err("ERROR" as const, { cause: new Error("original") });
  expectType<Result<never, "ERROR", Error>>(withCause);
  if (!withCause.ok) {
    // Cause is now typed as Error | undefined (not unknown)
    expectType<Error | undefined>(withCause.cause);
    // Can access Error properties without instanceof check
    withCause.cause?.message;
    withCause.cause?.stack;
  }
}

// =============================================================================
// TEST 7: run() with no explicit types - error type is UnexpectedError
// Safe default for simple usage
// =============================================================================

async function _test7() {
  const result = await run(async () => {
    return 42;
  });

  if (result.ok) {
    expectType<number>(result.value);
  }
  if (!result.ok) {
    // Without explicit types, error is UnexpectedError (safe default)
    // For typed errors, use run<T, E>(fn, { onError })
    expectType<UnexpectedError>(result.error);
  }
}

// =============================================================================
// TEST 8: Recommended pattern for closed union - use run.strict with catchUnexpected
// =============================================================================


async function _test8() {
  // Derive error type from functions being used, plus your unexpected error type
  type AppError = Errors<[typeof fetchUser, typeof fetchPosts]> | "UNEXPECTED";
  // AppError = 'NOT_FOUND' | 'FETCH_ERROR' | 'UNEXPECTED'

  const result = await run.strict<{ user: User; posts: Post[] }, AppError>(
    async (step) => {
      const user = await step(() => fetchUser("123"));
      const posts = await step(() => fetchPosts(user.id));
      return { user, posts };
    },
    {
      catchUnexpected: () => "UNEXPECTED" as const,
    }
  );

  if (!result.ok) {
    expectType<AppError>(result.error);
    // Can exhaustively match
    switch (result.error) {
      case "NOT_FOUND":
        break;
      case "FETCH_ERROR":
        break;
      case "UNEXPECTED":
        break;
    }
  }
}

// =============================================================================
// TEST 9: createWorkflow - Automatic error type inference (non-strict)
// =============================================================================

async function _test9() {
  // Create workflow with deps object - error types inferred automatically
  const getPosts = createWorkflow({ fetchUser, fetchPosts });

  const result = await getPosts(async (step) => {
    const user = await step(fetchUser("123"));
    const posts = await step(fetchPosts(user.id));
    return { user, posts };
  });

  if (result.ok) {
    expectType<{ user: User; posts: Post[] }>(result.value);
  }

  if (!result.ok) {
    // Error type is automatically inferred from deps object + UnexpectedError
    expectType<"NOT_FOUND" | "FETCH_ERROR" | UnexpectedError>(result.error);
  }
}

// =============================================================================
// TEST 10: createWorkflow with destructuring in callback
// =============================================================================

async function _test10() {
  const getPosts = createWorkflow({ fetchUser, fetchPosts });

  // Uses object is passed as second argument for destructuring
  const result = await getPosts(async (step, { fetchUser: fu, fetchPosts: fp }) => {
    const user = await step(fu("123"));
    const posts = await step(fp(user.id));
    return { user, posts };
  });

  if (result.ok) {
    expectType<{ user: User; posts: Post[] }>(result.value);
  }
}

// =============================================================================
// TEST 11: createWorkflow strict mode - closed error union
// =============================================================================

async function _test11() {
  const getPosts = createWorkflow(
    { fetchUser, fetchPosts },
    {
      strict: true,
      catchUnexpected: () => "UNEXPECTED" as const,
    }
  );

  const result = await getPosts(async (step) => {
    const user = await step(fetchUser("123"));
    const posts = await step(fetchPosts(user.id));
    return { user, posts };
  });

  if (!result.ok) {
    // Error type is exactly E | U (no UnexpectedError)
    expectType<"NOT_FOUND" | "FETCH_ERROR" | "UNEXPECTED">(result.error);

    // Can exhaustively match
    switch (result.error) {
      case "NOT_FOUND":
        break;
      case "FETCH_ERROR":
        break;
      case "UNEXPECTED":
        break;
    }
  }
}

// =============================================================================
// TEST 12: ErrorsOfDeps utility - Extract errors from deps object
// =============================================================================

function _test12() {
  type Deps = { fetchUser: typeof fetchUser; fetchPosts: typeof fetchPosts };
  type Extracted = ErrorsOfDeps<Deps>;

  expectType<"NOT_FOUND" | "FETCH_ERROR">({} as Extracted);
}

// =============================================================================
// TEST 13: createWorkflow with options (onError)
// =============================================================================

async function _test13() {
  const errors: Array<"NOT_FOUND" | "FETCH_ERROR" | UnexpectedError> = [];

  const getPosts = createWorkflow(
    { fetchUser, fetchPosts },
    {
      onError: (error) => {
        // Error type is correctly inferred
        expectType<"NOT_FOUND" | "FETCH_ERROR" | UnexpectedError>(error);
        errors.push(error);
      },
    }
  );

  await getPosts(async (step) => {
    const user = await step(fetchUser("123"));
    return user;
  });
}

// =============================================================================
// TEST 14: Typed cause - err() infers cause type from options
// =============================================================================

import { mapError, match, ExtractCause, CauseOf, map, tapError, andThen } from "./index";

function _test14TypedCause() {
  // err() without cause - defaults to unknown
  const noCause = err("ERROR" as const);
  expectType<Result<never, "ERROR", unknown>>(noCause);

  // err() with typed cause
  const withError = err("FAILED" as const, { cause: new Error("details") });
  expectType<Result<never, "FAILED", Error>>(withError);

  // err() with custom cause type
  type CustomCause = { code: number; details: string };
  const customCause: CustomCause = { code: 500, details: "Server error" };
  const withCustom = err("SERVER_ERROR" as const, { cause: customCause });
  expectType<Result<never, "SERVER_ERROR", CustomCause>>(withCustom);

  if (!withCustom.ok) {
    // Can access custom cause properties without type assertion
    expectType<CustomCause | undefined>(withCustom.cause);
    withCustom.cause?.code;
    withCustom.cause?.details;
  }
}

// =============================================================================
// TEST 15: mapError preserves cause type
// =============================================================================

function _test15MapErrorPreservesCause() {
  const original: Result<number, "A", Error> = err("A", { cause: new Error() });
  const mapped = mapError(original, () => "B" as const);

  // Cause type should be preserved through mapError
  expectType<Result<number, "B", Error>>(mapped);

  if (!mapped.ok) {
    expectType<Error | undefined>(mapped.cause);
  }
}

// =============================================================================
// TEST 16: match receives typed cause in err handler
// =============================================================================

function _test16MatchTypedCause() {
  const result: Result<number, "ERROR", Error> = err("ERROR", { cause: new Error() });

  const matched = match(result, {
    ok: (v) => String(v),
    err: (error, cause) => {
      expectType<"ERROR">(error);
      // Cause is typed as Error | undefined
      expectType<Error | undefined>(cause);
      return cause?.message ?? error;
    }
  });
  expectType<string>(matched);
}

// =============================================================================
// TEST 17: tapError receives typed cause
// =============================================================================

function _test17TapErrorTypedCause() {
  const result: Result<number, "ERROR", Error> = err("ERROR", { cause: new Error() });

  tapError(result, (error, cause) => {
    expectType<"ERROR">(error);
    expectType<Error | undefined>(cause);
    // Can access Error properties
    console.log(cause?.message);
  });
}

// =============================================================================
// TEST 18: map preserves cause type on error path
// =============================================================================

function _test18MapPreservesCause() {
  const result: Result<number, "ERROR", Error> = err("ERROR", { cause: new Error() });
  const mapped = map(result, (n) => n.toString());

  // Cause type preserved through map
  expectType<Result<string, "ERROR", Error>>(mapped);
}

// =============================================================================
// TEST 19: andThen unions cause types
// =============================================================================

function _test19AndThenCauseUnion() {
  type CauseA = { typeA: string };
  type CauseB = { typeB: number };

  const resultA: Result<number, "A", CauseA> = ok(42);
  const resultB: Result<string, "B", CauseB> = ok("hello");

  const chained = andThen(resultA, (n) =>
    n > 0 ? resultB : err("B" as const, { cause: { typeB: 0 } })
  );

  // Both error and cause types are unioned
  expectType<Result<string, "A" | "B", CauseA | CauseB>>(chained);
}

// =============================================================================
// TEST 20: ExtractCause utility type
// =============================================================================

function _test20ExtractCause() {
  type R = Result<number, "ERROR", Error>;
  type Cause = ExtractCause<R>;

  // ExtractCause extracts C from the type, which is Error (the cause field is cause?: C)
  expectType<Error>({} as Cause);
}

// =============================================================================
// TEST 21: CauseOf utility type - extract cause from function return
// =============================================================================

// Test helper functions for CauseOf tests
declare const fetchWithCause: (id: string) => Result<User, "NOT_FOUND", Error>;
declare const asyncFetchWithCause: (id: string) => AsyncResult<User, "NOT_FOUND", TypeError>;
declare const fetchUserWithCause: (id: string) => AsyncResult<User, "NOT_FOUND", Error>;

function _test21CauseOf() {
  // Function returning Result with typed cause
  type FetchCause = CauseOf<typeof fetchWithCause>;
  expectType<Error>({} as FetchCause);

  // Async function
  type AsyncFetchCause = CauseOf<typeof asyncFetchWithCause>;
  expectType<TypeError>({} as AsyncFetchCause);
}

// =============================================================================
// TEST 22: AsyncResult with typed cause
// =============================================================================

async function _test22AsyncResultTypedCause() {
  const result = await fetchUserWithCause("123");

  if (!result.ok) {
    expectType<"NOT_FOUND">(result.error);
    expectType<Error | undefined>(result.cause);
    // Can access Error properties directly
    result.cause?.message;
    result.cause?.stack;
  }
}

// =============================================================================
// TEST 23: createWorkflow with typed args - type inferred at call site
// =============================================================================

async function _test23WorkflowWithArgs() {
  const workflow = createWorkflow({ fetchUser, fetchPosts });

  // With args - type inferred from first argument
  const result = await workflow({ id: "123", limit: 10 }, async (step, deps, args) => {
    // args type is inferred from the first argument
    expectType<{ id: string; limit: number }>(args);
    const user = await step(fetchUser(args.id));
    return { user, limit: args.limit };
  });

  if (result.ok) {
    expectType<{ user: User; limit: number }>(result.value);
  }
}

// =============================================================================
// TEST 24: createWorkflow backwards compatibility - no args
// =============================================================================

async function _test24WorkflowBackwardsCompatible() {
  const workflow = createWorkflow({ fetchUser, fetchPosts });

  // Original API still works - no args
  const result = await workflow(async (step, deps) => {
    const user = await step(fetchUser("123"));
    return user;
  });

  if (result.ok) {
    expectType<User>(result.value);
  }

  if (!result.ok) {
    // Error type is inferred from deps
    expectType<"NOT_FOUND" | "FETCH_ERROR" | UnexpectedError>(result.error);
  }
}

// =============================================================================
// TEST 25: createWorkflow strict mode with args
// =============================================================================

async function _test25WorkflowStrictWithArgs() {
  const workflow = createWorkflow(
    { fetchUser, fetchPosts },
    {
      strict: true,
      catchUnexpected: () => "UNEXPECTED" as const,
    }
  );

  const result = await workflow({ userId: "123" }, async (step, deps, args) => {
    expectType<{ userId: string }>(args);
    const user = await step(fetchUser(args.userId));
    const posts = await step(fetchPosts(user.id));
    return { user, posts };
  });

  if (!result.ok) {
    // Strict mode - closed error union
    expectType<"NOT_FOUND" | "FETCH_ERROR" | "UNEXPECTED">(result.error);
  }
}

// =============================================================================
// TEST 26: createWorkflow with primitive args
// =============================================================================

async function _test26WorkflowPrimitiveArgs() {
  const workflow = createWorkflow({ fetchUser });

  // Primitive arg type (string)
  const result = await workflow("user-123", async (step, deps, id) => {
    expectType<string>(id);
    return await step(fetchUser(id));
  });

  if (result.ok) {
    expectType<User>(result.value);
  }
}

// =============================================================================
// TEST 27: createWorkflow cause type is unknown (honest typing)
// =============================================================================

async function _test27WorkflowCauseIsUnknown() {
  // Function that returns a typed cause
  const fetchWithTypedCause = async (id: string): AsyncResult<User, "NOT_FOUND", Error> => {
    try {
      if (id === "1") return ok({ id, name: "Alice" });
      throw new Error("Not found");
    } catch (e) {
      return err("NOT_FOUND" as const, { cause: e as Error });
    }
  };

  const workflow = createWorkflow({ fetchWithTypedCause });

  const result = await workflow(async (step) => {
    return await step(fetchWithTypedCause("1"));
  });

  if (!result.ok) {
    // Cause type is unknown because:
    // - step.try errors have thrown values as cause (unknown)
    // - Uncaught exceptions produce unknown causes
    // - Different steps may have different cause types
    // The cause IS preserved at runtime; narrow based on error type if needed.
    expectType<unknown>(result.cause);
  }
}

// =============================================================================
// TEST 28: batch operations preserve cause types
// =============================================================================

import { all, any } from "./index";

function _test28BatchPreservesCause() {
  const resultA: Result<number, "A", Error> = ok(42);
  const resultB: Result<string, "B", TypeError> = ok("hello");

  const combined = all([resultA, resultB]);

  if (!combined.ok) {
    // Cause should be Error | TypeError (union of input causes)
    expectType<Error | TypeError | undefined>(combined.cause);
  }

  const anyResult = any([resultA, resultB]);
  if (!anyResult.ok) {
    expectType<Error | TypeError | undefined>(anyResult.cause);
  }
}

// =============================================================================
// TEST 29: run() cause type is unknown (honest typing)
// =============================================================================

async function _test29RunCauseIsUnknown() {
  type AppError = "NOT_FOUND" | "FETCH_ERROR";

  const result = await run<User, AppError>(
    async (step) => {
      const user = await step(() => fetchUser("123"));
      return user;
    },
    { onError: () => {} }
  );

  if (!result.ok) {
    // Cause type is unknown because:
    // - step.try errors have thrown values as cause (unknown)
    // - Uncaught exceptions produce unknown causes
    // - Different steps may have different cause types
    expectType<unknown>(result.cause);
  }
}

// =============================================================================
// TEST 30: run.strict() cause type is unknown
// =============================================================================

async function _test30RunStrictCauseIsUnknown() {
  type AppError = "NOT_FOUND" | "UNEXPECTED";

  const result = await run.strict<User, AppError>(
    async (step) => {
      const user = await step(() => fetchUser("123"));
      return user;
    },
    { catchUnexpected: () => "UNEXPECTED" as const }
  );

  if (!result.ok) {
    // Even in strict mode, cause is unknown because catchUnexpected
    // receives thrown values which have unknown type
    expectType<unknown>(result.cause);
  }
}
