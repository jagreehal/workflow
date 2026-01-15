# Policies

Reusable bundles of retry, timeout, and naming options. Define once, apply everywhere.

## The Problem: Scattered Configuration

Retry and timeout settings end up scattered across your codebase:

```typescript
// ❌ Same config repeated everywhere
const user = await step.retry(
  () => fetchUser(id),
  { attempts: 3, backoff: 'exponential', initialDelay: 200, maxDelay: 5000 }
);

const orders = await step.retry(
  () => fetchOrders(id),
  { attempts: 3, backoff: 'exponential', initialDelay: 200, maxDelay: 5000 }  // Copy-pasted
);

const settings = await step.retry(
  () => fetchSettings(id),
  { attempts: 3, backoff: 'exponential', initialDelay: 200, maxDelay: 5000 }  // Again!
);
```

When you need to change retry behavior, you hunt through dozens of files.

## The Solution: Policies

Define retry/timeout bundles once, apply them consistently:

```typescript
import { servicePolicies, withPolicy } from '@jagreehal/workflow';

// ✓ One policy, used everywhere
const user = await step(
  () => fetchUser(id),
  withPolicy(servicePolicies.httpApi, 'Fetch user')
);

const orders = await step(
  () => fetchOrders(id),
  withPolicy(servicePolicies.httpApi, 'Fetch orders')
);
```

Change the policy definition, all usages update.

## Pre-Built Policies

### Retry Policies

```typescript
import { retryPolicies } from '@jagreehal/workflow';

retryPolicies.none        // No retry (1 attempt)
retryPolicies.transient   // 3 attempts, fast exponential backoff
retryPolicies.standard    // 3 attempts, moderate backoff (200ms-5s)
retryPolicies.aggressive  // 5 attempts, longer backoff (500ms-30s)

// Builders
retryPolicies.fixed(3, 1000)           // 3 attempts, 1s fixed interval
retryPolicies.linear(5, 500)           // 5 attempts, linear backoff from 500ms
retryPolicies.custom({ attempts: 4 })  // Custom with defaults
```

### Timeout Policies

```typescript
import { timeoutPolicies } from '@jagreehal/workflow';

timeoutPolicies.none       // No timeout
timeoutPolicies.fast       // 1 second
timeoutPolicies.api        // 5 seconds
timeoutPolicies.extended   // 30 seconds
timeoutPolicies.long       // 2 minutes

// Builders
timeoutPolicies.ms(3000)              // 3 seconds
timeoutPolicies.seconds(10)           // 10 seconds
timeoutPolicies.withSignal(5000)      // 5s with AbortSignal support
```

### Service Policies (Combined)

```typescript
import { servicePolicies } from '@jagreehal/workflow';

servicePolicies.httpApi       // 5s timeout + 3 retries (standard)
servicePolicies.database      // 30s timeout + 2 retries
servicePolicies.cache         // 1s timeout + no retry
servicePolicies.messageQueue  // 30s timeout + 5 retries (aggressive)
servicePolicies.fileSystem    // 2min timeout + 3 retries
servicePolicies.rateLimited   // 10s timeout + 5 retries (linear backoff)
```

## Applying Policies

### `withPolicy` - Single Policy

```typescript
import { withPolicy, servicePolicies } from '@jagreehal/workflow';

const user = await step(
  () => fetchUser(id),
  withPolicy(servicePolicies.httpApi, { name: 'Fetch user', key: `user:${id}` })
);

// Shorthand: pass name as string
const user = await step(
  () => fetchUser(id),
  withPolicy(servicePolicies.httpApi, 'Fetch user')
);
```

### `withPolicies` - Multiple Policies

```typescript
import { withPolicies, timeoutPolicies, retryPolicies } from '@jagreehal/workflow';

const data = await step(
  () => fetchData(id),
  withPolicies(
    [timeoutPolicies.api, retryPolicies.transient],
    { name: 'Fetch data' }
  )
);
```

Later policies override earlier ones for conflicts.

### `mergePolicies` - Create Custom Bundles

```typescript
import { mergePolicies, timeoutPolicies, retryPolicies } from '@jagreehal/workflow';

const myApiPolicy = mergePolicies(
  timeoutPolicies.api,
  retryPolicies.standard,
  { name: 'api-call' }  // Default name
);

// Use it
const user = await step(
  () => fetchUser(id),
  withPolicy(myApiPolicy, 'Fetch user')  // Override name
);
```

## Policy Registry

For larger apps, organize policies in a registry:

```typescript
import { createPolicyRegistry, servicePolicies } from '@jagreehal/workflow';

// Create and populate registry
const policies = createPolicyRegistry();

policies.register('api', servicePolicies.httpApi);
policies.register('db', servicePolicies.database);
policies.register('cache', servicePolicies.cache);
policies.register('queue', servicePolicies.messageQueue);

// Export for app-wide use
export { policies };
```

Use in workflows:

```typescript
import { policies } from './config/policies';

const workflow = createWorkflow(deps);

const result = await workflow(async (step) => {
  const user = await step(
    () => fetchUser(id),
    policies.apply('api', 'Fetch user')
  );

  const cached = await step(
    () => checkCache(id),
    policies.apply('cache', 'Check cache')
  );

  return ok({ user, cached });
});
```

Registry methods:

```typescript
policies.register('name', policy)  // Add policy
policies.get('name')               // Get policy or undefined
policies.has('name')               // Check existence
policies.names()                   // List all registered names
policies.apply('name', options)    // Apply policy with step options
```

## Fluent Builder

For one-off complex configurations:

```typescript
import { stepOptions } from '@jagreehal/workflow';

const options = stepOptions()
  .name('Fetch user profile')
  .key(`user:${id}`)
  .timeout(5000)
  .retries(3)
  .build();

const user = await step(() => fetchUser(id), options);
```

Chain methods:

```typescript
stepOptions()
  .name('step-name')                    // Set step name
  .key('cache-key')                     // Set caching key
  .timeout(5000)                        // Set timeout in ms
  .retries(3)                           // Set retry count (with defaults)
  .retry({ attempts: 3, backoff: 'linear' })  // Full retry config
  .policy(servicePolicies.httpApi)      // Apply a policy
  .build()                              // Get StepOptions
```

## Conditional Policies

### `conditionalPolicy` - Based on Boolean

```typescript
import { conditionalPolicy, servicePolicies, retryPolicies } from '@jagreehal/workflow';

const isProduction = process.env.NODE_ENV === 'production';

const policy = conditionalPolicy(
  isProduction,
  servicePolicies.httpApi,    // Production: full retries
  retryPolicies.none          // Dev: fail fast
);
```

### `envPolicy` - Based on Environment

```typescript
import { envPolicy, servicePolicies, retryPolicies } from '@jagreehal/workflow';

const policy = envPolicy({
  production: servicePolicies.httpApi,
  staging: servicePolicies.httpApi,
  development: retryPolicies.none,
  test: retryPolicies.none,
});
// Uses NODE_ENV to select policy
```

With default fallback:

```typescript
const policy = envPolicy(
  { production: servicePolicies.httpApi },
  process.env.NODE_ENV,
  retryPolicies.none  // Default if env not found
);
```

## Creating Policy Appliers

For workflows that consistently use the same policies:

```typescript
import { createPolicyApplier, servicePolicies } from '@jagreehal/workflow';

// Create applier with base policies
const apiStep = createPolicyApplier(servicePolicies.httpApi);
const dbStep = createPolicyApplier(servicePolicies.database);

// Use in workflow
const result = await workflow(async (step) => {
  const user = await step(() => fetchUser(id), apiStep('Fetch user'));
  const orders = await step(() => queryOrders(id), dbStep('Query orders'));
  return ok({ user, orders });
});
```

## Custom Policies

### Custom Retry

```typescript
import { retryPolicy } from '@jagreehal/workflow';

const myRetryPolicy = retryPolicy({
  attempts: 4,
  backoff: 'exponential',
  initialDelay: 100,
  maxDelay: 10000,
  jitter: true,
});
```

### Custom Timeout

```typescript
import { timeoutPolicy } from '@jagreehal/workflow';

const myTimeoutPolicy = timeoutPolicy({
  ms: 15000,
  signal: true,  // Propagate AbortSignal
});
```

### Combined Custom

```typescript
import { mergePolicies, retryPolicy, timeoutPolicy } from '@jagreehal/workflow';

const myServicePolicy = mergePolicies(
  timeoutPolicy({ ms: 10000 }),
  retryPolicy({
    attempts: 3,
    backoff: 'linear',
    initialDelay: 500,
    jitter: true,
  })
);
```

## Best Practices

### DO: Define policies at the module level

```typescript
// policies.ts
export const policies = {
  userService: mergePolicies(timeoutPolicies.api, retryPolicies.standard),
  paymentService: mergePolicies(timeoutPolicies.extended, retryPolicies.aggressive),
  cacheLayer: servicePolicies.cache,
};
```

### DON'T: Create policies inline

```typescript
// ✗ Hard to maintain, easy to drift
const user = await step(
  () => fetchUser(id),
  { retry: { attempts: 3, backoff: 'exponential' }, timeout: { ms: 5000 } }
);
```

### DO: Use registry for large apps

```typescript
// Central registry, import everywhere
const policies = createPolicyRegistry();
policies.register('external-api', servicePolicies.httpApi);
policies.register('internal-api', servicePolicies.cache);
```

### DO: Use environment-based policies

```typescript
// Different behavior per environment
const apiPolicy = envPolicy({
  production: servicePolicies.httpApi,
  development: mergePolicies(timeoutPolicies.fast, retryPolicies.none),
  test: retryPolicies.none,
});
```

## When NOT to Use This

- **Simple scripts** - Inline options are fine for one-off code
- **Single retry config** - If everything uses the same config, a constant is enough
- **Framework provides** - If your HTTP client has retry built-in, don't double-up

## Summary

| Function | Purpose |
| -------- | ------- |
| `withPolicy(policy, opts)` | Apply single policy to step |
| `withPolicies([...], opts)` | Apply multiple policies |
| `mergePolicies(...policies)` | Combine policies into one |
| `createPolicyApplier(...policies)` | Create reusable applier function |
| `createPolicyRegistry()` | Centralized policy management |
| `stepOptions()` | Fluent builder for complex configs |
| `conditionalPolicy(cond, a, b)` | Select policy by condition |
| `envPolicy(map)` | Select policy by NODE_ENV |

**The key insight:** Define retry/timeout behavior once, apply consistently. When requirements change, update one place.
