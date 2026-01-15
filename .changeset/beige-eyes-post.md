---
'@jagreehal/workflow': minor
---

Added `renderAs('logger')` method to visualizer for structured logging output. The logger renderer outputs JSON-optimized workflow data including workflow metadata, step details, summary statistics (slowest step, retry counts, error counts), and optional ASCII diagram. Works with any structured logger (Pino, Winston, console, OpenTelemetry). Updated Pino logging documentation with examples.
