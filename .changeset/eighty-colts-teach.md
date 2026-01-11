---
'@jagreehal/workflow': minor
---

Add batch processing and resource management utilities

**New Features:**

- **Batch Processing** (`processInBatches`): Process items in batches with bounded concurrency, progress tracking, and checkpoint hooks. Useful for I/O-heavy operations like generating embeddings, API calls, or database writes.
  - Configurable batch size, concurrency, and inter-batch delays
  - Progress callbacks for UI updates
  - Checkpoint hooks for database WAL flushing or state persistence
  - Preset configurations (conservative, balanced, aggressive)
  - Available via `@jagreehal/workflow/batch` entry point

- **Resource Management** (`withScope`, `createResourceScope`, `createResource`): RAII-style resource cleanup with automatic guarantees. Ensures resources are closed even if operations fail.
  - LIFO cleanup order (last added = first closed)
  - Automatic cleanup on scope exit (success or failure)
  - Type-safe resource tracking
  - Convenience helpers for acquire/release patterns
  - Available via `@jagreehal/workflow/resource` entry point

**API:**

- `processInBatches(items, process, config, options?)` - Process items in batches
- `batchPresets` - Preset configurations for common scenarios
- `withScope(fn)` - Run function with automatic resource cleanup
- `createResourceScope()` - Create a resource scope manually
- `createResource(acquire, release)` - Create resource from factory functions
