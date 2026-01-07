---
'@jagreehal/workflow': minor
---

### Documentation Improvements

**Save & Resume:**
- Added prominent "Save & Resume" section to README with complete 3-step examples
- Added persistence quickstart section showing database integration patterns
- Updated all examples to use `createStepCollector()` as the recommended approach
- Enhanced payment retry example to show full save/restore flow with database persistence
- Expanded advanced docs with detailed database integration patterns (PostgreSQL, DynamoDB, Redis)

**Workflow Hooks:**
- Expanded workflow hooks documentation with detailed use cases and code examples
- Added 13+ concrete examples for `shouldRun`, `onBeforeStart`, and `onAfterStep` hooks
- Documented use cases: distributed locking, rate limiting, checkpointing, queue visibility, metrics, dead letter queues, and more

These improvements make save/resume functionality and workflow hooks more discoverable and easier to use.
