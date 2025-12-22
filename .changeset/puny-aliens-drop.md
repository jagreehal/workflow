---
'@jagreehal/workflow': minor
---

## Enhanced Workflow Visualization

### New Features

- **Decision Tracking**: Visualize conditional logic (if/switch statements) with explicit decision points showing which branches were taken or skipped
- **Input/Output Display**: Step nodes now show input and output values in both ASCII and Mermaid diagrams for better debugging
- **Skipped Steps**: Steps that are skipped due to conditional logic are now clearly marked in visualizations
- **Mermaid Validation**: All generated Mermaid diagrams are now validated to ensure they render correctly without parse errors

### Improvements

- **Better Conditional Flow**: Decision nodes show the condition, decision value, and which branch was taken
- **Robust Text Escaping**: All user-generated text (step names, conditions, values) is properly escaped to prevent Mermaid syntax errors
- **Comprehensive Testing**: Added validation tests for special characters in step names, subgraph names, and decision labels

### Technical Details

- Added `trackDecision`, `trackIf`, and `trackSwitch` helper functions for explicit decision tracking
- Enhanced `WorkflowIR` with `DecisionNode` type and `skipped` step state
- Improved Mermaid renderer with centralized text escaping functions
