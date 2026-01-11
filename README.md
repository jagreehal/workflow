# @jagreehal/workflow

Typed async workflows with automatic error inference.

## Install

```bash
npm install @jagreehal/workflow
```

## Quick Example

```typescript
import { createWorkflow, ok, err, type AsyncResult } from '@jagreehal/workflow';

// Define operations that return Result types
const fetchUser = async (id: string): AsyncResult<User, 'NOT_FOUND'> => {
  const user = await db.users.find(id);
  return user ? ok(user) : err('NOT_FOUND');
};

const sendEmail = async (to: string): AsyncResult<void, 'SEND_FAILED'> => {
  const sent = await mailer.send(to, 'Welcome!');
  return sent ? ok(undefined) : err('SEND_FAILED');
};

// Create workflow - error types are inferred automatically
const workflow = createWorkflow({ fetchUser, sendEmail });

// Run workflow - step() unwraps results or exits early
const result = await workflow(async (step) => {
  const user = await step(fetchUser('123'));
  await step(sendEmail(user.email));
  return user;
});

// Handle result
if (result.ok) {
  console.log(result.value.name);
} else {
  // TypeScript knows: 'NOT_FOUND' | 'SEND_FAILED' | UnexpectedError
  console.error(result.error);
}
```

## License

MIT
