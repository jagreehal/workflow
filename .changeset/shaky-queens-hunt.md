---
'@jagreehal/workflow': minor
---

Enhance type precision throughout the Result API with improved type guards, function overloads, and conditional return types. `Result<T, E, C>` now uses `Ok<T> | Err<E, C>` union instead of inline object types. Type guards `isOk()` and `isErr()` now narrow to `Ok<T>` and `Err<E, C>` types. Functions like `recover()`, `recoverAsync()`, `encodeCachedError()`, and `pendingApproval()` now return precise `Ok<T>` or `Err<E, C>` types instead of generic `Result` types. Added function overloads for `map()`, `andThen()`, and `match()` that provide more precise return types when inputs are known to be `Ok<T>` or `Err<E, C>`. `all()` and `allSettled()` now return `Ok<T>` when all inputs are successful (no errors possible). Improved return types for `from()` and `fromPromise()` to use explicit `Ok<T> | Err<E, C>` unions.
