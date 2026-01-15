---
'@jagreehal/workflow': minor
---

Add Match API for exhaustive pattern matching, Schedule API for composable retry strategies, and Duration API for type-safe time handling. Enhance resource management documentation with real-world scenarios.

**New Features:**

- **Match API** (`Match`): Exhaustive pattern matching for discriminated unions with compile-time exhaustiveness checking. Ensures all cases are handled when matching on tagged unions.
  - `Match.value()`, `Match.tag()`, `Match.tags()`, `Match.when()` for pattern matching
  - `Match.exhaustive`, `Match.orElse()`, `Match.orElseValue()` for completion
  - `Match.is()`, `Match.isOneOf()` for type guards
  - Available via `@jagreehal/workflow` main export

- **Schedule API** (`Schedule`): Composable scheduling primitives for building complex retry and polling strategies by combining simple building blocks.
  - Base schedules: `forever()`, `recurs(n)`, `once()`, `stop()`
  - Delay-based: `spaced()`, `exponential()`, `linear()`, `fibonacci()`
  - Combinators: `upTo(n)`, `maxDelay()`, `jittered()`, `andThen()`, `union()`, `intersect()`
  - Transformations: `map()`, `tap()`, `modifyDelay()`
  - Running: `Schedule.run()`, `Schedule.delays()`
  - Available via `@jagreehal/workflow` main export

- **Duration API** (`Duration`): Type-safe duration handling that prevents unit confusion (milliseconds vs seconds) with explicit constructors.
  - Constructors: `millis()`, `seconds()`, `minutes()`, `hours()`, `days()`
  - Conversions: `toMillis()`, `toSeconds()`, `toMinutes()`, etc.
  - Operations: `add()`, `subtract()`, `multiply()`, `divide()`
  - Comparisons: `lessThan()`, `greaterThan()`, `equals()`, `min()`, `max()`, `clamp()`
  - Formatting: `format()`, `parse()`
  - Available via `@jagreehal/workflow` main export

**Documentation:**

- Add comprehensive documentation for Match API with real-world examples (payment processing, subscription billing, notification routing, form validation)
- Add comprehensive documentation for Schedule API with real-world scenarios (database reconnection, email service retries, webhook delivery, background job processing)
- Add real-world scenarios to resource management documentation (database transactions with file uploads, multi-tenant data export, webhook processing with temporary credentials)
- Fix API usage in resource management examples (corrected `scope.acquire()` to `scope.add()`)
- Add test files for all new documentation to ensure code examples compile and run correctly
