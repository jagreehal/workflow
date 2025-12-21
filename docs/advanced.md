# Advanced Usage

For core concepts (`createWorkflow`, `step`, `step.try`), see the [README](../README.md).

## Batch operations

```typescript
import { all, allSettled, any, partition } from '@jagreehal/workflow';

// All must succeed (short-circuits on first error)
const combined = all([ok(1), ok(2), ok(3)]); // ok([1, 2, 3])

// Collect ALL errors (great for form validation)
const validated = allSettled([
  validateEmail(email),
  validatePassword(password),
]);
// If any fail: err(['INVALID_EMAIL', 'WEAK_PASSWORD'])

// First success wins
const first = any([err('A'), ok('success'), err('B')]); // ok('success')

// Split successes and failures
const { values, errors } = partition(results);
```

Async versions: `allAsync`, `allSettledAsync`, `anyAsync`.

## Dynamic error mapping

Use `{ onError }` instead of `{ error }` to create errors from the caught value:

```typescript
const result = await workflow(async (step) => {
  const data = await step.try(
    () => fetchExternalApi(),
    { onError: (e) => ({ type: 'API_ERROR' as const, message: String(e) }) }
  );

  // Or extract specific error info
  const parsed = await step.try(
    () => schema.parse(data),
    { onError: (e) => ({ type: 'VALIDATION_ERROR' as const, issues: e.issues }) }
  );

  return parsed;
});
```

## Type utilities

```typescript
import { type ErrorOf, type Errors, type ErrorsOfDeps } from '@jagreehal/workflow';

// Extract error type from a function
type UserError = ErrorOf<typeof fetchUser>; // 'NOT_FOUND'

// Combine errors from multiple functions
type AppError = Errors<[typeof fetchUser, typeof fetchPosts]>;
// 'NOT_FOUND' | 'FETCH_ERROR'

// Extract from a deps object (same as createWorkflow uses)
type WorkflowErrors = ErrorsOfDeps<{ fetchUser: typeof fetchUser }>;
```

## Wrapping existing code

```typescript
import { from, fromPromise, tryAsync, fromNullable } from '@jagreehal/workflow';

// Sync throwing function
const parsed = from(
  () => JSON.parse(input),
  (cause) => ({ type: 'PARSE_ERROR' as const, cause })
);

// Existing promise (remember: fetch needs r.ok check!)
const result = await fromPromise(
  fetch('/api').then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }),
  () => 'FETCH_FAILED' as const
);

// Nullable → Result
const element = fromNullable(
  document.getElementById('app'),
  () => 'NOT_FOUND' as const
);
```

## Transformers

```typescript
import { map, mapError, match, andThen, tap } from '@jagreehal/workflow';

const doubled = map(ok(21), n => n * 2); // ok(42)

const mapped = mapError(err('not_found'), e => e.toUpperCase()); // err('NOT_FOUND')

const message = match(result, {
  ok: (user) => `Hello ${user.name}`,
  err: (error) => `Error: ${error}`,
});

// Chain results (flatMap)
const userPosts = andThen(fetchUser('1'), user => fetchPosts(user.id));

// Side effects without changing result
const logged = tap(result, user => console.log('Got user:', user.name));
```

## Human-in-the-loop (HITL)

Build workflows that pause for human approval:

```typescript
import {
  createWorkflow,
  createApprovalStep,
  createHITLCollector,
  isPendingApproval,
  injectApproval,
} from '@jagreehal/workflow';

// 1. Create an approval step
const requireManagerApproval = createApprovalStep<{ approvedBy: string }>({
  key: 'manager-approval',
  checkApproval: async () => {
    const approval = await db.getApproval('manager-approval');
    if (!approval) return { status: 'pending' };
    if (approval.rejected) return { status: 'rejected', reason: approval.reason };
    return { status: 'approved', value: { approvedBy: approval.manager } };
  },
  pendingReason: 'Waiting for manager approval',
});

// 2. Use in workflow with collector
const collector = createHITLCollector();
const workflow = createWorkflow(
  { fetchData, requireManagerApproval },
  { onEvent: collector.handleEvent }
);

const result = await workflow(async (step) => {
  const data = await step(() => fetchData('123'), { key: 'data' });
  const approval = await step(requireManagerApproval, { key: 'manager-approval' });
  return { data, approvedBy: approval.approvedBy };
});

// 3. Handle pending state
if (!result.ok && isPendingApproval(result.error)) {
  // Save state for later resume
  await saveToDatabase(collector.getState());
  console.log(`Workflow paused: ${result.error.reason}`);
}

// 4. Resume after approval granted
const savedState = await loadFromDatabase();
const resumeState = injectApproval(savedState, {
  stepKey: 'manager-approval',
  value: { approvedBy: 'alice@example.com' }
});

const workflow2 = createWorkflow(
  { fetchData, requireManagerApproval },
  { resumeState }
);
// Re-run same workflow body — cached steps skip, approval injected
```

### HITL utilities

```typescript
// Check approval state
hasPendingApproval(state, 'approval-key')  // boolean
getPendingApprovals(state)                  // string[]

// Modify state
clearStep(state, 'step-key')               // Remove step from state
injectApproval(state, { stepKey, value })  // Add approval result
```

## Interop with neverthrow

```typescript
import { Result as NTResult } from 'neverthrow';
import { ok, err, type Result } from '@jagreehal/workflow';

function fromNeverthrow<T, E>(ntResult: NTResult<T, E>): Result<T, E> {
  return ntResult.isOk() ? ok(ntResult.value) : err(ntResult.error);
}

// Use in workflow
const result = await workflow(async (step) => {
  const validated = await step(fromNeverthrow(validateInput(data)));
  return validated;
});
```

## Low-level: run()

`createWorkflow` is built on `run()`. Use it for one-off workflows:

```typescript
import { run } from '@jagreehal/workflow';

const result = await run(async (step) => {
  const user = await step(fetchUser(id));
  return user;
});
```

### run.strict()

For closed error unions without `UnexpectedError`:

```typescript
import { run } from '@jagreehal/workflow';

type AppError = 'NOT_FOUND' | 'UNAUTHORIZED' | 'UNEXPECTED';

const result = await run.strict<User, AppError>(
  async (step) => {
    return await step(fetchUser(id));
  },
  { catchUnexpected: () => 'UNEXPECTED' as const }
);

// result.error: 'NOT_FOUND' | 'UNAUTHORIZED' | 'UNEXPECTED' (exactly)
```

Prefer `createWorkflow` for automatic error type inference.
