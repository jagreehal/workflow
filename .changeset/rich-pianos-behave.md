---
'@jagreehal/workflow': minor
---

Improved HTML workflow visualizer with bug fixes and new features. Fixed hover jumping issue by replacing transform scale with filter effects. Fixed node click detection to work with SVG child elements (rect, text). Disabled time travel and heatmap controls for static HTML (these features require live WebSocket connections). Added "Load JSON" functionality allowing users to paste saved workflow state JSON (from `viz.getIR()` or `viz.renderAs('json')`) to load and visualize workflow state in the browser.
