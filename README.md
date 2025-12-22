# @jagreehal/workflow

Typed async workflows with automatic error inference. Build type-safe workflows with Result types, step caching, resume state, and human-in-the-loop support.

```bash
npm install @jagreehal/workflow
```

## The Problem

```typescript
// try/catch loses error attribution
async function loadUserData(id: string) {
  try {
    const user = await fetchUser(id);
    const posts = await fetchPosts(user.id);
    return { user, posts };
  } catch {
    return null; // What failed? Who knows.
  }
}
```

## The Solution

```typescript
import { createWorkflow, ok, err, type AsyncResult } from '@jagreehal/workflow';

const fetchUser = async (id: string): AsyncResult<User, 'NOT_FOUND'> =>
  id === '1' ? ok({ id, name: 'Alice' }) : err('NOT_FOUND');

const fetchPosts = async (userId: string): AsyncResult<Post[], 'FETCH_ERROR'> =>
  ok([{ id: 1, title: 'Hello World' }]);

const loadUserData = createWorkflow({ fetchUser, fetchPosts });

const result = await loadUserData(async (step) => {
  const user = await step(fetchUser('1'));
  const posts = await step(fetchPosts(user.id));
  return { user, posts };
});

// result.error: 'NOT_FOUND' | 'FETCH_ERROR' | UnexpectedError
// ↑ Computed automatically from { fetchUser, fetchPosts }
```

`step()` unwraps Results. On error, workflow exits early.

## More Examples

### User signup with multiple steps

```typescript
const validateEmail = async (email: string): AsyncResult<string, 'INVALID_EMAIL'> =>
  email.includes('@') ? ok(email) : err('INVALID_EMAIL');

const checkDuplicate = async (email: string): AsyncResult<void, 'EMAIL_EXISTS'> => {
  const exists = email === 'taken@example.com';
  return exists ? err('EMAIL_EXISTS') : ok(undefined);
};

const createAccount = async (email: string): AsyncResult<{ id: string }, 'DB_ERROR'> =>
  ok({ id: crypto.randomUUID() });

const sendWelcome = async (userId: string): AsyncResult<void, 'EMAIL_FAILED'> =>
  ok(undefined);

// Declare deps → error union computed automatically
const signUp = createWorkflow({ validateEmail, checkDuplicate, createAccount, sendWelcome });

const result = await signUp(async (step) => {
  const email = await step(validateEmail('user@example.com'));
  await step(checkDuplicate(email));
  const account = await step(createAccount(email));
  await step(sendWelcome(account.id));
  return account;
});

// result.error: 'INVALID_EMAIL' | 'EMAIL_EXISTS' | 'DB_ERROR' | 'EMAIL_FAILED' | UnexpectedError
```

### Checkout flow

```typescript
const authenticate = async (token: string): AsyncResult<{ userId: string }, 'UNAUTHORIZED'> =>
  token === 'valid' ? ok({ userId: 'user-1' }) : err('UNAUTHORIZED');

const fetchOrder = async (id: string): AsyncResult<{ total: number }, 'ORDER_NOT_FOUND'> =>
  ok({ total: 99 });

const chargeCard = async (amount: number): AsyncResult<{ txId: string }, 'PAYMENT_FAILED'> =>
  ok({ txId: 'tx-123' });

const checkout = createWorkflow({ authenticate, fetchOrder, chargeCard });

const result = await checkout(async (step) => {
  const auth = await step(authenticate(token));
  const order = await step(fetchOrder(orderId));
  const payment = await step(chargeCard(order.total));
  return { userId: auth.userId, txId: payment.txId };
});

// result.error: 'UNAUTHORIZED' | 'ORDER_NOT_FOUND' | 'PAYMENT_FAILED' | UnexpectedError
```

### Composing workflows

You can combine multiple workflows together. The error types automatically aggregate:

```typescript
// Validation workflow
const validateEmail = async (email: string): AsyncResult<string, 'INVALID_EMAIL'> =>
  email.includes('@') ? ok(email) : err('INVALID_EMAIL');

const validatePassword = async (pwd: string): AsyncResult<string, 'WEAK_PASSWORD'> =>
  pwd.length >= 8 ? ok(pwd) : err('WEAK_PASSWORD');

const validationWorkflow = createWorkflow({ validateEmail, validatePassword });

// Checkout workflow (from example above)
const authenticate = async (token: string): AsyncResult<{ userId: string }, 'UNAUTHORIZED'> =>
  token === 'valid' ? ok({ userId: 'user-1' }) : err('UNAUTHORIZED');

const fetchOrder = async (id: string): AsyncResult<{ total: number }, 'ORDER_NOT_FOUND'> =>
  ok({ total: 99 });

const chargeCard = async (amount: number): AsyncResult<{ txId: string }, 'PAYMENT_FAILED'> =>
  ok({ txId: 'tx-123' });

const checkoutWorkflow = createWorkflow({ authenticate, fetchOrder, chargeCard });

// Composed workflow: validation + checkout
// Include all dependencies from both workflows
const validateAndCheckout = createWorkflow({
  validateEmail,
  validatePassword,
  authenticate,
  fetchOrder,
  chargeCard,
});

const result = await validateAndCheckout(async (step, deps) => {
  // Run validation workflow as a step (workflows return AsyncResult)
  const validated = await step(() => validationWorkflow(async (innerStep) => {
    const email = await innerStep(deps.validateEmail('user@example.com'));
    const password = await innerStep(deps.validatePassword('secret123'));
    return { email, password };
  }));
  
  // Run checkout workflow as a step
  const checkout = await step(() => checkoutWorkflow(async (innerStep) => {
    const auth = await innerStep(deps.authenticate('valid'));
    const order = await innerStep(deps.fetchOrder('order-1'));
    const payment = await innerStep(deps.chargeCard(order.total));
    return { userId: auth.userId, txId: payment.txId };
  }));
  
  return { validated, checkout };
});

// result.error: 'INVALID_EMAIL' | 'WEAK_PASSWORD' | 'UNAUTHORIZED' | 'ORDER_NOT_FOUND' | 'PAYMENT_FAILED' | UnexpectedError
// ↑ All error types from both workflows are automatically aggregated
```

**Alternative approach**: You can also combine workflows by including all their dependencies in a single workflow:

```typescript
// Simpler composition - combine all dependencies
const composed = createWorkflow({
  validateEmail,
  validatePassword,
  authenticate,
  fetchOrder,
  chargeCard,
});

const result = await composed(async (step, deps) => {
  // Validation steps
  const email = await step(deps.validateEmail('user@example.com'));
  const password = await step(deps.validatePassword('secret123'));
  
  // Checkout steps
  const auth = await step(deps.authenticate('valid'));
  const order = await step(deps.fetchOrder('order-1'));
  const payment = await step(deps.chargeCard(order.total));
  
  return { email, password, userId: auth.userId, txId: payment.txId };
});
// Same error union: 'INVALID_EMAIL' | 'WEAK_PASSWORD' | 'UNAUTHORIZED' | 'ORDER_NOT_FOUND' | 'PAYMENT_FAILED' | UnexpectedError
```

### Wrapping throwing APIs with step.try

```typescript
const workflow = createWorkflow({ fetchUser });

const result = await workflow(async (step) => {
  const user = await step(fetchUser('1'));

  // step.try catches throws and rejections → typed error
  const response = await step.try(
    () => fetch(`/api/posts/${user.id}`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    { error: 'FETCH_FAILED' as const }
  );

  const posts = await step.try(
    () => JSON.parse(response),
    { error: 'PARSE_FAILED' as const }
  );

  return { user, posts };
});

// result.error: 'NOT_FOUND' | 'FETCH_FAILED' | 'PARSE_FAILED' | UnexpectedError
```

### Wrapping Result-returning functions with step.fromResult

When calling functions that return `Result<T, E>`, use `step.fromResult()` to map their typed errors:

```typescript
// callProvider returns Result<Response, ProviderError>
const callProvider = async (input: string): AsyncResult<Response, ProviderError> => { ... };

const result = await workflow(async (step) => {
  // step.fromResult gives you typed errors in onError (not unknown like step.try)
  const response = await step.fromResult(
    () => callProvider(input),
    {
      onError: (e) => ({
        type: 'PROVIDER_FAILED' as const,
        provider: e.provider,  // TypeScript knows e is ProviderError
        code: e.code,
      })
    }
  );

  return response;
});
```

Unlike `step.try()` where `onError` receives `unknown`, `step.fromResult()` preserves the error type.

### Parallel operations

```typescript
import { allAsync, partition, map } from '@jagreehal/workflow';

// First error wins
const result = await allAsync([
  fetchUser('1'),
  fetchPosts('1'),
]);
const data = map(result, ([user, posts]) => ({ user, posts }));

// Collect all results, even failures
const results = await Promise.all(userIds.map(id => fetchUser(id)));
const { values: users, errors } = partition(results);
```

### Consuming results

```typescript
if (result.ok) {
  console.log(result.value.user.name);
} else {
  console.log(result.error); // Typed error union
}
```

## Quick Reference

| Function | What it does |
|----------|--------------|
| `createWorkflow(deps)` | Create workflow with auto-inferred error types |
| `run(callback, options)` | Execute workflow with manual error types |
| `step(op())` | Unwrap Result or exit early |
| `step.try(fn, { error })` | Catch throws/rejects → typed error |
| `step.fromResult(fn, { onError })` | Map Result errors with typed onError |
| `step.retry(fn, opts)` | Retry with backoff on failure |
| `step.withTimeout(fn, { ms })` | Timeout after specified duration |
| `ok(value)` / `err(error)` | Create Results |
| `map`, `andThen`, `match` | Transform Results |
| `allAsync`, `partition` | Batch operations |
| `isStepTimeoutError(e)` | Check if error is a timeout |
| `getStepTimeoutMeta(e)` | Get timeout metadata from error |

### Choosing Between run() and createWorkflow()

| Use Case | Recommendation |
|----------|----------------|
| Dependencies known at compile time | `createWorkflow()` |
| Dependencies passed as parameters | `run()` |
| Need step caching or resume | `createWorkflow()` |
| One-off workflow invocation | `run()` |
| Want automatic error inference | `createWorkflow()` |
| Error types known upfront | `run()` |

**`run()`** - Best for dynamic dependencies, testing, or lightweight workflows where you know the error types:

```typescript
import { run } from '@jagreehal/workflow';

const result = await run<Output, 'NOT_FOUND' | 'FETCH_ERROR'>(
  async (step) => {
    const user = await step(fetchUser(userId)); // userId from parameter
    return user;
  },
  { onError: (e) => console.log('Failed:', e) }
);
```

**`createWorkflow()`** - Best for reusable workflows with static dependencies. Provides automatic error type inference:

```typescript
const loadUser = createWorkflow({ fetchUser, fetchPosts });
// Error type computed automatically from deps
```

### Import paths

```typescript
import { createWorkflow, ok, err } from '@jagreehal/workflow';           // Full library
import { createWorkflow } from '@jagreehal/workflow/workflow';            // Workflow only
import { ok, err, map, all } from '@jagreehal/workflow/core';             // Primitives only
```

## Advanced

**You don't need this on day one.** The core is `createWorkflow`, `step`, and `step.try`.

### Step caching

Cache expensive operations by adding `{ key }`:

```typescript
const cache = new Map<string, Result<unknown, unknown>>();
const workflow = createWorkflow({ fetchUser }, { cache });

const result = await workflow(async (step) => {
  // Wrap in function + add key for caching
  const user = await step(() => fetchUser('1'), { key: 'user:1' });

  // Same key = cache hit (fetchUser not called again)
  const userAgain = await step(() => fetchUser('1'), { key: 'user:1' });

  return user;
});
```

### Retry with backoff

Automatically retry failed steps with configurable backoff:

```typescript
const result = await workflow(async (step) => {
  // Retry up to 3 times with exponential backoff
  const data = await step.retry(
    () => fetchData(),
    {
      attempts: 3,
      backoff: 'exponential',  // 'fixed' | 'linear' | 'exponential'
      initialDelay: 100,       // ms
      maxDelay: 5000,          // cap delay at 5s
      jitter: true,            // add randomness to prevent thundering herd
      retryOn: (error) => error !== 'FATAL',  // custom retry predicate
    }
  );
  return data;
});
```

Or use retry options directly on `step()`:

```typescript
const user = await step(() => fetchUser(id), {
  key: 'user:1',
  retry: { attempts: 3, backoff: 'exponential' },
});
```

### Timeout

Prevent steps from hanging with timeouts:

```typescript
const result = await workflow(async (step) => {
  // Timeout after 5 seconds
  const data = await step.withTimeout(
    () => slowOperation(),
    { ms: 5000, name: 'slow-op' }
  );
  return data;
});
```

With AbortSignal for cancellable operations:

```typescript
const data = await step.withTimeout(
  (signal) => fetch('/api/data', { signal }),
  { ms: 5000, signal: true }  // pass signal to operation
);
```

Combine retry and timeout - each attempt gets its own timeout:

```typescript
const data = await step.retry(
  () => fetchData(),
  {
    attempts: 3,
    timeout: { ms: 2000 },  // 2s timeout per attempt
  }
);
```

Detecting timeout errors:

```typescript
import { isStepTimeoutError, getStepTimeoutMeta } from '@jagreehal/workflow';

if (!result.ok && isStepTimeoutError(result.error)) {
  const meta = getStepTimeoutMeta(result.error);
  console.log(`Timed out after ${meta?.timeoutMs}ms on attempt ${meta?.attempt}`);
}
```

### State save & resume

Save step results for workflow replay:

```typescript
import { createWorkflow, isStepComplete, type ResumeStateEntry } from '@jagreehal/workflow';

const savedSteps = new Map<string, ResumeStateEntry>();
const userId = '123';

const workflow = createWorkflow({ fetchUser, requireApproval }, {
  onEvent: (event) => {
    if (isStepComplete(event)) {
      savedSteps.set(event.stepKey, { result: event.result, meta: event.meta });
    }
  }
});

// First run
const result = await workflow(async (step) => {
  const user = await step(() => fetchUser(userId), { key: `user:${userId}` });
  const approval = await step(() => requireApproval(user.id), { key: `approval:${userId}` });
  return { user, approval };
});

// Resume later
const workflow2 = createWorkflow({ fetchUser, requireApproval }, {
  resumeState: { steps: savedSteps }
});
// Cached steps are skipped on resume
```

### Strict mode (closed error unions)

Remove `UnexpectedError` from the union:

```typescript
const workflow = createWorkflow(
  { fetchUser, fetchPosts },
  { strict: true, catchUnexpected: () => 'UNEXPECTED' as const }
);

// result.error: 'NOT_FOUND' | 'FETCH_ERROR' | 'UNEXPECTED' (exactly)
```

### Event stream

```typescript
const workflow = createWorkflow({ fetchUser }, {
  onEvent: (event) => {
    // workflow_start | workflow_success | workflow_error
    // step_start | step_success | step_error | step_complete
    // step_retry | step_timeout | step_retries_exhausted
    console.log(event.type, event.durationMs);
  }
});
```

### Visualization

Render workflow execution as ASCII art or Mermaid diagrams:

```typescript
import { createIRBuilder, renderToAscii, renderToMermaid } from '@jagreehal/workflow/visualize';

const builder = createIRBuilder();
const workflow = createWorkflow({ fetchUser, fetchPosts }, {
  onEvent: (event) => builder.addEvent(event),
});

await workflow(async (step) => {
  const user = await step(() => fetchUser('1'), { name: 'Fetch user' });
  const posts = await step(() => fetchPosts(user.id), { name: 'Fetch posts' });
  return { user, posts };
});

// ASCII output
console.log(renderToAscii(builder.getIR()));
// ┌── my-workflow ──────────────────────────┐
// │  ✓ Fetch user [150ms]                   │
// │  ✓ Fetch posts [89ms]                   │
// │  Completed in 240ms                     │
// └─────────────────────────────────────────┘

// Mermaid output (for docs, GitHub, etc.)
console.log(renderToMermaid(builder.getIR()));
```

Visualization includes retry and timeout indicators:

```
✓ Fetch data [500ms] [2 retries] [timeout 5000ms]
```

### Human-in-the-loop

```typescript
import { createApprovalStep, isPendingApproval, injectApproval } from '@jagreehal/workflow';

const requireApproval = createApprovalStep<{ approvedBy: string }>({
  key: 'approval:deploy',
  checkApproval: async () => {
    const status = await db.getApproval('deploy');
    if (!status) return { status: 'pending' };
    return { status: 'approved', value: { approvedBy: status.approver } };
  },
});

const result = await workflow(async (step) => {
  const approval = await step(requireApproval, { key: 'approval:deploy' });
  return approval;
});

if (!result.ok && isPendingApproval(result.error)) {
  // Workflow paused, waiting for approval
  // Later: injectApproval(savedState, { stepKey, value }) to resume
}
```

### More utilities

See [docs/advanced.md](docs/advanced.md) for batch operations, transformers, and neverthrow interop.

## API Reference

See [docs/api.md](docs/api.md).

## License

MIT
