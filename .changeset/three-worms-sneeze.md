---
'@jagreehal/workflow': minor
---

Improve type display for `ok()` and `err()` functions. They now return `Ok<T>` and `Err<E, C>` types instead of the more verbose `Result<T, never, never>` and `Result<never, E, C>`. This provides cleaner IDE tooltips and better developer experience while maintaining full type safety. The `Ok` and `Err` types are now exported for use in type annotations.
