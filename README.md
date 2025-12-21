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
| `step(op())` | Unwrap Result or exit early |
| `step.try(fn, { error })` | Catch throws/rejects → typed error |
| `ok(value)` / `err(error)` | Create Results |
| `map`, `andThen`, `match` | Transform Results |
| `allAsync`, `partition` | Batch operations |

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
    console.log(event.type, event.durationMs);
  }
});
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
