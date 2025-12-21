/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
// Above disables needed for type-level tests (compile-time assertions, type narrowing demos)

// ======================= TESTS =======================
import { describe, it, expect, vi } from "vitest";
import {
  all,
  allAsync,
  allSettled,
  allSettledAsync,
  andThen,
  any,
  anyAsync,
  AsyncResult,
  createWorkflow,
  err,
  ErrorOf,
  Errors,
  ExtractError,
  ExtractValue,
  from,
  fromNullable,
  fromPromise,
  isErr,
  isOk,
  isStepComplete,
  isUnexpectedError,
  map,
  mapError,
  mapErrorTry,
  mapTry,
  match,
  ok,
  partition,
  PromiseRejectedError,
  ResumeState,
  ResumeStateEntry,
  Result,
  run,
  RunStep,
  tap,
  tapError,
  tryAsync,
  UnexpectedError,
  unwrap,
  UnwrapError,
  unwrapOr,
  WorkflowEvent,
  unwrapOrElse,
  // HITL exports
  PendingApproval,
  ApprovalRejected,
  isPendingApproval,
  isApprovalRejected,
  pendingApproval,
  createApprovalStep,
  injectApproval,
  clearStep,
  hasPendingApproval,
  getPendingApprovals,
  createHITLCollector,
} from "./index";

describe("Result Core", () => {
  describe("ok()", () => {
    it("creates an ok result with value", () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it("has correct type - value is accessible", () => {
      const result = ok("hello");
      // Type: Result<string, never>
      if (result.ok) {
        const value: string = result.value;
        expect(value).toBe("hello");
      }
    });

    it("error type is never for ok results", () => {
      const result = ok(42);
      // @ts-expect-error - ok() returns Result<T, never>, error doesn't exist on ok branch
      result.error;
    });
  });

  describe("err()", () => {
    it("creates an error result", () => {
      const result = err("something went wrong");
      expect(result).toEqual({ ok: false, error: "something went wrong" });
    });

    it("preserves cause when provided", () => {
      const cause = new Error("original");
      const result = err("wrapped", { cause });
      expect(result).toEqual({
        ok: false,
        error: "wrapped",
        cause: cause,
      });
    });

    it("has correct type - error is accessible", () => {
      const result = err("NOT_FOUND" as const);
      if (!result.ok) {
        const error: "NOT_FOUND" = result.error;
        expect(error).toBe("NOT_FOUND");
      }
    });

    it("value type is never for err results", () => {
      const result = err("oops");
      // @ts-expect-error - err() returns Result<never, E>, value doesn't exist on err branch
      result.value;
    });
  });

  describe("isOk() / isErr() type guards", () => {
    it("narrows type correctly for ok", () => {
      const result: Result<number, string> = ok(42);

      if (isOk(result)) {
        // Type narrowed: we can access .value
        const num: number = result.value;
        expect(num).toBe(42);

        // @ts-expect-error - error doesn't exist on narrowed ok type
        result.error;
      }
    });

    it("narrows type correctly for err", () => {
      const result: Result<number, string> = err("failed");

      if (isErr(result)) {
        // Type narrowed: we can access .error
        const msg: string = result.error;
        expect(msg).toBe("failed");

        // @ts-expect-error - value doesn't exist on narrowed err type
        result.value;
      }
    });
  });
});

describe("Unwrapping", () => {
  describe("unwrap()", () => {
    it("returns value for ok result", () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it("throws UnwrapError for err (preserves error + cause)", () => {
      const cause = new Error("original");
      const result = err("FAILED", { cause });

      try {
        unwrap(result);
        expect.fail("should have thrown");
      } catch (error) {
        // Throws proper Error subclass for stack traces + logging
        expect(error).toBeInstanceOf(UnwrapError);
        expect(error).toBeInstanceOf(Error);
        expect((error as UnwrapError).error).toBe("FAILED");
        expect((error as UnwrapError).cause).toBe(cause);
        expect((error as UnwrapError).name).toBe("UnwrapError");
      }
    });
  });

  describe("unwrapOr()", () => {
    it("returns value for ok result", () => {
      const result: Result<number, string> = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it("returns default for err result", () => {
      const result: Result<number, string> = err("failed");
      expect(unwrapOr(result, 0)).toBe(0);
    });

    it("type of default must match value type", () => {
      const result: Result<number, string> = ok(42);
      // @ts-expect-error - default must be number, not string
      unwrapOr(result, "not a number");
    });
  });

  describe("unwrapOrElse()", () => {
    it("returns value for ok result", () => {
      const result: Result<number, string> = ok(42);
      expect(unwrapOrElse(result, () => 0)).toBe(42);
    });

    it("calls fallback with error for err result", () => {
      const result: Result<number, string> = err("failed");
      const fallback = unwrapOrElse(result, (error) => {
        expect(error).toBe("failed");
        return -1;
      });
      expect(fallback).toBe(-1);
    });

    it("fallback receives correct error type", () => {
      const result: Result<number, { code: number }> = err({ code: 404 });
      unwrapOrElse(result, (error) => {
        // error is typed as { code: number }
        const code: number = error.code;
        return code;
      });
    });
  });
});

describe("from() and fromPromise()", () => {
  describe("from()", () => {
    it("wraps successful sync function", () => {
      const result = from(() => 42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it("catches thrown errors", () => {
      const result = from(() => {
        throw new Error("boom");
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
        // No cause when not mapping - error IS the cause
        expect(result.cause).toBeUndefined();
      }
    });

    it("maps errors with custom mapper", () => {
      const result = from(
        () => {
          throw new Error("boom");
        },
        () => "CUSTOM_ERROR" as const
      );

      if (isErr(result)) {
        // Error is mapped to our custom type
        const error: "CUSTOM_ERROR" = result.error;
        expect(error).toBe("CUSTOM_ERROR");
        // Original cause is preserved
        expect(result.cause).toBeInstanceOf(Error);
      }
    });

    it("defaults to unknown error type without mapper (type safety)", () => {
      const result = from(() => {
        throw new Error("boom");
      });

      // Without mapper, error type is `unknown` - NOT some narrow type
      if (isErr(result)) {
        // This forces you to narrow the type before using it
        // @ts-expect-error - error is unknown, can't assign to string
        const _narrow: string = result.error;

        // You must check the type first
        if (result.error instanceof Error) {
          expect(result.error.message).toBe("boom");
        }
      }
    });

    it("prevents type lies - can't specify narrow type without mapper", () => {
      // OLD BEHAVIOR (unsafe): from<number, 'NOT_FOUND'>(() => { throw ... })
      // would claim error is 'NOT_FOUND' but it's actually an Error

      // NEW BEHAVIOR (safe): Without mapper, error is always unknown
      const result = from(() => {
        throw new Error("real error");
      });

      // The type system correctly reports this as Result<never, unknown>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type ErrorType = typeof result extends Result<any, infer E> ? E : never;
      const _check: unknown extends ErrorType ? true : false = true;
    });
  });

  describe("fromPromise()", () => {
    it("wraps successful promise", async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it("catches rejected promises", async () => {
      const result = await fromPromise(Promise.reject(new Error("async boom")));
      expect(isErr(result)).toBe(true);
    });

    it("maps errors with custom mapper", async () => {
      const result = await fromPromise(
        Promise.reject(new Error("network")),
        () => "NETWORK_ERROR" as const
      );

      if (isErr(result)) {
        const error: "NETWORK_ERROR" = result.error;
        expect(error).toBe("NETWORK_ERROR");
      }
    });

    it("returns AsyncResult type", () => {
      const result = fromPromise(Promise.resolve(42));
      // AsyncResult<number, unknown> = Promise<Result<number, unknown>>
      type Expected = AsyncResult<number, unknown>;
      const _typeCheck: Expected = result;
    });

    it("defaults to unknown error type without mapper (type safety)", async () => {
      const result = await fromPromise(Promise.reject(new Error("async boom")));

      if (isErr(result)) {
        // @ts-expect-error - error is unknown, can't assign to string
        const _narrow: string = result.error;

        // Must narrow first
        if (result.error instanceof Error) {
          expect(result.error.message).toBe("async boom");
        }
      }
    });
  });
});

describe("map() and mapError()", () => {
  describe("map()", () => {
    it("transforms ok value", () => {
      const result = ok(42);
      const mapped = map(result, (n) => n * 2);
      expect(mapped).toEqual({ ok: true, value: 84 });
    });

    it("passes through err unchanged", () => {
      const result: Result<number, string> = err("failed");
      const mapped = map(result, (n) => n * 2);
      expect(mapped).toEqual({ ok: false, error: "failed" });
    });

    it("transform receives correct type", () => {
      const result: Result<{ name: string }, string> = ok({ name: "Alice" });
      map(result, (user) => {
        // user is typed as { name: string }
        const name: string = user.name;
        return name.toUpperCase();
      });
    });

    it("output type reflects transformation", () => {
      const result: Result<number, string> = ok(42);
      const mapped = map(result, String);

      if (isOk(mapped)) {
        // Value is now string
        const str: string = mapped.value;
        expect(str).toBe("42");

        // @ts-expect-error - value is string, not number
        const _num: number = mapped.value;
      }
    });
  });

  describe("mapError()", () => {
    it("transforms error", () => {
      const result: Result<number, string> = err("not_found");
      const mapped = mapError(result, (e) => ({ code: e.toUpperCase() }));
      expect(mapped).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    });

    it("passes through ok unchanged", () => {
      const result: Result<number, string> = ok(42);
      const mapped = mapError(result, (e) => ({ code: e }));
      expect(mapped).toEqual({ ok: true, value: 42 });
    });

    it("preserves cause when mapping error", () => {
      const cause = new Error("original");
      const result: Result<number, string> = err("failed", { cause });
      const mapped = mapError(result, (e) => `wrapped: ${e}`);

      if (isErr(mapped)) {
        expect(mapped.cause).toBe(cause);
      }
    });

    it("output error type reflects transformation", () => {
      const result: Result<number, string> = err("oops");
      const mapped = mapError(result, () => 404);

      if (isErr(mapped)) {
        // Error is now number
        const code: number = mapped.error;
        expect(code).toBe(404);

        // @ts-expect-error - error is number, not string
        const _str: string = mapped.error;
      }
    });
  });
});

describe("match() - exhaustive pattern matching", () => {
  it("calls ok handler for ok result", () => {
    const result: Result<number, string> = ok(42);
    const message = match(result, {
      ok: (value) => `Got: ${value}`,
      err: (error) => `Error: ${error}`,
    });

    expect(message).toBe("Got: 42");
  });

  it("calls err handler for err result", () => {
    const result: Result<number, string> = err("NOT_FOUND");
    const message = match(result, {
      ok: (value) => `Got: ${value}`,
      err: (error) => `Error: ${error}`,
    });

    expect(message).toBe("Error: NOT_FOUND");
  });

  it("passes cause to err handler", () => {
    const cause = new Error("original");
    const result: Result<number, string> = err("FAILED", { cause });

    const receivedCause = match(result, {
      ok: () => null,
      err: (_error, cause) => cause,
    });

    expect(receivedCause).toBe(cause);
  });

  it("infers return type from handlers", () => {
    const result: Result<{ name: string }, "NOT_FOUND"> = ok({ name: "Alice" });

    // Return type is number (both branches return number)
    const statusCode: number = match(result, {
      ok: () => 200,
      err: () => 404,
    });

    expect(statusCode).toBe(200);
  });

  it("works with exhaustive error handling", () => {
    type AppError = "NOT_FOUND" | "UNAUTHORIZED" | "SERVER_ERROR";
    const result: Result<string, AppError> = err("UNAUTHORIZED");

    const httpStatus = match(result, {
      ok: () => 200,
      err: (error) => {
        switch (error) {
          case "NOT_FOUND": {
            return 404;
          }
          case "UNAUTHORIZED": {
            return 401;
          }
          case "SERVER_ERROR": {
            return 500;
          }
        }
      },
    });

    expect(httpStatus).toBe(401);
  });
});

describe("run() - do-notation style", () => {
  it("executes steps sequentially and returns final value", async () => {
    // No catchUnexpected needed - only using step results
    const result = await run(async (step) => {
      const a = await step(() => ok(10));
      const b = await step(() => ok(20));
      const c = await step(() => ok(12));
      return a + b + c;
    });

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("early exits on first error", async () => {
    const executedSteps: string[] = [];

    const result = await run(
      async (step) => {
        executedSteps.push("step1");
        const a = await step(() => ok(10));

        executedSteps.push("step2");
        await step(() => err("FAILED"));

        executedSteps.push("step3"); // Should not execute
        const c = await step(() => ok(12));

        return a + c;
      },
      { onError: () => {} } // Use onError for typed errors
    );

    expect(executedSteps).toEqual(["step1", "step2"]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("FAILED");
    }
  });

  it("step unwraps Result and returns value directly", async () => {
    const result = await run(async (step) => {
      // step() returns T, not Result<T, E>
      const value = await step(() => ok({ name: "Alice" }));

      // We can access .name directly - no need to check .ok
      return `Hello, ${value.name}`;
    });

    expect(result).toEqual({ ok: true, value: "Hello, Alice" });
  });

  it("handles async Result-returning operations", async () => {
    const asyncOp = async (): AsyncResult<number, string> => {
      await new Promise((r) => setTimeout(r, 1));
      return ok(42);
    };

    const result = await run(async (step) => {
      const value = await step(() => asyncOp());
      return value * 2;
    });

    expect(result).toEqual({ ok: true, value: 84 });
  });

  it("calls onError callback when step fails", async () => {
    const errors: Array<{ error: unknown; stepName?: string }> = [];

    await run(
      async (step) => {
        await step(() => err("VALIDATION_ERROR"), "validateInput");
        return 0;
      },
      {
        onError: (error, stepName) => {
          errors.push({ error, stepName });
        },
      }
    );

    expect(errors).toEqual([
      { error: "VALIDATION_ERROR", stepName: "validateInput" },
    ]);
  });

  it("preserves cause from failed step", async () => {
    const originalCause = new Error("database connection failed");

    const result = await run(async (step) => {
      await step(() => err("DB_ERROR", { cause: originalCause }));
      return 0;
    });

    if (isErr(result)) {
      expect(result.cause).toBe(originalCause);
    }
  });

  describe("step.try() with throwing operations", () => {
    it("catches and maps thrown errors (async)", async () => {
      const result = await run(
        async (step) => {
          const value = await step.try(
            async () => {
              throw new Error("network failure");
            },
            { onError: () => "NETWORK_ERROR" }
          );
          return value;
        },
        { onError: () => {} } // Use onError for typed errors
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe("NETWORK_ERROR");
        // Cause is preserved - the original Error
        expect(result.cause).toBeInstanceOf(Error);
      }
    });

    it("catches and maps thrown errors (sync)", async () => {
      const result = await run(
        async (step) => {
          // Sync operation - no async/await needed!
          const value = await step.try(
            () => {
              throw new Error("sync failure");
            },
            { onError: () => "SYNC_ERROR" }
          );
          return value;
        },
        { onError: () => {} } // Use onError for typed errors
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe("SYNC_ERROR");
        expect(result.cause).toBeInstanceOf(Error);
      }
    });

    it("works with sync operations that succeed", async () => {
      const result = await run(async (step) => {
        // Sync operation that doesn't throw
        const value = await step.try(() => JSON.parse('{"x": 42}'), {
          onError: () => "PARSE_ERROR",
        });
        return value.x;
      });

      expect(result).toEqual({ ok: true, value: 42 });
    });

    it("supports shared error mappers for throwing steps", async () => {
      const mapUnknown = (cause: unknown) => ({
        code: cause instanceof Error ? cause.message : "UNKNOWN",
      });

      const result = await run(
        async (step) => {
          await step.try(
            async () => {
              throw new Error("oops");
            },
            { onError: mapUnknown }
          );
          return 0;
        },
        { onError: () => {} } // Use onError for typed errors
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({ code: "oops" });
        expect(result.cause).toBeInstanceOf(Error);
      }
    });

    it("supports { error } shorthand (no  needed)", async () => {
      const result = await run(
        async (step) => {
          await step.try(
            async () => {
              throw new Error("oops");
            },
            { error: "NETWORK_ERROR" }
          );
          return 0;
        },
        { onError: () => {} } // Use onError for typed errors
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe("NETWORK_ERROR");
        expect(result.cause).toBeInstanceOf(Error);
      }
    });
  });

  describe("step.fromResult() with Result-returning functions", () => {
    it("unwraps success values", async () => {
      const fetchUser = (id: string) => ok({ id, name: "Alice" });

      const result = await run(
        async (step) => {
          const user = await step.fromResult(() => fetchUser("1"), {
            error: "FETCH_FAILED",
          });
          return user;
        },
        { onError: () => {} }
      );

      expect(result).toEqual({ ok: true, value: { id: "1", name: "Alice" } });
    });

    it("maps Result errors using onError callback", async () => {
      type UserError = { type: "NOT_FOUND"; userId: string };
      const fetchUser = (id: string): Result<{ id: string; name: string }, UserError> =>
        err({ type: "NOT_FOUND", userId: id });

      const result = await run(
        async (step) => {
          const user = await step.fromResult(() => fetchUser("1"), {
            onError: (e) => ({ code: "USER_ERROR", original: e }),
          });
          return user;
        },
        { onError: () => {} }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({
          code: "USER_ERROR",
          original: { type: "NOT_FOUND", userId: "1" },
        });
        // The cause is the original Result error
        expect(result.cause).toEqual({ type: "NOT_FOUND", userId: "1" });
      }
    });

    it("maps Result errors using static error shorthand", async () => {
      const failingOp = (): Result<number, string> => err("ORIGINAL_ERROR");

      const result = await run(
        async (step) => {
          return await step.fromResult(() => failingOp(), {
            error: "MAPPED_ERROR" as const,
          });
        },
        { onError: () => {} }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe("MAPPED_ERROR");
        expect(result.cause).toBe("ORIGINAL_ERROR");
      }
    });

    it("works with async Result-returning functions", async () => {
      const asyncFetch = async (): AsyncResult<string, "TIMEOUT"> => {
        await new Promise((r) => setTimeout(r, 1));
        return err("TIMEOUT");
      };

      const result = await run(
        async (step) => {
          return await step.fromResult(() => asyncFetch(), {
            onError: (e) => ({ type: "NETWORK", reason: e }),
          });
        },
        { onError: () => {} }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({ type: "NETWORK", reason: "TIMEOUT" });
      }
    });

    it("preserves Result cause in the error chain", async () => {
      const opWithCause = (): Result<number, string, Error> =>
        err("DB_ERROR", { cause: new Error("connection refused") });

      const result = await run(
        async (step) => {
          return await step.fromResult(() => opWithCause(), {
            error: "MAPPED" as const,
          });
        },
        { onError: () => {} }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe("MAPPED");
        // The cause is the original Result error
        expect(result.cause).toBe("DB_ERROR");
      }
    });

    it("provides typed error in onError unlike step.try", async () => {
      // This is the key ergonomic improvement over step.try
      // In step.try, onError receives `unknown`
      // In step.fromResult, onError receives the typed Result error

      type ProviderError = { provider: string; code: number };
      const callProvider = (): Result<string, ProviderError> =>
        err({ provider: "openai", code: 429 });

      const result = await run(
        async (step) => {
          return await step.fromResult(() => callProvider(), {
            // e is typed as ProviderError, not unknown!
            onError: (e) => ({
              type: "RATE_LIMITED" as const,
              provider: e.provider, // TypeScript knows this exists
              code: e.code, // TypeScript knows this exists
            }),
          });
        },
        { onError: () => {} }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({
          type: "RATE_LIMITED",
          provider: "openai",
          code: 429,
        });
      }
    });

    it("emits events with name and key", async () => {
      const events: unknown[] = [];
      const failingOp = (): Result<number, string> => err("ERROR");

      await run(
        async (step) => {
          return await step.fromResult(() => failingOp(), {
            error: "MAPPED",
            name: "fromResultStep",
            key: "fr:1",
          });
        },
        {
          onError: () => {},
          onEvent: (e) => events.push(e),
        }
      );

      const stepStart = events.find(
        (e) => (e as { type: string }).type === "step_start"
      );
      const stepError = events.find(
        (e) => (e as { type: string }).type === "step_error"
      );
      const stepComplete = events.find(
        (e) => (e as { type: string }).type === "step_complete"
      );

      expect(stepStart).toMatchObject({ name: "fromResultStep", stepKey: "fr:1" });
      expect(stepError).toMatchObject({ name: "fromResultStep", stepKey: "fr:1" });
      expect(stepComplete).toMatchObject({
        name: "fromResultStep",
        stepKey: "fr:1",
        meta: { origin: "result" },
      });
    });
  });

  // NOTE: errors() helper was removed in v2. Use run<T, E>(..., { onError }) for explicit types.

  describe("unexpected error handling", () => {
    it("returns UnexpectedError by default (never rejects)", async () => {
      const result = await run(async () => {
        throw new Error("unexpected!");
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toMatchObject({
          type: "UNEXPECTED_ERROR",
          cause: { type: "UNCAUGHT_EXCEPTION" },
        });
        const thrown =
          result.error.cause &&
          typeof result.error.cause === "object" &&
          "thrown" in result.error.cause
            ? (result.error.cause as { thrown?: unknown }).thrown
            : undefined;
        expect(thrown).toBeInstanceOf(Error);
      }
    });

    it("catches unexpected errors with catchUnexpected", async () => {
      const result = await run(
        async () => {
          throw new Error("unexpected!");
        },
        {
          catchUnexpected: (cause) => ({ message: (cause as Error).message }),
        }
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual({ message: "unexpected!" });
        expect(result.cause).toBeInstanceOf(Error);
      }
    });

    it("catchUnexpected maps to typed error", async () => {
      type AppError = "MAPPED_ERROR";

      const result = await run(
        async () => {
          throw new Error("boom");
        },
        {
          catchUnexpected: () => "MAPPED_ERROR" as const,
        }
      );

      if (isErr(result)) {
        // Error type is correctly inferred
        const error: AppError = result.error;
        expect(error).toBe("MAPPED_ERROR");
      }
    });
  });

  describe("type safety for error types", () => {
    it("infers step error unions", async () => {
      type AppError = "NOT_FOUND" | "FETCH_ERROR";

      const fetchUser = async (
        id: string
      ): AsyncResult<{ id: string }, "NOT_FOUND"> => {
        if (id === "unknown") return err("NOT_FOUND");
        return ok({ id });
      };

      const fetchPosts = async (
        userId: string
      ): AsyncResult<string[], "FETCH_ERROR"> => {
        if (userId === "bad") return err("FETCH_ERROR");
        return ok([`Post by ${userId}`]);
      };

      const result = await run.strict<
        { user: { id: string }; posts: string[] },
        AppError | "UNEXPECTED"
      >(
        async (step) => {
          const user = await step(() => fetchUser("unknown")); // Returns NOT_FOUND
          const posts = await step(() => fetchPosts(user.id));
          return { user, posts };
        },
        { catchUnexpected: () => "UNEXPECTED"  }
      );

      if (isErr(result)) {
        // Error type is exactly our closed union
        const error: AppError | "UNEXPECTED" = result.error;
        expect(error).toBe("NOT_FOUND");
      }
    });

    it("returns UnexpectedError when catchUnexpected not provided", async () => {
      // With no options, run() returns UnexpectedError for any failures
      const result = await run(async () => {
        throw new Error("unexpected!");
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        // Error type is UnexpectedError
        expect(result.error).toMatchObject({
          type: "UNEXPECTED_ERROR",
          cause: { type: "UNCAUGHT_EXCEPTION" },
        });
        const thrown =
          result.error.cause &&
          typeof result.error.cause === "object" &&
          "thrown" in result.error.cause
            ? (result.error.cause as { thrown?: unknown }).thrown
            : undefined;
        expect(thrown).toBeInstanceOf(Error);
      }
    });

    it("calls onError with UnexpectedError when exception occurs", async () => {
      const onError = vi.fn();

      const result = await run(
        async () => {
          throw new Error("unexpected!");
        },
        { onError }
      );

      expect(isErr(result)).toBe(true);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "UNEXPECTED_ERROR",
          cause: expect.objectContaining({ type: "UNCAUGHT_EXCEPTION" }),
        }),
        "unexpected"
      );
    });
  });
});

describe("all() - like Promise.all (sync)", () => {
  it("combines multiple ok results into tuple", () => {
    const result = all([ok(1), ok("two"), ok(true)] );

    expect(result).toEqual({ ok: true, value: [1, "two", true] });
  });

  it("returns first error if any fails", () => {
    const result = all([
      ok(1),
      err("SECOND_FAILED"),
      ok(3),
      err("FOURTH_FAILED"),
    ]);

    expect(result).toEqual({ ok: false, error: "SECOND_FAILED" });
  });

  it("preserves tuple types", () => {
    const result = all([ok(42), ok("hello"), ok({ active: true })] );

    if (isOk(result)) {
      const [num, str, obj] = result.value;

      // Types are preserved
      const _n: number = num;
      const _s: string = str;
      const _b: boolean = obj.active;

      // @ts-expect-error - first element is number, not string
      const _wrong: string = num;
    }
  });

  it("error type is union of all error types", () => {
    const result = all([
      ok(1) as Result<number, "ERROR_A">,
      ok(2) as Result<number, "ERROR_B">,
    ]);

    if (isErr(result)) {
      // Error type is "ERROR_A" | "ERROR_B"
      const error: "ERROR_A" | "ERROR_B" = result.error;
    }
  });
});

describe("any() - like Promise.any (sync)", () => {
  it("returns first ok result", () => {
    const result = any([err("first failed"), ok(42), ok(100)]);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("returns error if all fail", () => {
    const result = any([err("A"), err("B"), err("C")]);

    expect(isErr(result)).toBe(true);
  });

  it("preserves cause when all fail", () => {
    const originalCause = new Error("root cause");
    const result = any([
      err("FIRST_ERROR", { cause: originalCause }),
      err("SECOND_ERROR"),
      err("THIRD_ERROR"),
    ]);

    if (isErr(result)) {
      expect(result.error).toBe("FIRST_ERROR");
      // Cause is preserved from original Result
      expect(result.cause).toBe(originalCause);
    }
  });

  it("returns err on empty array (no exceptions)", () => {
    const result = any([]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        type: "EMPTY_INPUT",
        message: "any() requires at least one Result",
      });
    }
  });

  it("value type is union of all value types", () => {
    const result = any([
      ok(42) as Result<number, string>,
      ok("hello") as Result<string, string>,
    ]);

    if (isOk(result)) {
      // Value type is number | string
      const value: number | string = result.value;
    }
  });
});

describe("Type utilities", () => {
  it("ExtractValue extracts value type", () => {
    type TestResult = Result<{ id: number; name: string }, Error>;
    type Value = ExtractValue<TestResult>;

    // Value should be { id: number; name: string }
    const _check: Value = { id: 1, name: "test" };

    // Verify the type is correct by checking assignability
    const value: Value = { id: 42, name: "Alice" };
    expect(value.id).toBe(42);
    expect(value.name).toBe("Alice");
  });

  it("ExtractError extracts error type", () => {
    type TestResult = Result<number, { code: string; message: string }>;
    type ErrorType = ExtractError<TestResult>;

    // ErrorType should be { code: string; message: string }
    const _check: ErrorType = { code: "ERR", message: "failed" };

    // Verify the type is correct by checking assignability
    const error: ErrorType = {
      code: "NOT_FOUND",
      message: "Resource not found",
    };
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Resource not found");
  });

  it("ExtractValue returns never for non-Result types", () => {
    type NotAResult = ExtractValue<string>;
    // NotAResult is `never`

    // @ts-expect-error - can't assign string to never
    const _bad: NotAResult = "hello";
  });

  it("ExtractError returns never for non-Result types", () => {
    type NotAResult = ExtractError<number>;
    // NotAResult is `never`

    // @ts-expect-error - can't assign number to never
    const _bad: NotAResult = 42;
  });
});

describe("Error definition patterns", () => {
  describe("string literal unions (type-only)", () => {
    type AppError = "NOT_FOUND" | "VALIDATION_ERROR" | "NETWORK_ERROR";

    it("works with literal union types", async () => {
      const findUser = (id: string): Result<{ id: string }, AppError> => {
        if (id === "unknown") return err("NOT_FOUND");
        return ok({ id });
      };

      const result = findUser("unknown");
      if (isErr(result)) {
        // Error is typed as AppError
        const error: AppError = result.error;
        expect(error).toBe("NOT_FOUND");
      }
    });
  });

  describe("const object pattern (runtime + type)", () => {
    // This gives you BOTH runtime values AND types
    const AppError = {
      NOT_FOUND: "NOT_FOUND",
      VALIDATION_ERROR: "VALIDATION_ERROR",
      NETWORK_ERROR: "NETWORK_ERROR",
    } as const;

    // Extract the type from the const
    type AppError = (typeof AppError)[keyof typeof AppError];

    it("works with const objects", async () => {
      const findUser = (id: string): Result<{ id: string }, AppError> => {
        if (id === "unknown") return err(AppError.NOT_FOUND);
        return ok({ id });
      };

      const result = findUser("unknown");
      if (isErr(result)) {
        // Can compare against the const at runtime
        expect(result.error).toBe(AppError.NOT_FOUND);

        // Type is still the union
        const error: AppError = result.error;
      }
    });

    it("enables exhaustive switch statements", () => {
      const result: Result<number, AppError> = err(AppError.NOT_FOUND);

      if (isErr(result)) {
        // Exhaustive handling with const values
        switch (result.error) {
          case AppError.NOT_FOUND: {
            expect(true).toBe(true);
            break;
          }
          case AppError.VALIDATION_ERROR: {
            expect.fail("wrong branch");
            break;
          }
          case AppError.NETWORK_ERROR: {
            expect.fail("wrong branch");
            break;
          }
          default: {
            // TypeScript knows this is unreachable
            const _exhaustive: never = result.error;
            break;
          }
        }
      }
    });
  });

  describe("class-based errors (rich error objects)", () => {
    // Base error class
    class AppError {
      constructor(
        public readonly code: string,
        public readonly message: string
      ) {}
    }

    class NotFoundError extends AppError {
      constructor(resource: string) {
        super("NOT_FOUND", `${resource} not found`);
      }
    }

    class ValidationError extends AppError {
      constructor(public readonly field: string, message: string) {
        super("VALIDATION", message);
      }
    }

    it("works with error classes", () => {
      const findUser = (id: string): Result<{ id: string }, AppError> => {
        if (id === "unknown") return err(new NotFoundError("User"));
        if (id === "") return err(new ValidationError("id", "ID required"));
        return ok({ id });
      };

      const result = findUser("unknown");
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toBe("User not found");
      }
    });

    it("enables instanceof checks for specific handling", () => {
      const result: Result<number, AppError> = err(
        new ValidationError("email", "Invalid email format")
      );

      if (isErr(result) && result.error instanceof ValidationError) {
          // Type narrowed - can access .field
          expect(result.error.field).toBe("email");
        }
    });
  });

  describe("discriminated union errors (tagged objects)", () => {
    // Each error type has a discriminant field
    type AppError =
      | { type: "NOT_FOUND"; resource: string }
      | { type: "VALIDATION"; field: string; message: string }
      | { type: "NETWORK"; statusCode: number };

    it("works with discriminated unions", () => {
      const findUser = (id: string): Result<{ id: string }, AppError> => {
        if (id === "unknown") {
          return err({ type: "NOT_FOUND", resource: "User" });
        }
        return ok({ id });
      };

      const result = findUser("unknown");
      if (isErr(result)) {
        expect(result.error.type).toBe("NOT_FOUND");
        if (result.error.type === "NOT_FOUND") {
          // Type narrowed
          expect(result.error.resource).toBe("User");
        }
      }
    });

    it("enables exhaustive switch on error.type", () => {
      const result: Result<number, AppError> = err({
        type: "NETWORK",
        statusCode: 500,
      });

      if (isErr(result)) {
        switch (result.error.type) {
          case "NOT_FOUND": {
            expect.fail("wrong branch");
            break;
          }
          case "VALIDATION": {
            expect.fail("wrong branch");
            break;
          }
          case "NETWORK": {
            // Type narrowed - can access .statusCode
            expect(result.error.statusCode).toBe(500);
            break;
          }
          default: {
            const _exhaustive: never = result.error;
            break;
          }
        }
      }
    });
  });
});

describe("ErrorOf and Errors utilities - auto-extract error types", () => {
  // These functions have explicit error types
  const fetchUser = async (
    id: string
  ): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> => {
    if (id === "unknown") return err("NOT_FOUND");
    return ok({ id, name: "Alice" });
  };

  const fetchPosts = async (
    userId: string
  ): AsyncResult<string[], "FETCH_ERROR"> => {
    if (userId === "bad") return err("FETCH_ERROR");
    return ok([`Post by ${userId}`]);
  };

  const validateInput = (input: string): Result<string, "VALIDATION_ERROR"> => {
    if (input.length === 0) return err("VALIDATION_ERROR");
    return ok(input);
  };

  it("ErrorOf extracts error type from a single function", () => {
    // Auto-extract error type from function
    type UserError = ErrorOf<typeof fetchUser>;
    type PostError = ErrorOf<typeof fetchPosts>;
    type ValidationError = ErrorOf<typeof validateInput>;

    // Type checks - these compile only if types are correct
    const _userErr: UserError = "NOT_FOUND";
    const _postErr: PostError = "FETCH_ERROR";
    const _valErr: ValidationError = "VALIDATION_ERROR";

    expect(_userErr).toBe("NOT_FOUND");
  });

  it("Errors combines error types from multiple functions using tuple", () => {
    // Use tuple syntax - supports unlimited functions!
    type AppError = Errors<
      [typeof fetchUser, typeof fetchPosts, typeof validateInput]
    >;

    // AppError is 'NOT_FOUND' | 'FETCH_ERROR' | 'VALIDATION_ERROR'
    const errors: AppError[] = ["NOT_FOUND", "FETCH_ERROR", "VALIDATION_ERROR"];
    expect(errors).toHaveLength(3);
  });

  it("works with run() (typed is the default) for clean DX", async () => {
    // Step 1: Extract error types from your functions (tuple syntax)
    type AppError = Errors<[typeof fetchUser, typeof fetchPosts]> | "UNEXPECTED";

    // Step 2: Use with run.strict() for closed error union
    const result = await run.strict<
      { user: { id: string; name: string }; posts: string[] },
      AppError
    >(
      async (step) => {
        const user = await step(() => fetchUser("123"));
        const posts = await step(() => fetchPosts(user.id));
        return { user, posts };
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(result).toEqual({
      ok: true,
      value: {
        user: { id: "123", name: "Alice" },
        posts: ["Post by 123"],
      },
    });

    // Error type is exactly our closed union
    if (isErr(result)) {
      const error: AppError = result.error;
    }
  });

  it("early exits preserve the extracted error type", async () => {
    type AppError = Errors<[typeof fetchUser, typeof fetchPosts]> | "UNEXPECTED";

    const result = await run.strict<
      { user: { id: string; name: string }; posts: string[] },
      AppError
    >(
      async (step) => {
        const user = await step(() => fetchUser("unknown")); // Will fail
        const posts = await step(() => fetchPosts(user.id));
        return { user, posts };
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      // Error type is exactly our closed union
      const error: AppError = result.error;
      expect(error).toBe("NOT_FOUND");
    }
  });

  it("combines three different error types cleanly", async () => {
    type AppError =
      | Errors<[typeof validateInput, typeof fetchUser, typeof fetchPosts]>
      | "UNEXPECTED";
    // AppError = "VALIDATION_ERROR" | "NOT_FOUND" | "FETCH_ERROR" | "UNEXPECTED"

    const result = await run.strict<
      { user: { id: string; name: string } },
      AppError
    >(
      async (step) => {
        const input = await step(() => validateInput("hello"));
        const user = await step(() => fetchUser(input));
        return { user };
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(isOk(result)).toBe(true);

    // Error type is exactly our closed union
    if (isErr(result)) {
      const error: AppError = result.error;
    }
  });

  it("Errors tuple supports more than 5 functions", () => {
    // Define 7 different functions with unique error types
    const fn1 = (): Result<number, "E1"> => ok(1);
    const fn2 = (): Result<number, "E2"> => ok(2);
    const fn3 = (): Result<number, "E3"> => ok(3);
    const fn4 = (): Result<number, "E4"> => ok(4);
    const fn5 = (): Result<number, "E5"> => ok(5);
    const fn6 = (): Result<number, "E6"> => ok(6);
    const fn7 = (): Result<number, "E7"> => ok(7);

    // Tuple syntax works with unlimited functions!
    type AllErrors = Errors<
      [
        typeof fn1,
        typeof fn2,
        typeof fn3,
        typeof fn4,
        typeof fn5,
        typeof fn6,
        typeof fn7
      ]
    >;

    // All 7 error types are present
    const errors: AllErrors[] = ["E1", "E2", "E3", "E4", "E5", "E6", "E7"];
    expect(errors).toHaveLength(7);

    // @ts-expect-error - E8 is not part of the union
    const invalidError: AllErrors = "E8";
  });

  it("step.try() REQUIRES onError - compile-time check", () => {
    // This is a compile-time check only - we use type assertions to prove the interface
    // Define a type test helper (never actually called)
    type TypeTest<_T> = true;

    // Result-returning steps work - RunStep<unknown> accepts any error types
    type ResultStepWorks = TypeTest<
      RunStep<unknown> extends {
        <T, E>(
          operation: () => Result<T, E> | AsyncResult<T, E>,
          stepName?: string
        ): Promise<T>;
      }
        ? true
        : false
    >;
    const _resultStepWorks: ResultStepWorks = true;

    // step.try() REQUIRES either { error } or { onError } in options
    type StepTryOptions = Parameters<RunStep<unknown>["try"]>[1];

    // Prove options must have error or onError (can't be just { stepName })
    type HasErrorOrOnError = StepTryOptions extends
      | { error: unknown }
      | { onError: (cause: unknown) => unknown }
      ? true
      : false;
    const _hasErrorOrOnError: HasErrorOrOnError = true;

    // Valid options - have error mapping:
    const _validOptsError: StepTryOptions = {
      error: "NOT_FOUND" ,
      name: "load",
    };
    const _validOptsOnError: StepTryOptions = {
      onError: () => "NOT_FOUND" ,
      name: "load",
    };

    expect(_resultStepWorks).toBe(true);
    expect(_hasErrorOrOnError).toBe(true);
  });
});

describe("Real-world usage patterns", () => {
  // Simulated API functions
  const fetchUser = async (
    id: string
  ): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> => {
    if (id === "unknown") return err("NOT_FOUND");
    return ok({ id, name: "Alice" });
  };

  const fetchPosts = async (
    userId: string
  ): AsyncResult<string[], "FETCH_ERROR"> => {
    return ok([`Post by ${userId}`]);
  };

  it("composes multiple async operations cleanly (typed by default)", async () => {
    type AppError = "NOT_FOUND" | "FETCH_ERROR" | "UNEXPECTED";

    const result = await run.strict<
      { user: { id: string; name: string }; posts: string[] },
      AppError
    >(
      async (step) => {
        const user = await step(() => fetchUser("123"));
        const posts = await step(() => fetchPosts(user.id));
        return { user, posts };
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(result).toEqual({
      ok: true,
      value: {
        user: { id: "123", name: "Alice" },
        posts: ["Post by 123"],
      },
    });
  });

  it("early exits preserve error type", async () => {
    type AppError = "NOT_FOUND" | "FETCH_ERROR" | "UNEXPECTED";

    const result = await run.strict<
      { user: { id: string; name: string }; posts: string[] },
      AppError
    >(
      async (step) => {
        const user = await step(() => fetchUser("unknown")); // Will fail
        const posts = await step(() => fetchPosts(user.id));
        return { user, posts };
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    if (isErr(result)) {
      // Error type is exactly our closed union
      const error: AppError = result.error;
      expect(error).toBe("NOT_FOUND");
    }
  });

  it("works with standard if/else pattern", () => {
    const result: Result<number, string> = ok(42);

    // Standard JS pattern - no special methods needed
    if (result.ok) {
      expect(result.value).toBe(42);
    } else {
      expect.fail("should be ok");
    }
  });

  it("integrates with existing try/catch code", async () => {
    const legacyApi = async () => {
      throw new Error("legacy error");
    };

    const result = await fromPromise(legacyApi(), (cause) =>
      cause instanceof Error ? cause.message : "UNKNOWN"
    );

    if (isErr(result)) {
      expect(result.error).toBe("legacy error");
    }
  });
});

// ======================= New Utility Tests =======================

describe("tryAsync() - safer async wrapping", () => {
  it("returns ok for successful async function", async () => {
    const result = await tryAsync(async () => {
      return 42;
    });

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("catches async errors with default unknown type", async () => {
    const result = await tryAsync(async () => {
      throw new Error("async failure");
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe("async failure");
    }
  });

  it("maps errors with custom mapper", async () => {
    const result = await tryAsync(
      async () => {
        throw new Error("async failure");
      },
      (cause) => ({ code: "ASYNC_ERROR", message: String(cause) })
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("ASYNC_ERROR");
    }
  });

  it("catches sync throws during promise creation (better than fromPromise)", async () => {
    // This is the key difference from fromPromise - it catches sync throws
    const badAsyncFn = (): Promise<number> => {
      throw new Error("sync throw before promise");
    };

    const result = await tryAsync(badAsyncFn);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect((result.error as Error).message).toBe("sync throw before promise");
    }
  });

  it("preserves cause", async () => {
    const originalError = new Error("original");
    const result = await tryAsync(
      async () => {
        throw originalError;
      },
      (cause) => "MAPPED_ERROR"
    );

    if (isErr(result)) {
      expect(result.error).toBe("MAPPED_ERROR");
      expect(result.cause).toBe(originalError);
    }
  });
});

describe("mapTry() - transform that might throw", () => {
  it("transforms ok value successfully", () => {
    const result = mapTry(
      ok(5),
      (n) => n * 2,
      (cause) => "TRANSFORM_ERROR"
    );

    expect(result).toEqual({ ok: true, value: 10 });
  });

  it("passes through err without transformation", () => {
    const result = mapTry(
      err("ORIGINAL_ERROR") as Result<number, string>,
      (n) => n * 2,
      (cause) => "TRANSFORM_ERROR"
    );

    expect(result).toEqual({ ok: false, error: "ORIGINAL_ERROR" });
  });

  it("catches throwing transform and maps error", () => {
    const result = mapTry(
      ok(5),
      (n) => {
        throw new Error("transform failed");
      },
      (cause) => "CAUGHT_ERROR"
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("CAUGHT_ERROR");
      expect(result.cause).toBeInstanceOf(Error);
    }
  });

  it("combines error types in union", () => {
    const result = mapTry(
      ok(5) as Result<number, "ORIGINAL">,
      (n) => {
        if (n > 10) throw new Error("too big");
        return n * 2;
      },
      (cause) => "TRANSFORM_ERROR" as const
    );

    // Type should be Result<number, "ORIGINAL" | "TRANSFORM_ERROR">
    if (isErr(result)) {
      const error: "ORIGINAL" | "TRANSFORM_ERROR" = result.error;
    }
  });
});

describe("mapErrorTry() - error transform that might throw", () => {
  it("passes through ok without transformation", () => {
    const result = mapErrorTry(
      ok(42),
      (e) => "TRANSFORMED",
      (cause) => "CAUGHT"
    );

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("transforms error successfully", () => {
    const result = mapErrorTry(
      err("ORIGINAL") as Result<number, string>,
      (e) => ({ code: e, severity: "high" }),
      (cause) => ({ code: "UNKNOWN", severity: "critical" })
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "ORIGINAL", severity: "high" },
    });
  });

  it("catches throwing error transform", () => {
    const result = mapErrorTry(
      err("ORIGINAL") as Result<number, string>,
      (e) => {
        throw new Error("transform failed");
      },
      (cause) => "CAUGHT_ERROR"
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("CAUGHT_ERROR");
    }
  });
});

describe("allAsync() - mixed sync/async results", () => {
  it("combines sync and async results", async () => {
    const asyncOk = async () => ok(42);

    const result = await allAsync([ok(1), asyncOk(), ok("three")] );

    expect(result).toEqual({ ok: true, value: [1, 42, "three"] });
  });

  it("returns first error from mixed inputs", async () => {
    const asyncErr = async () => err("ASYNC_ERROR");

    const result = await allAsync([ok(1), asyncErr(), ok(3)]);

    expect(result).toEqual({ ok: false, error: "ASYNC_ERROR" });
  });

  it("handles all async results", async () => {
    const fetch1 = async () => ok(1);
    const fetch2 = async () => ok(2);
    const fetch3 = async () => ok(3);

    const result = await allAsync([fetch1(), fetch2(), fetch3()]);

    expect(result).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it("preserves tuple types with ", async () => {
    const result = await allAsync([
      ok(42),
      Promise.resolve(ok("hello")),
      ok(true),
    ] );

    if (isOk(result)) {
      const [num, str, bool] = result.value;
      const _n: number = num;
      const _s: string = str;
      const _b: boolean = bool;
    }
  });

  it("returns PromiseRejectedError when a promise rejects", async () => {
    const rejectingPromise = Promise.reject(new Error("Network failure"));

    const result = await allAsync([
      ok(1),
      rejectingPromise as Promise<Result<number, string>>,
      ok(3),
    ]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        type: "PROMISE_REJECTED",
        cause: expect.any(Error),
      });
    }
  });

  it("short-circuits on first promise rejection", async () => {
    let secondCalled = false;
    const firstReject = Promise.reject(new Error("first"));
    const secondPromise = new Promise<Result<number, string>>((resolve) => {
      secondCalled = true;
      resolve(ok(2));
    });

    const result = await allAsync([
      firstReject as Promise<Result<number, string>>,
      secondPromise,
    ]);

    expect(isErr(result)).toBe(true);
    // Note: Due to Promise.all behavior, both promises start immediately
    // but we return the first rejection error
    if (isErr(result)) {
      expect((result.error as PromiseRejectedError).type).toBe("PROMISE_REJECTED");
    }
  });
});

describe("anyAsync() - mixed sync/async results", () => {
  it("returns first ok from mixed inputs", async () => {
    const asyncOk = async () => ok(42);

    const result = await anyAsync([err("first"), asyncOk(), ok(100)]);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("returns error when all fail", async () => {
    const asyncErr = async () => err("ASYNC_ERROR");

    const result = await anyAsync([err("FIRST"), asyncErr(), err("THIRD")]);

    expect(isErr(result)).toBe(true);
  });

  it("returns empty input error for empty array", async () => {
    const result = await anyAsync([]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual({
        type: "EMPTY_INPUT",
        message: "anyAsync() requires at least one Result",
      });
    }
  });

  it("returns early on first success without waiting for slow promises", async () => {
    let slowResolved = false;
    const slowPromise = new Promise<Result<number, string>>((resolve) => {
      setTimeout(() => {
        slowResolved = true;
        resolve(ok(999));
      }, 1000);
    });

    const start = Date.now();
    const result = await anyAsync([
      err("first"),
      Promise.resolve(ok(42)), // This should return immediately
      slowPromise,
    ]);
    const elapsed = Date.now() - start;

    expect(result).toEqual({ ok: true, value: 42 });
    expect(elapsed).toBeLessThan(100); // Should return quickly, not wait 1000ms
    expect(slowResolved).toBe(false); // Slow promise hasn't resolved yet
  });

  it("observes all promises to prevent unhandled rejections", async () => {
    // This test verifies no UnhandledPromiseRejection is emitted
    const rejectingPromise = Promise.reject(new Error("late rejection"));

    const result = await anyAsync([
      ok(42), // Returns immediately
      rejectingPromise as Promise<Result<number, string>>,
    ]);

    expect(result).toEqual({ ok: true, value: 42 });
    // The rejecting promise is observed via .catch(), so no unhandled rejection
  });

  it("races promises - slow first does not block fast second", async () => {
    // This is the key race test: slow promise is FIRST but fast promise is SECOND
    const slowPromise = new Promise<Result<number, string>>((resolve) => {
      setTimeout(() => resolve(ok(1)), 1000);
    });
    const fastPromise = Promise.resolve(ok(42));

    const start = Date.now();
    const result = await anyAsync([
      slowPromise, // Slow is first in array
      fastPromise, // Fast is second
    ]);
    const elapsed = Date.now() - start;

    // Should return fast result immediately, not wait for slow
    expect(result).toEqual({ ok: true, value: 42 });
    expect(elapsed).toBeLessThan(100);
  });

  it("handles never-settling promise when another succeeds", async () => {
    const neverSettles = new Promise<Result<number, string>>(() => {});
    const fast = Promise.resolve(ok(42));

    const start = Date.now();
    const result = await anyAsync([neverSettles, fast]);
    const elapsed = Date.now() - start;

    expect(result).toEqual({ ok: true, value: 42 });
    expect(elapsed).toBeLessThan(100);
  });
});

describe("andThen() - flatMap/chain", () => {
  it("chains successful results", () => {
    const result = andThen(ok(5), (n) => ok(n * 2));
    expect(result).toEqual({ ok: true, value: 10 });
  });

  it("passes through err without calling next", () => {
    let called = false;
    const result = andThen(err("ORIGINAL") as Result<number, string>, (_n) => {
      called = true;
      return ok(42);
    });

    expect(isErr(result)).toBe(true);
    expect(called).toBe(false);
    if (isErr(result)) {
      expect(result.error).toBe("ORIGINAL");
    }
  });

  it("chains to an err result", () => {
    const result = andThen(
      ok(5),
      (_n) => err("FAILED") as Result<number, string>
    );
    expect(result).toEqual({ ok: false, error: "FAILED" });
  });

  it("combines error types in union", () => {
    const first = ok(5) as Result<number, "A">;
    const result = andThen(first, (n) =>
      n > 10 ? err("B" as const) : ok(n * 2)
    );

    // Type is Result<number, "A" | "B">
    if (isErr(result)) {
      const error: "A" | "B" = result.error;
    }
  });
});

describe("tap() - side effects on ok", () => {
  it("executes side effect for ok result", () => {
    let captured: number | null = null;
    const result = tap(ok(42), (n) => {
      captured = n;
    });

    expect(captured).toBe(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("does not execute side effect for err result", () => {
    let called = false;
    const result = tap(err("FAILED") as Result<number, string>, (_n) => {
      called = true;
    });

    expect(called).toBe(false);
    expect(isErr(result)).toBe(true);
  });

  it("returns the same result (useful for chaining)", () => {
    const original = ok({ id: 1, name: "Alice" });
    const result = tap(original, () => void 0); // No-op side effect

    expect(result).toBe(original); // Same reference
  });
});

describe("tapError() - side effects on err", () => {
  it("executes side effect for err result", () => {
    let captured: string | null = null;
    const result = tapError(
      err("FAILED") as Result<number, string>,
      (error) => {
        captured = error;
      }
    );

    expect(captured).toBe("FAILED");
    expect(isErr(result)).toBe(true);
  });

  it("receives cause in callback", () => {
    const originalCause = new Error("root");
    let receivedCause: unknown = null;

    tapError(
      err("FAILED", { cause: originalCause }) as Result<number, string>,
      (_error, cause) => {
        receivedCause = cause;
      }
    );

    expect(receivedCause).toBe(originalCause);
  });

  it("does not execute side effect for ok result", () => {
    let called = false;
    const result = tapError(ok(42), (_error) => {
      called = true;
    });

    expect(called).toBe(false);
    expect(result).toEqual({ ok: true, value: 42 });
  });
});

describe("step() overload ambiguity regression test", () => {
  it("step() correctly handles AsyncResult without needing mapError", async () => {
    // This is the key regression test - ensure AsyncResult-returning functions
    // work with step() without TS selecting the wrong overload
    const fetchUser = async (): AsyncResult<number, "NOPE"> => err("NOPE");

    const result = await run<number, "NOPE">(
      async (step) => {
        await step(() => fetchUser()); // Should compile without mapError
        return 1;
      },
      { onError: () => {} }
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe("NOPE");
    }
  });

  it("step() works with sync Result-returning functions", async () => {
    const validate = (): Result<number, "INVALID"> => err("INVALID");

    const result = await run<number, "INVALID">(
      async (step) => {
        await step(() => validate());
        return 1;
      },
      { onError: () => {} }
    );

    expect(isErr(result)).toBe(true);
  });

  it("step.try() is clearly separate from step()", async () => {
    // This test ensures the two methods don't get confused
    const result = await run<string, "NETWORK" | "PARSE">(
      async (step) => {
        // Result-returning: use step()
        const data = await step(
          () => ok({ raw: '{"x":1}' }) as Result<{ raw: string }, "NETWORK">
        );

        // Throwing operation: use step.try()
        const parsed = await step.try(
          () => JSON.parse(data.raw) as { x: number },
          { onError: () => "PARSE"  }
        );

        return `Got ${parsed.x}`;
      },
      { onError: () => {} }
    );

    expect(result).toEqual({ ok: true, value: "Got 1" });
  });
});

// ======================= New Utilities Tests =======================

describe("allSettled() - collect all results", () => {
  it("returns all values when all succeed", () => {
    const result = allSettled([ok(1), ok(2), ok(3)]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  it("returns all errors when any fail (preserving cause)", () => {
    const result = allSettled([ok(1), err("A"), ok(3), err("B")]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual([
        { error: "A", cause: undefined },
        { error: "B", cause: undefined },
      ]);
    }
  });

  it("preserves tuple types", () => {
    const result = allSettled([ok(1), ok("two"), ok(true)] );

    if (isOk(result)) {
      const [n, s, b] = result.value;
      expect(n).toBe(1);
      expect(s).toBe("two");
      expect(b).toBe(true);
    }
  });

  it("returns empty array for empty input", () => {
    const result = allSettled([]);
    expect(result).toEqual({ ok: true, value: [] });
  });
});

describe("allSettledAsync() - async version", () => {
  it("collects all async results", async () => {
    const result = await allSettledAsync([
      Promise.resolve(ok(1)),
      Promise.resolve(ok(2)),
    ]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2]);
    }
  });

  it("collects all errors from async results (preserving cause)", async () => {
    const result = await allSettledAsync([
      Promise.resolve(ok(1)),
      Promise.resolve(err("A")),
      Promise.resolve(err("B")),
    ]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toEqual([
        { error: "A", cause: undefined },
        { error: "B", cause: undefined },
      ]);
    }
  });

  it("handles promise rejections gracefully (wrapped in SettledError)", async () => {
    const result = await allSettledAsync([
      Promise.resolve(ok(1)),
      Promise.reject(new Error("network error")),
    ]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toHaveLength(1);
      // SettledError wraps the PromiseRejectedError and includes PromiseRejectionCause
      expect(result.error[0]).toMatchObject({
        error: { type: "PROMISE_REJECTED" },
        cause: { type: "PROMISE_REJECTION", reason: expect.any(Error) },
      });
    }
  });
});

describe("partition() - split results", () => {
  it("splits into values and errors", () => {
    const results = [ok(1), err("a"), ok(2), err("b")];
    const { values, errors } = partition(results);

    expect(values).toEqual([1, 2]);
    expect(errors).toEqual(["a", "b"]);
  });

  it("returns empty arrays for empty input", () => {
    const { values, errors } = partition([]);

    expect(values).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("handles all ok results", () => {
    const { values, errors } = partition([ok(1), ok(2), ok(3)]);

    expect(values).toEqual([1, 2, 3]);
    expect(errors).toEqual([]);
  });

  it("handles all err results", () => {
    const { values, errors } = partition([err("a"), err("b")]);

    expect(values).toEqual([]);
    expect(errors).toEqual(["a", "b"]);
  });
});

describe("fromNullable() - convert nullable", () => {
  it("returns ok for non-null value", () => {
    const result = fromNullable("hello", () => "NULL_ERROR" );

    expect(result).toEqual({ ok: true, value: "hello" });
  });

  it("returns err for null", () => {
    const result = fromNullable(null, () => "NULL_ERROR" );

    expect(result).toEqual({ ok: false, error: "NULL_ERROR" });
  });

  it("returns err for undefined", () => {
    const result = fromNullable(undefined, () => "UNDEFINED_ERROR" );

    expect(result).toEqual({ ok: false, error: "UNDEFINED_ERROR" });
  });

  it("preserves falsy non-null values", () => {
    expect(fromNullable(0, () => "ERR")).toEqual({ ok: true, value: 0 });
    expect(fromNullable("", () => "ERR")).toEqual({ ok: true, value: "" });
    expect(fromNullable(false, () => "ERR")).toEqual({ ok: true, value: false });
  });

  it("calls onNull lazily", () => {
    const onNull = vi.fn(() => "ERR");

    fromNullable("value", onNull);
    expect(onNull).not.toHaveBeenCalled();

    fromNullable(null, onNull);
    expect(onNull).toHaveBeenCalledTimes(1);
  });
});

describe("Type safety for new error types", () => {
  it("allAsync includes PromiseRejectedError in error type", async () => {
    const result = await allAsync([Promise.resolve(ok(1))]);

    // This should compile - error type includes PromiseRejectedError
    if (isErr(result)) {
      const _e: { type: "PROMISE_REJECTED"; cause: unknown } | never =
        result.error;
      expect(_e).toBeDefined();
    }
  });

  it("anyAsync includes PromiseRejectedError in error type", async () => {
    const result = await anyAsync([Promise.resolve(ok(1))]);

    // This should compile - error type includes PromiseRejectedError
    if (isErr(result)) {
      const _e:
        | { type: "PROMISE_REJECTED"; cause: unknown }
        | { type: "EMPTY_INPUT"; message: string }
        | never = result.error;
      expect(_e).toBeDefined();
    }
  });

  it("run without explicit types returns UnexpectedError", async () => {
    const result = await run(async () => 42);

    // Without explicit types, error is UnexpectedError (safe default)
    // For typed errors, use run<T, E>(fn, { onError })
    if (isErr(result)) {
      const _e: UnexpectedError = result.error;
      expect(_e).toBeDefined();
    }
  });
});

// =============================================================================
// NEW FEATURES: step(result), run.strict()
// =============================================================================

describe("step() direct Result support", () => {
  it("accepts direct Result instead of function", async () => {
    const fetchUser = async (): AsyncResult<
      { id: string; name: string },
      "NOT_FOUND"
    > => ok({ id: "1", name: "Alice" });

    const result = await run(async (step) => {
      // Direct Result form - no wrapper function needed
      const user = await step(fetchUser());
      return user;
    });

    expect(result).toEqual({
      ok: true,
      value: { id: "1", name: "Alice" },
    });
  });

  it("accepts direct sync Result", async () => {
    const validate = (): Result<number, "INVALID"> => ok(42);

    const result = await run(async (step) => {
      const value = await step(validate());
      return value;
    });

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("handles direct Result errors correctly", async () => {
    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> =>
      err("NOT_FOUND");

    const result = await run(
      async (step) => {
        await step(fetchUser());
        return 1;
      },
      { onError: () => {} } // Use onError for typed errors
    );

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("still supports function form (backwards compatible)", async () => {
    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> => ok(42);

    const result = await run(async (step) => {
      // Function form still works
      const value = await step(() => fetchUser());
      return value;
    });

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("can mix direct and function forms", async () => {
    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> => ok(1);
    const fetchPosts = async (): AsyncResult<number, "FETCH_ERROR"> => ok(2);

    const result = await run(async (step) => {
      const user = await step(fetchUser()); // Direct
      const posts = await step(() => fetchPosts()); // Function
      return user + posts;
    });

    expect(result).toEqual({ ok: true, value: 3 });
  });
});

describe("run() safe default ergonomics", () => {
  it("preserves step error details inside UnexpectedError cause", async () => {
    const failure = { code: "NOT_FOUND" } ;

    const result = await run(async (step) => {
      await step(() => err(failure), "failingStep");
      return "unreachable";
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UNEXPECTED_ERROR");
      expect(result.error.cause).toEqual({
        type: "STEP_FAILURE",
        origin: "result",
        error: failure,
      });
    }
  });

  it("preserves step.try mapped errors and thrown causes", async () => {
    const boom = new Error("boom");

    const result = await run(async (step) => {
      await step.try(
        () => {
          throw boom;
        },
        { error: { type: "NETWORK"  }, name: "networkCall" }
      );
      return "unreachable";
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UNEXPECTED_ERROR");
      expect(result.error.cause).toMatchObject({
        type: "STEP_FAILURE",
        origin: "throw",
        error: { type: "NETWORK" },
      });
      expect(
        result.error.cause &&
          typeof result.error.cause === "object" &&
          "thrown" in result.error.cause
      ).toBe(true);
      if (
        result.error.cause &&
        typeof result.error.cause === "object" &&
        "thrown" in result.error.cause
      ) {
        expect(
          (result.error.cause as { thrown?: unknown }).thrown
        ).toBe(boom);
      }
    }
  });
});

describe("onEvent (Phase 1 event stream)", () => {
  it("emits step_start and step_success events for each step", async () => {
    const events: WorkflowEvent<unknown>[] = [];

    await run(
      async (step) => {
        await step(() => ok(1), { name: "step1" });
        await step(() => ok(2), { name: "step2" });
        return 42;
      },
      {
        onEvent: (event) => events.push(event),
      }
    );

    // run() emits 4 step events: step_start + step_success for each of 2 steps
    expect(events).toHaveLength(4);

    // Verify step_start is first for step1
    expect(events[0]).toMatchObject({ type: "step_start", name: "step1" });

    // All events should have same workflowId
    const workflowId = events[0].workflowId;
    expect(events.every((e) => e.workflowId === workflowId)).toBe(true);

    // Verify we have step_start and step_success pairs
    expect(events.filter((e) => e.type === "step_start")).toHaveLength(2);
    expect(events.filter((e) => e.type === "step_success")).toHaveLength(2);
  });

  it("emits step_error on failure", async () => {
    const events: WorkflowEvent<string | UnexpectedError>[] = [];

    await run<number, "FAIL">(
      async (step) => {
        await step(() => err("FAIL"), { name: "failStep" });
        return 42;
      },
      {
        onError: () => {},
        onEvent: (event) => events.push(event),
      }
    );

    const stepError = events.find((e) => e.type === "step_error");
    expect(stepError).toBeDefined();
    expect(stepError).toMatchObject({
      type: "step_error",
      name: "failStep",
      error: "FAIL",
    });
  });

  it("supports step options object with key", async () => {
    const events: WorkflowEvent<unknown>[] = [];

    await run(
      async (step) => {
        await step(() => ok(1), { name: "loadUser", key: "user:123" });
        return 1;
      },
      {
        onEvent: (event) => events.push(event),
      }
    );

    const stepStart = events.find((e) => e.type === "step_start");
    expect(stepStart).toMatchObject({
      type: "step_start",
      name: "loadUser",
      stepKey: "user:123",
    });
  });

  it("supports string shorthand for step name", async () => {
    const events: WorkflowEvent<unknown>[] = [];

    await run(
      async (step) => {
        await step(() => ok(1), "myStep");
        return 1;
      },
      {
        onEvent: (event) => events.push(event),
      }
    );

    const stepStart = events.find((e) => e.type === "step_start");
    expect(stepStart).toMatchObject({
      type: "step_start",
      name: "myStep",
    });
  });

  it("step.try emits events with name and key", async () => {
    const events: WorkflowEvent<string | UnexpectedError>[] = [];

    await run<number, "ERR">(
      async (step) => {
        await step.try(() => 42, { error: "ERR", name: "tryStep", key: "try:1" });
        return 1;
      },
      {
        onError: () => {},
        onEvent: (event) => events.push(event),
      }
    );

    const stepStart = events.find((e) => e.type === "step_start");
    expect(stepStart).toMatchObject({
      type: "step_start",
      name: "tryStep",
      stepKey: "try:1",
    });
  });
});

describe("createWorkflow with onEvent and createContext", () => {
  it("emits workflow lifecycle events", async () => {
    const events: WorkflowEvent<string | UnexpectedError>[] = [];
    const fetchData = async (): AsyncResult<number, "FETCH_ERROR"> => ok(42);

    const workflow = createWorkflow(
      { fetchData },
      {
        onEvent: (event) => events.push(event),
      }
    );

    await workflow(async (step) => {
      await step(fetchData());
      return "done";
    });

    // Should have workflow_start and workflow_success
    expect(events.some((e) => e.type === "workflow_start")).toBe(true);
    expect(events.some((e) => e.type === "workflow_success")).toBe(true);

    // All events should share workflowId
    const workflowId = events[0].workflowId;
    expect(events.every((e) => e.workflowId === workflowId)).toBe(true);
  });

  it("emits workflow_error on failure", async () => {
    const events: WorkflowEvent<string | UnexpectedError>[] = [];
    const failingFn = async (): AsyncResult<number, "FAIL"> => err("FAIL");

    const workflow = createWorkflow(
      { failingFn },
      {
        onEvent: (event) => events.push(event),
      }
    );

    await workflow(async (step) => {
      await step(failingFn());
      return "done";
    });

    const workflowError = events.find((e) => e.type === "workflow_error");
    expect(workflowError).toBeDefined();
    expect(workflowError?.type).toBe("workflow_error");
    if (workflowError?.type === "workflow_error") {
      expect(workflowError.error).toBe("FAIL");
    }
  });

  it("calls createContext and passes context to onEvent", async () => {
    type Context = { requestId: string; count: number };
    const events: Array<{ event: WorkflowEvent<unknown>; ctx: Context }> = [];
    let contextCalls = 0;

    const fetchData = async (): AsyncResult<number, never> => ok(42);

    const workflow = createWorkflow(
      { fetchData },
      {
        createContext: () => {
          contextCalls++;
          return { requestId: "req-123", count: contextCalls };
        },
        onEvent: (event, ctx) => events.push({ event, ctx }),
      }
    );

    await workflow(async (step) => {
      await step(fetchData());
      return "done";
    });

    // createContext should be called once per workflow invocation
    expect(contextCalls).toBe(1);

    // All events should receive the same context
    expect(events.every((e) => e.ctx.requestId === "req-123")).toBe(true);
    expect(events.every((e) => e.ctx.count === 1)).toBe(true);
  });

  it("creates fresh context for each workflow invocation", async () => {
    let counter = 0;
    const contexts: number[] = [];

    const fetchData = async (): AsyncResult<number, never> => ok(42);

    const workflow = createWorkflow(
      { fetchData },
      {
        createContext: () => {
          counter++;
          return counter;
        },
        onEvent: (_, ctx) => contexts.push(ctx),
      }
    );

    await workflow(async (step) => step(fetchData()));
    await workflow(async (step) => step(fetchData()));

    // Should see context values 1 and 2 from different runs
    expect(contexts).toContain(1);
    expect(contexts).toContain(2);
  });

  it("events include timestamps and durations", async () => {
    const events: WorkflowEvent<unknown>[] = [];
    const fetchData = async (): AsyncResult<number, never> => ok(42);

    const workflow = createWorkflow(
      { fetchData },
      {
        onEvent: (event) => events.push(event),
      }
    );

    await workflow(async (step) => {
      await step(fetchData(), { name: "fetch" });
      return "done";
    });

    // All events should have ts
    expect(events.every((e) => typeof e.ts === "number")).toBe(true);

    // Completion events should have durationMs
    const stepSuccess = events.find((e) => e.type === "step_success");
    const workflowSuccess = events.find((e) => e.type === "workflow_success");

    expect(stepSuccess && "durationMs" in stepSuccess).toBe(true);
    expect(workflowSuccess && "durationMs" in workflowSuccess).toBe(true);
  });
});

describe("run.strict()", () => {
  it("returns exact error type without UnexpectedError", async () => {
    type AppError = "NOT_FOUND" | "FETCH_ERROR" | "UNEXPECTED";

    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> => ok(42);

    const result = await run.strict<number, AppError>(
      async (step) => {
        return await step(() => fetchUser());
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(result).toEqual({ ok: true, value: 42 });

    // Type test: error should be exactly AppError
    if (!result.ok) {
      const _error: AppError = result.error;
    }
  });

  it("handles errors correctly in strict mode", async () => {
    type AppError = "NOT_FOUND" | "UNEXPECTED";

    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> =>
      err("NOT_FOUND");

    const result = await run.strict<number, AppError>(
      async (step) => {
        return await step(() => fetchUser());
      },
      { catchUnexpected: () => "UNEXPECTED" }
    );

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("works with step.try()", async () => {
    type AppError = "NETWORK" | "UNEXPECTED";

    const result = await run.strict<number, AppError>(
      async (step) => {
        return await step.try(() => 42, { error: "NETWORK"  });
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("maps unexpected exceptions via catchUnexpected", async () => {
    type AppError = "NOT_FOUND" | "UNEXPECTED";

    const result = await run.strict<number, AppError>(
      async () => {
        throw new Error("bug in your code");
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    // Unexpected errors are mapped to our domain type, not thrown
    expect(result).toEqual({
      ok: false,
      error: "UNEXPECTED",
      cause: expect.any(Error),
    });
  });

  it("still returns domain errors correctly", async () => {
    type AppError = "NOT_FOUND" | "UNEXPECTED";

    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> =>
      err("NOT_FOUND");

    const result = await run.strict<number, AppError>(
      async (step) => {
        return await step(fetchUser());
      },
      { catchUnexpected: () => "UNEXPECTED"  }
    );

    // Domain errors return as Results
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("supports onError callback", async () => {
    type AppError = "NOT_FOUND" | "UNEXPECTED";
    const onError = vi.fn();

    const fetchUser = async (): AsyncResult<number, "NOT_FOUND"> =>
      err("NOT_FOUND");

    await run.strict<number, AppError>(
      async (step) => {
        return await step(fetchUser());
      },
      { onError, catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(onError).toHaveBeenCalledWith("NOT_FOUND", undefined);
  });

  it("calls onError for unexpected exceptions too", async () => {
    type AppError = "UNEXPECTED";
    const onError = vi.fn();

    await run.strict<number, AppError>(
      async () => {
        throw new Error("oops");
      },
      { onError, catchUnexpected: () => "UNEXPECTED"  }
    );

    expect(onError).toHaveBeenCalledWith("UNEXPECTED", "unexpected");
  });

  it("lets catchUnexpected errors propagate - maintains type contract", async () => {
    // If catchUnexpected itself throws, we let it propagate.
    // This maintains the strict mode contract: AsyncResult<T, E> with no UnexpectedError.
    // A buggy mapper is the user's responsibility.

    await expect(
      run.strict<number, "MAPPED">(
        async () => {
          throw new Error("original error");
        },
        {
          catchUnexpected: () => {
            throw new Error("bug in error mapper");
          },
        }
      )
    ).rejects.toThrow("bug in error mapper");
  });
});

// =============================================================================
// createWorkflow() Tests
// =============================================================================

describe("createWorkflow()", () => {
  // Helper functions for testing
  const fetchUser = (id: string): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> =>
    id === "1" ? Promise.resolve(ok({ id, name: "Alice" })) : Promise.resolve(err("NOT_FOUND" as const));

  const fetchPosts = (userId: string): AsyncResult<{ id: number; title: string }[], "FETCH_ERROR"> =>
    userId === "1"
      ? Promise.resolve(ok([{ id: 1, title: "Hello World" }]))
      : Promise.resolve(err("FETCH_ERROR" as const));

  describe("basic usage", () => {
    it("returns ok result when all steps succeed", async () => {
      const getPosts = createWorkflow({ fetchUser, fetchPosts });

      const result = await getPosts(async (step) => {
        const user = await step(fetchUser("1"));
        const posts = await step(fetchPosts(user.id));
        return { user, posts };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.user.name).toBe("Alice");
        expect(result.value.posts).toHaveLength(1);
      }
    });

    it("returns error when step fails", async () => {
      const getPosts = createWorkflow({ fetchUser, fetchPosts });

      const result = await getPosts(async (step) => {
        const user = await step(fetchUser("999")); // Will fail
        return user;
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("NOT_FOUND");
      }
    });

    it("short-circuits on first error", async () => {
      const getPosts = createWorkflow({ fetchUser, fetchPosts });
      const fetchPostsCalled = vi.fn();

      const result = await getPosts(async (step) => {
        const user = await step(fetchUser("999")); // Will fail
        fetchPostsCalled();
        const posts = await step(fetchPosts(user.id));
        return { user, posts };
      });

      expect(result.ok).toBe(false);
      expect(fetchPostsCalled).not.toHaveBeenCalled();
    });
  });

  describe("deps object in callback", () => {
    it("passes deps object as second argument for destructuring", async () => {
      const getPosts = createWorkflow({ fetchUser, fetchPosts });

      const result = await getPosts(async (step, deps) => {
        expect(deps.fetchUser).toBe(fetchUser);
        expect(deps.fetchPosts).toBe(fetchPosts);
        const user = await step(deps.fetchUser("1"));
        return user;
      });

      expect(result.ok).toBe(true);
    });

    it("allows destructuring deps in callback", async () => {
      const getPosts = createWorkflow({ fetchUser, fetchPosts });

      const result = await getPosts(async (step, { fetchUser: fu, fetchPosts: fp }) => {
        const user = await step(fu("1"));
        const posts = await step(fp(user.id));
        return { user, posts };
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("options", () => {
    it("calls onError when step fails", async () => {
      const onError = vi.fn();
      const getPosts = createWorkflow({ fetchUser }, { onError });

      await getPosts(async (step) => {
        return await step(fetchUser("999"));
      });

      expect(onError).toHaveBeenCalledWith("NOT_FOUND", undefined);
    });
  });

  describe("strict mode", () => {
    it("uses run.strict internally with catchUnexpected", async () => {
      const getPosts = createWorkflow(
        { fetchUser },
        {
          strict: true,
          catchUnexpected: () => "UNEXPECTED" as const,
        }
      );

      // Normal error
      const result1 = await getPosts(async (step) => {
        return await step(fetchUser("999"));
      });
      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error).toBe("NOT_FOUND");
      }

      // Unexpected exception gets mapped
      const result2 = await getPosts(async () => {
        throw new Error("unexpected");
      });
      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        expect(result2.error).toBe("UNEXPECTED");
      }
    });

    it("calls onError in strict mode", async () => {
      const onError = vi.fn();
      const getPosts = createWorkflow(
        { fetchUser },
        {
          strict: true,
          catchUnexpected: () => "UNEXPECTED" as const,
          onError,
        }
      );

      await getPosts(async (step) => {
        return await step(fetchUser("999"));
      });

      expect(onError).toHaveBeenCalledWith("NOT_FOUND", undefined);
    });
  });

  describe("workflow reuse", () => {
    it("can be called multiple times", async () => {
      const getPosts = createWorkflow({ fetchUser, fetchPosts });

      const result1 = await getPosts(async (step) => {
        return await step(fetchUser("1"));
      });

      const result2 = await getPosts(async (step) => {
        return await step(fetchUser("999"));
      });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(false);
    });
  });

  describe("step caching", () => {
    it("caches step results when key is provided (lazy form)", async () => {
      let callCount = 0;
      const expensiveOp = async (id: string): AsyncResult<{ id: string }, "ERROR"> => {
        callCount++;
        return ok({ id });
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({ expensiveOp }, { cache });

      // Use lazy form: step(() => expensiveOp(...)) to enable caching
      const result = await workflow(async (step) => {
        const first = await step(() => expensiveOp("123"), { key: "op:123" });
        const second = await step(() => expensiveOp("123"), { key: "op:123" });
        return { first, second };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.first).toEqual({ id: "123" });
        expect(result.value.second).toEqual({ id: "123" });
      }
      // Should only call the operation once due to caching
      expect(callCount).toBe(1);
      expect(cache.size).toBe(1);
    });

    it("does not cache when key is not provided", async () => {
      let callCount = 0;
      const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
        callCount++;
        return ok(callCount);
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({ expensiveOp }, { cache });

      const result = await workflow(async (step) => {
        const first = await step(() => expensiveOp());
        const second = await step(() => expensiveOp());
        return { first, second };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.first).toBe(1);
        expect(result.value.second).toBe(2);
      }
      expect(callCount).toBe(2);
      expect(cache.size).toBe(0);
    });

    it("cache persists across workflow runs", async () => {
      let callCount = 0;
      const expensiveOp = async (id: string): AsyncResult<{ id: string; count: number }, "ERROR"> => {
        callCount++;
        return ok({ id, count: callCount });
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({ expensiveOp }, { cache });

      // First run - use lazy form for caching
      const result1 = await workflow(async (step) => {
        return await step(() => expensiveOp("123"), { key: "op:123" });
      });

      // Second run - should use cache
      const result2 = await workflow(async (step) => {
        return await step(() => expensiveOp("123"), { key: "op:123" });
      });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        expect(result1.value.count).toBe(1);
        expect(result2.value.count).toBe(1); // Same cached value
      }
      expect(callCount).toBe(1);
    });

    it("emits step_cache_hit and step_cache_miss events", async () => {
      const events: WorkflowEvent<unknown>[] = [];
      const expensiveOp = async (): AsyncResult<number, "ERROR"> => ok(42);

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow(
        { expensiveOp },
        {
          cache,
          onEvent: (event) => events.push(event),
        }
      );

      await workflow(async (step) => {
        const first = await step(() => expensiveOp(), { key: "op:1", name: "firstCall" });
        const second = await step(() => expensiveOp(), { key: "op:1", name: "secondCall" });
        return { first, second };
      });

      const cacheEvents = events.filter(
        (e) => e.type === "step_cache_hit" || e.type === "step_cache_miss"
      );

      expect(cacheEvents).toHaveLength(2);
      expect(cacheEvents[0]).toMatchObject({
        type: "step_cache_miss",
        stepKey: "op:1",
        name: "firstCall",
      });
      expect(cacheEvents[1]).toMatchObject({
        type: "step_cache_hit",
        stepKey: "op:1",
        name: "secondCall",
      });
    });

    it("caches step.try results when key is provided", async () => {
      let callCount = 0;

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({}, { cache });

      const result = await workflow(async (step) => {
        const first = await step.try(
          () => {
            callCount++;
            return 42;
          },
          { error: "FAILED" as const, key: "try:1" }
        );
        const second = await step.try(
          () => {
            callCount++;
            return 99;
          },
          { error: "FAILED" as const, key: "try:1" }
        );
        return { first, second };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.first).toBe(42);
        expect(result.value.second).toBe(42); // Cached value
      }
      expect(callCount).toBe(1);
    });

    it("different keys cache independently", async () => {
      let callCount = 0;
      const expensiveOp = async (id: string): AsyncResult<{ id: string; order: number }, "ERROR"> => {
        callCount++;
        return ok({ id, order: callCount });
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({ expensiveOp }, { cache });

      // Use lazy form for caching
      const result = await workflow(async (step) => {
        const a = await step(() => expensiveOp("a"), { key: "op:a" });
        const b = await step(() => expensiveOp("b"), { key: "op:b" });
        const a2 = await step(() => expensiveOp("a"), { key: "op:a" });
        return { a, b, a2 };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.a.order).toBe(1);
        expect(result.value.b.order).toBe(2);
        expect(result.value.a2.order).toBe(1); // Cached
      }
      expect(callCount).toBe(2);
      expect(cache.size).toBe(2);
    });

    it("works without cache option (no caching)", async () => {
      let callCount = 0;
      const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
        callCount++;
        return ok(callCount);
      };

      const workflow = createWorkflow({ expensiveOp }); // No cache

      const result = await workflow(async (step) => {
        const first = await step(() => expensiveOp(), { key: "op:1" });
        const second = await step(() => expensiveOp(), { key: "op:1" });
        return { first, second };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.first).toBe(1);
        expect(result.value.second).toBe(2); // Not cached
      }
      expect(callCount).toBe(2);
    });

    it("works with strict mode", async () => {
      let callCount = 0;
      const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
        callCount++;
        return ok(callCount);
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow(
        { expensiveOp },
        {
          strict: true,
          catchUnexpected: () => "UNEXPECTED" as const,
          cache,
        }
      );

      // Use lazy form for caching
      const result = await workflow(async (step) => {
        const first = await step(() => expensiveOp(), { key: "op:1" });
        const second = await step(() => expensiveOp(), { key: "op:1" });
        return { first, second };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.first).toBe(1);
        expect(result.value.second).toBe(1); // Cached
      }
      expect(callCount).toBe(1);
    });

    it("eager form still works but does not prevent execution", async () => {
      // This test documents that eager form (step(promise)) runs the operation
      // before caching can intercept it. Use lazy form for caching.
      let callCount = 0;
      const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
        callCount++;
        return ok(callCount);
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({ expensiveOp }, { cache });

      const result = await workflow(async (step) => {
        // Eager form: expensiveOp() is called before step() sees it
        const first = await step(expensiveOp(), { key: "op:1" });
        const second = await step(expensiveOp(), { key: "op:1" });
        return { first, second };
      });

      expect(result.ok).toBe(true);
      // Both calls execute because the promise is created before step() runs
      expect(callCount).toBe(2);
      // But the result is still cached for future runs
      expect(cache.size).toBe(1);
    });

    it("cached error hit preserves original error and cause without replaying events", async () => {
      // Bug fix: Cache hit for errors should not replay step_start/step_error events
      // and should preserve the original error and cause
      const events: WorkflowEvent<unknown>[] = [];
      const originalCause = { detail: "original failure context" };

      const failingOp = async (): AsyncResult<number, "ORIGINAL_ERROR"> => {
        return err("ORIGINAL_ERROR" as const, { cause: originalCause });
      };

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow(
        { failingOp },
        {
          cache,
          onEvent: (event) => events.push(event),
        }
      );

      // First run - populate cache with error
      const result1 = await workflow(async (step) => {
        return await step(() => failingOp(), { key: "failing:1", name: "failingCall" });
      });

      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.cause).toEqual(originalCause);
      }

      // Clear events for second run
      events.length = 0;

      // Second run - should hit cache
      const result2 = await workflow(async (step) => {
        return await step(() => failingOp(), { key: "failing:1", name: "failingCall" });
      });

      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        // Should preserve original error and cause
        expect(result2.cause).toEqual(originalCause);
      }

      // Should only have: workflow_start, cache_hit, workflow_error
      // NOT step_start or step_error (which would indicate replaying)
      const stepStartEvents = events.filter((e) => e.type === "step_start");
      const stepErrorEvents = events.filter((e) => e.type === "step_error");
      const cacheHitEvents = events.filter((e) => e.type === "step_cache_hit");

      expect(stepStartEvents).toHaveLength(0); // No step_start on cache hit
      expect(stepErrorEvents).toHaveLength(0); // No step_error on cache hit
      expect(cacheHitEvents).toHaveLength(1); // Just cache_hit
    });

    it("cached error hit for step.try preserves error without replaying events", async () => {
      // Bug fix: step.try cache hit for errors should not fake a throw
      const events: WorkflowEvent<unknown>[] = [];

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow(
        {},
        {
          cache,
          onEvent: (event) => events.push(event),
        }
      );

      // First run - populate cache with error via step.try
      const result1 = await workflow(async (step) => {
        return await step.try(
          () => {
            throw new Error("original throw");
          },
          { error: "TRY_ERROR" as const, key: "try:1", name: "tryCall" }
        );
      });

      expect(result1.ok).toBe(false);

      // Clear events for second run
      events.length = 0;

      // Second run - should hit cache
      const result2 = await workflow(async (step) => {
        return await step.try(
          () => {
            throw new Error("should not be called");
          },
          { error: "TRY_ERROR" as const, key: "try:1", name: "tryCall" }
        );
      });

      expect(result2.ok).toBe(false);

      // Should only have: workflow_start, cache_hit, workflow_error
      const stepStartEvents = events.filter((e) => e.type === "step_start");
      const stepErrorEvents = events.filter((e) => e.type === "step_error");
      const cacheHitEvents = events.filter((e) => e.type === "step_cache_hit");

      expect(stepStartEvents).toHaveLength(0);
      expect(stepErrorEvents).toHaveLength(0);
      expect(cacheHitEvents).toHaveLength(1);
    });
  });

  describe("strict mode event type soundness", () => {
    it("step_error events use catchUnexpected for uncaught exceptions", async () => {
      // Bug fix: In strict mode, step_error events should contain the mapped error
      // from catchUnexpected, not UnexpectedError
      const events: WorkflowEvent<unknown>[] = [];

      const workflow = createWorkflow(
        {},
        {
          strict: true,
          catchUnexpected: () => "MAPPED_UNEXPECTED" as const,
          onEvent: (event) => events.push(event),
        }
      );

      const result = await workflow(async (step) => {
        // This will throw an uncaught exception in the step
        return await step.try(
          async () => {
            throw new Error("uncaught in step");
          },
          { error: "DOMAIN_ERROR" as const, name: "throwingStep" }
        );
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Result should have the domain error from step.try's error option
        expect(result.error).toBe("DOMAIN_ERROR");
      }
    });

    it("strict mode step events contain mapped errors not UnexpectedError", async () => {
      // When a step operation itself throws (not via step.try), strict mode
      // should map the error via catchUnexpected for the event
      const events: WorkflowEvent<"OP_ERROR" | "MAPPED">[] = [];

      const throwingOp = async (): AsyncResult<number, "OP_ERROR"> => {
        throw new Error("operation threw unexpectedly");
      };

      const workflow = createWorkflow(
        { throwingOp },
        {
          strict: true,
          catchUnexpected: () => "MAPPED" as const,
          onEvent: (event) => events.push(event),
        }
      );

      const result = await workflow(async (step) => {
        return await step(() => throwingOp(), { name: "throwingOp" });
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("MAPPED");
      }

      // Find the step_error event
      const stepErrorEvent = events.find((e) => e.type === "step_error");
      expect(stepErrorEvent).toBeDefined();
      if (stepErrorEvent && stepErrorEvent.type === "step_error") {
        // The error in the event should be "MAPPED", not UnexpectedError
        expect(stepErrorEvent.error).toBe("MAPPED");
      }
    });

    it("catchUnexpected is called exactly once per uncaught exception", async () => {
      // Bug fix: catchUnexpected was being called twice - once for the event and
      // once when propagating the error. Now it's called exactly once and the
      // result is reused.
      let catchCount = 0;

      const workflow = createWorkflow(
        {},
        {
          strict: true,
          catchUnexpected: () => {
            catchCount++;
            return `MAPPED_${catchCount}` as const;
          },
        }
      );

      const result = await workflow(async (step) => {
        return await step.try(
          () => {
            throw new Error("test error");
          },
          { error: "DOMAIN_ERROR" as const }
        );
      });

      expect(result.ok).toBe(false);
      // catchUnexpected is NOT called for step.try (it has its own error mapping)
      // So catchCount should be 0 in this case
      expect(catchCount).toBe(0);
    });

    it("catchUnexpected called once for uncaught step exception (not step.try)", async () => {
      // For step() with an operation that throws (not step.try), catchUnexpected
      // should be called exactly once
      let catchCount = 0;
      const mappedErrors: string[] = [];

      const throwingOp = async (): AsyncResult<number, "OP_ERROR"> => {
        throw new Error("unexpected throw");
      };

      const workflow = createWorkflow(
        { throwingOp },
        {
          strict: true,
          catchUnexpected: () => {
            catchCount++;
            const mapped = `MAPPED_${catchCount}`;
            mappedErrors.push(mapped);
            return mapped as "MAPPED_1" | "MAPPED_2";
          },
        }
      );

      const result = await workflow(async (step) => {
        return await step(() => throwingOp());
      });

      expect(result.ok).toBe(false);
      // Should be called exactly once, not twice
      expect(catchCount).toBe(1);
      if (!result.ok) {
        // The error should match what was returned by catchUnexpected
        expect(result.error).toBe("MAPPED_1");
      }
    });
  });

  describe("mapper exception propagation", () => {
    it("mapper throwing for original exception propagates (not swallowed)", async () => {
      // Bug fix: If catchUnexpected throws for the original exception but would
      // succeed for its own error, the mapper bug should still propagate.
      // Previously, the mapper's exception was caught by run()'s outer catch
      // and re-fed to catchUnexpected, masking the bug.

      const mapper = (cause: unknown) => {
        if (cause instanceof Error && cause.message === "boom") {
          throw new Error("mapper broke");
        }
        return "MAPPED" as const;
      };

      await expect(
        run.strict(
          async (step) => {
            await step(() => {
              throw new Error("boom");
            });
          },
          { catchUnexpected: mapper }
        )
      ).rejects.toThrow("mapper broke");
    });

    it("safe-default mode produces UNCAUGHT_EXCEPTION cause", async () => {
      // Bug fix: Uncaught step exceptions in safe-default mode should produce
      // UnexpectedError with cause.type = "UNCAUGHT_EXCEPTION", not "STEP_FAILURE"

      const result = await run(async (step) => {
        await step(() => {
          throw new Error("boom");
        });
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "UNEXPECTED_ERROR",
          cause: {
            type: "UNCAUGHT_EXCEPTION",
            thrown: expect.any(Error),
          },
        });
      }
    });
  });

  describe("cached step.try error metadata preservation", () => {
    it("cached step.try errors preserve origin:'throw' metadata", async () => {
      // Bug fix: Cached step.try errors were losing origin:"throw" and becoming
      // origin:"result". This broke the UnexpectedError.cause contract.

      const cache = new Map<string, Result<unknown, unknown>>();
      const workflow = createWorkflow({}, { cache });

      // First run - populate cache with step.try error
      const result1 = await workflow(async (step) => {
        return await step.try(
          () => {
            throw new Error("original throw");
          },
          { error: "TRY_ERROR" as const, key: "try:meta" }
        );
      });

      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        // First result should have origin:"throw" in its cause structure
        // The cause is the thrown error wrapped appropriately
        expect(result1.cause).toBeInstanceOf(Error);
      }

      // Second run - should hit cache and preserve metadata
      const result2 = await workflow(async (step) => {
        return await step.try(
          () => {
            throw new Error("should not be called");
          },
          { error: "TRY_ERROR" as const, key: "try:meta" }
        );
      });

      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        // Cached result should also have the original thrown error as cause
        expect(result2.cause).toBeInstanceOf(Error);
        expect((result2.cause as Error).message).toBe("original throw");
      }
    });
  });
});

// =============================================================================
// Step Complete and Resume State Tests
// =============================================================================

describe("step_complete events", () => {
  it("fires step_complete for keyed steps on success", async () => {
    const events: WorkflowEvent<unknown>[] = [];
    const fetchUser = async (id: string): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> =>
      ok({ id, name: "Alice" });

    const workflow = createWorkflow(
      { fetchUser },
      { onEvent: (event) => events.push(event) }
    );

    await workflow(async (step) => {
      return await step(() => fetchUser("123"), { key: "user:123", name: "fetchUser" });
    });

    const stepCompleteEvents = events.filter((e) => e.type === "step_complete");
    expect(stepCompleteEvents).toHaveLength(1);
    expect(stepCompleteEvents[0]).toMatchObject({
      type: "step_complete",
      stepKey: "user:123",
      name: "fetchUser",
    });
    const completeEvent = stepCompleteEvents[0] as Extract<WorkflowEvent<unknown>, { type: "step_complete" }>;
    expect(completeEvent.result).toEqual({ ok: true, value: { id: "123", name: "Alice" } });
  });

  it("fires step_complete for keyed steps on error", async () => {
    const events: WorkflowEvent<unknown>[] = [];
    const fetchUser = async (_id: string): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> =>
      err("NOT_FOUND" as const, { cause: "user does not exist" });

    const workflow = createWorkflow(
      { fetchUser },
      { onEvent: (event) => events.push(event) }
    );

    await workflow(async (step) => {
      return await step(() => fetchUser("unknown"), { key: "user:unknown", name: "fetchUser" });
    });

    const stepCompleteEvents = events.filter((e) => e.type === "step_complete");
    expect(stepCompleteEvents).toHaveLength(1);
    expect(stepCompleteEvents[0]).toMatchObject({
      type: "step_complete",
      stepKey: "user:unknown",
      name: "fetchUser",
    });
    const completeEvent = stepCompleteEvents[0] as Extract<WorkflowEvent<unknown>, { type: "step_complete" }>;
    const result = completeEvent.result;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("NOT_FOUND");
      expect(result.cause).toBe("user does not exist");
    }
  });

  it("does NOT fire step_complete for un-keyed steps", async () => {
    const events: WorkflowEvent<unknown>[] = [];
    const fetchUser = async (): AsyncResult<string, "NOT_FOUND"> => ok("Alice");

    const workflow = createWorkflow(
      { fetchUser },
      { onEvent: (event) => events.push(event) }
    );

    await workflow(async (step) => {
      // No key provided
      return await step(() => fetchUser(), { name: "fetchUser" });
    });

    const stepCompleteEvents = events.filter((e) => e.type === "step_complete");
    expect(stepCompleteEvents).toHaveLength(0);
  });

  it("fires step_complete for step.try on success", async () => {
    const events: WorkflowEvent<unknown>[] = [];

    const workflow = createWorkflow({}, { onEvent: (event) => events.push(event) });

    await workflow(async (step) => {
      return await step.try(
        () => JSON.parse('{"valid": true}'),
        { error: "PARSE_ERROR" as const, key: "parse:1", name: "parseJSON" }
      );
    });

    const stepCompleteEvents = events.filter((e) => e.type === "step_complete");
    expect(stepCompleteEvents).toHaveLength(1);
    expect(stepCompleteEvents[0]).toMatchObject({
      type: "step_complete",
      stepKey: "parse:1",
      name: "parseJSON",
    });
    const completeEvent = stepCompleteEvents[0] as Extract<WorkflowEvent<unknown>, { type: "step_complete" }>;
    expect(completeEvent.result).toEqual({ ok: true, value: { valid: true } });
  });

  it("fires step_complete for step.try on error", async () => {
    const events: WorkflowEvent<unknown>[] = [];

    const workflow = createWorkflow({}, { onEvent: (event) => events.push(event) });

    await workflow(async (step) => {
      return await step.try(
        () => JSON.parse("invalid json"),
        { error: "PARSE_ERROR" as const, key: "parse:2", name: "parseJSON" }
      );
    });

    const stepCompleteEvents = events.filter((e) => e.type === "step_complete");
    expect(stepCompleteEvents).toHaveLength(1);
    expect(stepCompleteEvents[0]).toMatchObject({
      type: "step_complete",
      stepKey: "parse:2",
      name: "parseJSON",
    });
    const completeEvent = stepCompleteEvents[0] as Extract<WorkflowEvent<unknown>, { type: "step_complete" }>;
    const result = completeEvent.result;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("PARSE_ERROR");
      expect(result.cause).toBeInstanceOf(SyntaxError);
    }
  });

  it("isStepComplete type guard works correctly", async () => {
    const events: WorkflowEvent<unknown>[] = [];
    const fetchUser = async (): AsyncResult<string, "NOT_FOUND"> => ok("Alice");

    const workflow = createWorkflow(
      { fetchUser },
      { onEvent: (event) => events.push(event) }
    );

    await workflow(async (step) => {
      return await step(() => fetchUser(), { key: "user:1" });
    });

    // Use the type guard
    const stepCompleteEvents = events.filter(isStepComplete);
    expect(stepCompleteEvents).toHaveLength(1);
    expect(stepCompleteEvents[0].stepKey).toBe("user:1");
    expect(stepCompleteEvents[0].result.ok).toBe(true);
  });
});

describe("resumeState", () => {
  it("pre-populates cache from resumeState", async () => {
    let callCount = 0;
    const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
      callCount++;
      return ok(callCount);
    };

    // Pre-populate resume state (with new ResumeStateEntry format)
    const resumeState: ResumeState = {
      steps: new Map([["op:1", { result: ok(999) }]]),
    };

    const workflow = createWorkflow({ expensiveOp }, { resumeState });

    const result = await workflow(async (step) => {
      // This should hit the resume state cache
      return await step(() => expensiveOp(), { key: "op:1" });
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(999); // From resume state, not fresh execution
    }
    expect(callCount).toBe(0); // Operation was never called
  });

  it("resumeState as async function works", async () => {
    let callCount = 0;
    const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
      callCount++;
      return ok(callCount);
    };

    // Async resume state loader
    const loadResumeState = async (): Promise<ResumeState> => ({
      steps: new Map([["async:op", { result: ok(42) }]]),
    });

    const workflow = createWorkflow({ expensiveOp }, { resumeState: loadResumeState });

    const result = await workflow(async (step) => {
      return await step(() => expensiveOp(), { key: "async:op" });
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
    expect(callCount).toBe(0);
  });

  it("resumeState with error replays error result", async () => {
    let callCount = 0;
    const failingOp = async (): AsyncResult<number, "OPERATION_FAILED"> => {
      callCount++;
      return err("OPERATION_FAILED" as const, { cause: "original cause" });
    };

    // Pre-populate with a cached error (using new entry format with meta)
    const resumeState: ResumeState = {
      steps: new Map([
        ["fail:1", {
          result: err("CACHED_ERROR" as const, { cause: "cached cause" }),
          meta: { origin: "result", resultCause: "cached cause" },
        }],
      ]),
    };

    const workflow = createWorkflow({ failingOp }, { resumeState });

    const result = await workflow(async (step) => {
      return await step(() => failingOp(), { key: "fail:1" });
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("CACHED_ERROR");
      expect(result.cause).toBe("cached cause");
    }
    expect(callCount).toBe(0); // Operation was never called
  });

  it("auto-creates cache when resumeState provided without cache option", async () => {
    const events: WorkflowEvent<unknown>[] = [];
    let callCount = 0;
    const expensiveOp = async (): AsyncResult<number, "ERROR"> => {
      callCount++;
      return ok(callCount);
    };

    const resumeState: ResumeState = {
      steps: new Map([["auto:cache", { result: ok(100) }]]),
    };

    // Note: no cache option provided, just resumeState
    const workflow = createWorkflow(
      { expensiveOp },
      {
        resumeState,
        onEvent: (event) => events.push(event),
      }
    );

    const result = await workflow(async (step) => {
      return await step(() => expensiveOp(), { key: "auto:cache" });
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(100);
    }
    expect(callCount).toBe(0);

    // Should emit cache_hit event
    const cacheHitEvents = events.filter((e) => e.type === "step_cache_hit");
    expect(cacheHitEvents).toHaveLength(1);
  });

  it("step_complete events can be collected for save", async () => {
    // This demonstrates the full save flow with ResumeStateEntry
    const savedSteps = new Map<string, ResumeStateEntry>();
    const fetchUser = async (id: string): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> =>
      ok({ id, name: "Alice" });
    const fetchPosts = async (_userId: string): AsyncResult<{ posts: string[] }, "FETCH_ERROR"> =>
      ok({ posts: ["Hello", "World"] });

    const workflow = createWorkflow(
      { fetchUser, fetchPosts },
      {
        onEvent: (event) => {
          if (isStepComplete(event)) {
            // Save both result and meta for proper resume
            savedSteps.set(event.stepKey, { result: event.result, meta: event.meta });
          }
        },
      }
    );

    await workflow(async (step) => {
      const user = await step(() => fetchUser("1"), { key: "user:1" });
      const posts = await step(() => fetchPosts(user.id), { key: "posts:1" });
      return { user, posts };
    });

    // Verify saved steps
    expect(savedSteps.size).toBe(2);
    expect(savedSteps.has("user:1")).toBe(true);
    expect(savedSteps.has("posts:1")).toBe(true);

    const userEntry = savedSteps.get("user:1");
    expect(userEntry?.result.ok).toBe(true);
    if (userEntry?.result.ok) {
      expect(userEntry.result.value).toEqual({ id: "1", name: "Alice" });
    }
  });

  it("full save and resume round-trip works", async () => {
    // First run: execute workflow and collect step_complete events
    const savedSteps = new Map<string, ResumeStateEntry>();
    let userCallCount = 0;
    let postsCallCount = 0;

    const fetchUser = async (id: string): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> => {
      userCallCount++;
      return ok({ id, name: `User${userCallCount}` });
    };
    const fetchPosts = async (): AsyncResult<{ posts: string[] }, "FETCH_ERROR"> => {
      postsCallCount++;
      return ok({ posts: [`Post${postsCallCount}`] });
    };

    const workflow1 = createWorkflow(
      { fetchUser, fetchPosts },
      {
        onEvent: (event) => {
          if (isStepComplete(event)) {
            savedSteps.set(event.stepKey, { result: event.result, meta: event.meta });
          }
        },
      }
    );

    await workflow1(async (step) => {
      const user = await step(() => fetchUser("1"), { key: "user:1" });
      const posts = await step(() => fetchPosts(), { key: "posts:1" });
      return { user, posts };
    });

    expect(userCallCount).toBe(1);
    expect(postsCallCount).toBe(1);
    expect(savedSteps.size).toBe(2);

    // Second run: resume with saved state
    const workflow2 = createWorkflow(
      { fetchUser, fetchPosts },
      { resumeState: { steps: savedSteps } }
    );

    const result = await workflow2(async (step) => {
      const user = await step(() => fetchUser("1"), { key: "user:1" });
      const posts = await step(() => fetchPosts(), { key: "posts:1" });
      return { user, posts };
    });

    // Call counts should NOT have increased (used cache)
    expect(userCallCount).toBe(1);
    expect(postsCallCount).toBe(1);

    // Result should be from cached values
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.name).toBe("User1"); // Original value
      expect(result.value.posts.posts[0]).toBe("Post1"); // Original value
    }
  });

  it("preserves origin:throw metadata for step.try errors on resume", async () => {
    // First run: step.try throws
    const savedSteps = new Map<string, ResumeStateEntry>();

    const workflow1 = createWorkflow({}, {
      onEvent: (event) => {
        if (isStepComplete(event)) {
          savedSteps.set(event.stepKey, { result: event.result, meta: event.meta });
        }
      }
    });

    await workflow1(async (step) => {
      return await step.try(
        () => { throw new Error("original throw"); },
        { error: "TRY_ERROR" as const, key: "try:1" }
      );
    });

    // Verify saved meta has origin:"throw"
    const savedEntry = savedSteps.get("try:1");
    expect(savedEntry?.meta?.origin).toBe("throw");

    // Second run: resume
    const workflow2 = createWorkflow({}, { resumeState: { steps: savedSteps } });

    const result = await workflow2(async (step) => {
      return await step.try(
        () => "should not be called",
        { error: "TRY_ERROR" as const, key: "try:1" }
      );
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("TRY_ERROR");
      // The cause should be the original thrown error
      expect(result.cause).toBeInstanceOf(Error);
      expect((result.cause as Error).message).toBe("original throw");
    }
  });

  it("preserves UnexpectedError structure for safe-default uncaught exceptions on resume", async () => {
    // First run: uncaught exception in safe-default mode
    const savedSteps = new Map<string, ResumeStateEntry>();

    const workflow1 = createWorkflow({}, {
      onEvent: (event) => {
        if (isStepComplete(event)) {
          savedSteps.set(event.stepKey, { result: event.result, meta: event.meta });
        }
      }
    });

    // A step that throws unexpectedly
    await workflow1(async (step) => {
      return await step(() => {
        throw new Error("uncaught exception");
      }, { key: "uncaught:1" });
    });

    // Verify saved result is an UnexpectedError
    const savedEntry = savedSteps.get("uncaught:1");
    expect(savedEntry).toBeDefined();
    expect(savedEntry?.result.ok).toBe(false);
    const savedResult = savedEntry!.result;
    if (!savedResult.ok) {
      expect(isUnexpectedError(savedResult.error)).toBe(true);
      const unexpectedError = savedResult.error as UnexpectedError;
      expect(unexpectedError.cause.type).toBe("UNCAUGHT_EXCEPTION");
    }

    // Second run: resume - should get the same UnexpectedError, not wrapped in STEP_FAILURE
    const workflow2 = createWorkflow({}, { resumeState: { steps: savedSteps } });

    const result = await workflow2(async (step) => {
      return await step(() => ok("should not execute"), { key: "uncaught:1" });
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should be UnexpectedError with UNCAUGHT_EXCEPTION, not double-wrapped
      expect(isUnexpectedError(result.error)).toBe(true);
      const unexpectedError = result.error as UnexpectedError;
      expect(unexpectedError.cause.type).toBe("UNCAUGHT_EXCEPTION");
      // NOT { type: "STEP_FAILURE", error: { type: "UNEXPECTED_ERROR", ... } }
    }
  });
});

// =============================================================================
// createWorkflow with typed args
// =============================================================================

describe("createWorkflow with typed args", () => {
  // Helpers for this describe block
  const fetchUser = async (id: string): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> => {
    if (id === "1") return ok({ id, name: "Alice" });
    return err("NOT_FOUND" as const);
  };

  const fetchPosts = async (userId: string): AsyncResult<{ id: number; title: string }[], "FETCH_ERROR"> => {
    return ok([{ id: 1, title: "Hello" }]);
  };

  it("passes args to callback as third parameter", async () => {
    const workflow = createWorkflow({ fetchUser });

    const result = await workflow({ id: "1" }, async (step, deps, args) => {
      expect(args).toEqual({ id: "1" });
      const user = await step(deps.fetchUser(args.id));
      return user;
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
    }
  });

  it("works without args (backwards compatibility)", async () => {
    const workflow = createWorkflow({ fetchUser });

    const result = await workflow(async (step) => {
      return await step(fetchUser("1"));
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
    }
  });

  it("passes object args with multiple properties", async () => {
    const workflow = createWorkflow({ fetchUser, fetchPosts });

    const result = await workflow({ userId: "1", includePosts: true }, async (step, deps, args) => {
      const user = await step(deps.fetchUser(args.userId));
      if (args.includePosts) {
        const posts = await step(deps.fetchPosts(user.id));
        return { user, posts };
      }
      return { user, posts: [] };
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.name).toBe("Alice");
      expect(result.value.posts.length).toBe(1);
    }
  });

  it("passes primitive args (string)", async () => {
    const workflow = createWorkflow({ fetchUser });

    const result = await workflow("1", async (step, deps, id) => {
      return await step(deps.fetchUser(id));
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
    }
  });

  it("passes primitive args (number)", async () => {
    const workflow = createWorkflow({ fetchUser });

    const result = await workflow(42, async (_step, _uses, num) => {
      expect(num).toBe(42);
      return num * 2;
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(84);
    }
  });

  it("works with strict mode and args", async () => {
    const workflow = createWorkflow(
      { fetchUser },
      {
        strict: true,
        catchUnexpected: () => "UNEXPECTED" as const,
      }
    );

    const result = await workflow({ id: "1" }, async (step, deps, args) => {
      return await step(deps.fetchUser(args.id));
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
    }
  });

  it("propagates errors correctly with args", async () => {
    const workflow = createWorkflow({ fetchUser });

    const result = await workflow({ id: "unknown" }, async (step, deps, args) => {
      return await step(deps.fetchUser(args.id));
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("NOT_FOUND");
    }
  });

  it("preserves deps object access with args", async () => {
    const workflow = createWorkflow({ fetchUser, fetchPosts });

    const result = await workflow({ baseId: "1" }, async (step, { fetchUser: getUser, fetchPosts: getPosts }, args) => {
      const user = await step(getUser(args.baseId));
      const posts = await step(getPosts(user.id));
      return { user, posts };
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.name).toBe("Alice");
      expect(result.value.posts.length).toBe(1);
    }
  });

  it("supports function as args (edge case)", async () => {
    const workflow = createWorkflow({ fetchUser });

    // Pass a factory function as args - this should NOT be confused with the callback
    const idFactory = () => "1";

    const result = await workflow(idFactory, async (step, deps, factory) => {
      // factory should be the idFactory function, not treated as the workflow callback
      expect(typeof factory).toBe("function");
      const id = factory();
      return await step(deps.fetchUser(id));
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
    }
  });

  it("supports async function as args", async () => {
    const workflow = createWorkflow({ fetchUser });

    // Pass an async function as args
    const asyncIdProvider = async () => "1";

    const result = await workflow(asyncIdProvider, async (step, deps, provider) => {
      const id = await provider();
      return await step(deps.fetchUser(id));
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Alice");
    }
  });
});

// =============================================================================
// Human-in-the-Loop (HITL) Tests
// =============================================================================

describe("HITL - Human-in-the-Loop Support", () => {
  describe("Type guards", () => {
    it("isPendingApproval identifies PendingApproval errors", () => {
      const pending: PendingApproval = {
        type: "PENDING_APPROVAL",
        stepKey: "approval:123",
      };
      expect(isPendingApproval(pending)).toBe(true);
      expect(isPendingApproval({ type: "OTHER" })).toBe(false);
      expect(isPendingApproval(null)).toBe(false);
      expect(isPendingApproval("string")).toBe(false);
    });

    it("isApprovalRejected identifies ApprovalRejected errors", () => {
      const rejected: ApprovalRejected = {
        type: "APPROVAL_REJECTED",
        stepKey: "approval:123",
        reason: "Not authorized",
      };
      expect(isApprovalRejected(rejected)).toBe(true);
      expect(isApprovalRejected({ type: "OTHER" })).toBe(false);
      expect(isApprovalRejected(null)).toBe(false);
    });
  });

  describe("pendingApproval()", () => {
    it("creates a PendingApproval error result", () => {
      const result = pendingApproval("approval:123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("PENDING_APPROVAL");
        expect(result.error.stepKey).toBe("approval:123");
        expect(result.error.reason).toBeUndefined();
      }
    });

    it("includes optional reason and metadata", () => {
      const result = pendingApproval("approval:123", {
        reason: "Requires manager sign-off",
        metadata: { requestedBy: "user:456" },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.reason).toBe("Requires manager sign-off");
        expect(result.error.metadata).toEqual({ requestedBy: "user:456" });
      }
    });
  });

  describe("createApprovalStep()", () => {
    it("returns ok when approved", async () => {
      const checkApproval = createApprovalStep<{ approvedBy: string }>({
        key: "test-approval",
        checkApproval: async () => ({
          status: "approved",
          value: { approvedBy: "admin" },
        }),
      });

      const result = await checkApproval();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.approvedBy).toBe("admin");
      }
    });

    it("returns PendingApproval when pending", async () => {
      const checkApproval = createApprovalStep<{ approvedBy: string }>({
        key: "test-approval",
        checkApproval: async () => ({ status: "pending" }),
        pendingReason: "Awaiting manager approval",
      });

      const result = await checkApproval();
      expect(result.ok).toBe(false);
      if (!result.ok && isPendingApproval(result.error)) {
        expect(result.error.stepKey).toBe("test-approval");
        expect(result.error.reason).toBe("Awaiting manager approval");
      }
    });

    it("returns ApprovalRejected when rejected", async () => {
      const checkApproval = createApprovalStep<{ approvedBy: string }>({
        key: "test-approval",
        checkApproval: async () => ({
          status: "rejected",
          reason: "Budget exceeded",
        }),
      });

      const result = await checkApproval();
      expect(result.ok).toBe(false);
      if (!result.ok && isApprovalRejected(result.error)) {
        expect(result.error.stepKey).toBe("test-approval");
        expect(result.error.reason).toBe("Budget exceeded");
      }
    });
  });

  describe("State helpers", () => {
    it("injectApproval adds approval to resume state", () => {
      const state: ResumeState = { steps: new Map() };
      const updated = injectApproval(state, {
        stepKey: "approval:123",
        value: { approvedBy: "admin" },
      });

      expect(updated.steps.has("approval:123")).toBe(true);
      const entry = updated.steps.get("approval:123")!;
      expect(entry.result.ok).toBe(true);
      if (entry.result.ok) {
        expect(entry.result.value).toEqual({ approvedBy: "admin" });
      }
    });

    it("injectApproval does not mutate original state", () => {
      const state: ResumeState = { steps: new Map() };
      const updated = injectApproval(state, {
        stepKey: "approval:123",
        value: { approvedBy: "admin" },
      });

      expect(state.steps.has("approval:123")).toBe(false);
      expect(updated.steps.has("approval:123")).toBe(true);
    });

    it("clearStep removes a step from resume state", () => {
      const state: ResumeState = {
        steps: new Map([
          ["step:1", { result: ok("value1") }],
          ["step:2", { result: ok("value2") }],
        ]),
      };
      const updated = clearStep(state, "step:1");

      expect(updated.steps.has("step:1")).toBe(false);
      expect(updated.steps.has("step:2")).toBe(true);
    });

    it("hasPendingApproval detects pending approval in state", () => {
      const pendingResult = pendingApproval("approval:123");
      const state: ResumeState = {
        steps: new Map([
          ["approval:123", { result: pendingResult }],
          ["other:456", { result: ok("done") }],
        ]),
      };

      expect(hasPendingApproval(state, "approval:123")).toBe(true);
      expect(hasPendingApproval(state, "other:456")).toBe(false);
      expect(hasPendingApproval(state, "nonexistent")).toBe(false);
    });

    it("getPendingApprovals returns all pending step keys", () => {
      const pending1 = pendingApproval("approval:1");
      const pending2 = pendingApproval("approval:2");
      const state: ResumeState = {
        steps: new Map([
          ["approval:1", { result: pending1 }],
          ["completed:1", { result: ok("done") }],
          ["approval:2", { result: pending2 }],
        ]),
      };

      const pendingKeys = getPendingApprovals(state);
      expect(pendingKeys).toContain("approval:1");
      expect(pendingKeys).toContain("approval:2");
      expect(pendingKeys).not.toContain("completed:1");
      expect(pendingKeys.length).toBe(2);
    });
  });

  describe("createHITLCollector()", () => {
    it("collects step_complete events", async () => {
      const collector = createHITLCollector();

      // Simulate step_complete events
      collector.handleEvent({
        type: "step_complete",
        workflowId: "wf-1",
        stepKey: "step:1",
        ts: Date.now(),
        durationMs: 100,
        result: ok("value1"),
      });

      const state = collector.getState();
      expect(state.steps.has("step:1")).toBe(true);
    });

    it("detects pending approvals", async () => {
      const collector = createHITLCollector();

      collector.handleEvent({
        type: "step_complete",
        workflowId: "wf-1",
        stepKey: "approval:1",
        ts: Date.now(),
        durationMs: 100,
        result: pendingApproval("approval:1"),
      });

      expect(collector.hasPendingApprovals()).toBe(true);
      const pending = collector.getPendingApprovals();
      expect(pending.length).toBe(1);
      expect(pending[0].stepKey).toBe("approval:1");
    });

    it("injectApproval updates collector state and returns resumeState", async () => {
      const collector = createHITLCollector();

      // Add a pending approval
      collector.handleEvent({
        type: "step_complete",
        workflowId: "wf-1",
        stepKey: "approval:1",
        ts: Date.now(),
        durationMs: 100,
        result: pendingApproval("approval:1"),
      });

      expect(collector.hasPendingApprovals()).toBe(true);

      // Inject approval - should update internal state
      const resumeState = collector.injectApproval("approval:1", {
        approvedBy: "admin",
      });

      // Returned state has approval
      expect(resumeState.steps.has("approval:1")).toBe(true);
      const entry = resumeState.steps.get("approval:1")!;
      expect(entry.result.ok).toBe(true);

      // Collector state is also updated (no longer pending)
      expect(collector.hasPendingApprovals()).toBe(false);
      expect(collector.getState().steps.get("approval:1")!.result.ok).toBe(true);
    });

    it("clear removes all collected state", async () => {
      const collector = createHITLCollector();

      collector.handleEvent({
        type: "step_complete",
        workflowId: "wf-1",
        stepKey: "step:1",
        ts: Date.now(),
        durationMs: 100,
        result: ok("value1"),
      });

      expect(collector.getState().steps.size).toBe(1);
      collector.clear();
      expect(collector.getState().steps.size).toBe(0);
    });
  });

  describe("Full HITL workflow integration", () => {
    it("pauses on pending approval and resumes with injected result", async () => {
      // Approval checker that always returns pending (external state simulation)
      const requireApproval = createApprovalStep<{ approvedBy: string }>({
        key: "manager-approval",
        checkApproval: async () => {
          // In real usage, this would check external state
          return { status: "pending" };
        },
      });

      const fetchData = async (
        id: string
      ): AsyncResult<{ data: string }, "NOT_FOUND"> => {
        return ok({ data: `data-${id}` });
      };

      // First run: workflow should pause at approval
      const collector1 = createHITLCollector();
      const workflow1 = createWorkflow(
        { fetchData, requireApproval },
        { onEvent: collector1.handleEvent }
      );

      const result1 = await workflow1(async (step) => {
        const data = await step(() => fetchData("123"), { key: "data:123" });
        const approval = await step(requireApproval, {
          key: "manager-approval",
        });
        return { data, approval };
      });

      // Should fail with pending approval
      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(isPendingApproval(result1.error)).toBe(true);
      }

      // Collector should have pending approvals
      expect(collector1.hasPendingApprovals()).toBe(true);

      // Simulate approval being granted externally
      const resumeState = collector1.injectApproval("manager-approval", {
        approvedBy: "manager",
      });

      // Second run: resume with approval
      const workflow2 = createWorkflow(
        { fetchData, requireApproval },
        { resumeState }
      );

      const result2 = await workflow2(async (step) => {
        const data = await step(() => fetchData("123"), { key: "data:123" });
        const approval = await step(requireApproval, {
          key: "manager-approval",
        });
        return { data, approval };
      });

      // Should succeed with both data and approval
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value.data).toEqual({ data: "data-123" });
        expect(result2.value.approval).toEqual({ approvedBy: "manager" });
      }
    });

    it("handles rejected approvals", async () => {
      const requireApproval = createApprovalStep<{ approvedBy: string }>({
        key: "manager-approval",
        checkApproval: async () => ({
          status: "rejected",
          reason: "Insufficient budget",
        }),
      });

      const workflow = createWorkflow({ requireApproval });

      const result = await workflow(async (step) => {
        return await step(requireApproval, { key: "manager-approval" });
      });

      expect(result.ok).toBe(false);
      if (!result.ok && isApprovalRejected(result.error)) {
        expect(result.error.reason).toBe("Insufficient budget");
      }
    });
  });
});
