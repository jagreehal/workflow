---
'@jagreehal/workflow': minor
---

Improve type precision for type guards and error functions. `isOk()` and `isErr()` now narrow to `Ok<T>` and `Err<E, C>` types instead of inline object types. `recover()` and `recoverAsync()` now return `Ok<T>` instead of `Result<T, never, never>`. Error functions like `encodeCachedError()` and `pendingApproval()` now return `Err<E, C>` instead of `Result<never, E, C>`.
