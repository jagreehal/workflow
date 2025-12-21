# @jagreehal/workflow

## 1.1.0

### Minor Changes

- 41249eb: Add `step.fromResult()` for mapping typed Result errors

  - Added `step.fromResult()` method that accepts Result-returning functions and maps their typed errors
  - Unlike `step.try()` where `onError` receives `unknown`, `step.fromResult()` preserves the error type in the callback
  - Updated documentation with `run()` vs `createWorkflow()` decision guide
  - Added JSDoc explaining when to use each workflow execution method
