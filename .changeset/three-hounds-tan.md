---
'@jagreehal/workflow': minor
---

Add retry and timeout capabilities to workflow steps. Steps can now automatically retry on failures with configurable backoff strategies (fixed, linear, exponential), jitter, and retry predicates. Steps can also be wrapped with timeouts, with optional AbortSignal support for proper cancellation. Retry and timeout information is automatically tracked and visualized in workflow visualizations.
