/**
 * Mermaid Diagram Renderer
 *
 * Renders the workflow IR as a Mermaid flowchart diagram.
 * Supports sequential flows, parallel (subgraph), and race patterns.
 */

import type {
  FlowNode,
  ParallelNode,
  RaceNode,
  DecisionNode,
  Renderer,
  RenderOptions,
  StepNode,
  StepState,
  WorkflowIR,
} from "../types";
import { isParallelNode, isRaceNode, isStepNode, isDecisionNode } from "../types";
import { formatDuration } from "../utils/timing";

// =============================================================================
// Mermaid Style Definitions
// =============================================================================

/**
 * Get Mermaid class definition for step states.
 */
function getStyleDefinitions(): string[] {
  return [
    "    classDef pending fill:#e5e7eb,stroke:#9ca3af,color:#374151",
    "    classDef running fill:#fef3c7,stroke:#f59e0b,color:#92400e",
    "    classDef success fill:#d1fae5,stroke:#10b981,color:#065f46",
    "    classDef error fill:#fee2e2,stroke:#ef4444,color:#991b1b",
    "    classDef aborted fill:#f3f4f6,stroke:#6b7280,color:#4b5563",
    "    classDef cached fill:#dbeafe,stroke:#3b82f6,color:#1e40af",
    // Note: Use a lighter fill color to distinguish skipped steps visually
    // Mermaid classDef only supports: fill, stroke, color, stroke-width (without px unit)
    "    classDef skipped fill:#f9fafb,stroke:#d1d5db,color:#6b7280",
  ];
}

/**
 * Get the Mermaid class name for a step state.
 */
function getStateClass(state: StepState): string {
  return state;
}

// =============================================================================
// Node ID Generation
// =============================================================================

let nodeCounter = 0;

function generateNodeId(prefix: string = "node"): string {
  return `${prefix}_${++nodeCounter}`;
}

function resetNodeCounter(): void {
  nodeCounter = 0;
}

// =============================================================================
// Mermaid Text Escaping
// =============================================================================

/**
 * Escape text for use in Mermaid diagrams.
 * Removes characters that break Mermaid parsing.
 * 
 * Characters removed:
 * - {}[]() - Brackets and parentheses break parsing in labels
 * - <> - Angle brackets can cause issues
 * - " - Double quotes replaced with single quotes
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for Mermaid
 */
function escapeMermaidText(text: string): string {
  return text
    .replace(/[{}[\]()]/g, "") // Remove brackets and parentheses (they break parsing)
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/"/g, "'") // Replace double quotes with single
    .trim();
}

/**
 * Escape text for use in Mermaid subgraph names.
 * Subgraph names in brackets need special handling.
 * 
 * @param text - Text to escape for subgraph name
 * @returns Escaped text safe for subgraph names
 */
function escapeSubgraphName(text: string): string {
  return escapeMermaidText(text)
    .replace(/[[\]]/g, ""); // Also remove brackets from subgraph names
}

// =============================================================================
// Mermaid Renderer
// =============================================================================

/**
 * Create the Mermaid diagram renderer.
 */
export function mermaidRenderer(): Renderer {
  return {
    name: "mermaid",
    supportsLive: false,

    render(ir: WorkflowIR, options: RenderOptions): string {
      resetNodeCounter();
      const lines: string[] = [];

      // Diagram header
      lines.push("flowchart TD");

      // Start node
      const startId = "start";
      lines.push(`    ${startId}((Start))`);

      // Track the last node for connections
      let prevNodeId = startId;

      // Render children
      for (const child of ir.root.children) {
        const result = renderNode(child, options, lines);
        lines.push(`    ${prevNodeId} --> ${result.entryId}`);
        prevNodeId = result.exitId;
      }

      // End node (if workflow completed)
      if (ir.root.state === "success" || ir.root.state === "error") {
        const endId = "finish";
        const endShape =
          ir.root.state === "success" ? `((Done))` : `((Failed))`;
        const endClass =
          ir.root.state === "success" ? ":::success" : ":::error";
        lines.push(`    ${endId}${endShape}${endClass}`);
        lines.push(`    ${prevNodeId} --> ${endId}`);
      }

      // Add style definitions
      lines.push("");
      lines.push(...getStyleDefinitions());

      return lines.join("\n");
    },
  };
}

/**
 * Render result with entry and exit node IDs.
 */
interface RenderResult {
  entryId: string;
  exitId: string;
}

/**
 * Render a node and return its entry/exit IDs.
 */
function renderNode(
  node: FlowNode,
  options: RenderOptions,
  lines: string[]
): RenderResult {
  if (isStepNode(node)) {
    return renderStepNode(node, options, lines);
  } else if (isParallelNode(node)) {
    return renderParallelNode(node, options, lines);
  } else if (isRaceNode(node)) {
    return renderRaceNode(node, options, lines);
  } else if (isDecisionNode(node)) {
    return renderDecisionNode(node, options, lines);
  }

  // Fallback for sequence or unknown nodes
  const id = generateNodeId("unknown");
  lines.push(`    ${id}[Unknown Node]`);
  return { entryId: id, exitId: id };
}

/**
 * Render a step node.
 */
function renderStepNode(
  node: StepNode,
  options: RenderOptions,
  lines: string[]
): RenderResult {
  const id = node.key
    ? `step_${node.key.replace(/[^a-zA-Z0-9]/g, "_")}`
    : generateNodeId("step");

  const label = escapeMermaidText(node.name ?? node.key ?? "Step");
  
  // Format timing - use space instead of parentheses to avoid Mermaid parse errors
  const timing =
    options.showTimings && node.durationMs !== undefined
      ? ` ${formatDuration(node.durationMs)}`
      : "";

  // Add input/output info if available
  // Use newlines for multi-line labels, but escape special characters
  let ioInfo = "";
  if (node.input !== undefined) {
    const inputStr = typeof node.input === "string"
      ? escapeMermaidText(node.input)
      : escapeMermaidText(JSON.stringify(node.input).slice(0, 20));
    ioInfo += `\\nin: ${inputStr}`;
  }
  if (node.output !== undefined && node.state === "success") {
    const outputStr = typeof node.output === "string"
      ? escapeMermaidText(node.output)
      : escapeMermaidText(JSON.stringify(node.output).slice(0, 20));
    ioInfo += `\\nout: ${outputStr}`;
  }

  // Combine all label parts
  const escapedLabel = (label + ioInfo + timing).trim();

  const stateClass = getStateClass(node.state);

  // Use different shapes based on state
  let shape: string;
  switch (node.state) {
    case "error":
      shape = `{{${escapedLabel}}}`;
      break;
    case "cached":
      shape = `[(${escapedLabel})]`;
      break;
    case "skipped":
      shape = `[${escapedLabel}]:::skipped`;
      break;
    default:
      shape = `[${escapedLabel}]`;
  }

  lines.push(`    ${id}${shape}:::${stateClass}`);

  return { entryId: id, exitId: id };
}

/**
 * Render a parallel node as a subgraph with fork/join.
 */
function renderParallelNode(
  node: ParallelNode,
  options: RenderOptions,
  lines: string[]
): RenderResult {
  const subgraphId = generateNodeId("parallel");
  const forkId = `${subgraphId}_fork`;
  const joinId = `${subgraphId}_join`;
  const name = escapeSubgraphName(node.name ?? "Parallel");

  // Subgraph for parallel block
  lines.push(`    subgraph ${subgraphId}[${name}]`);
  lines.push(`    direction TB`);

  // Fork node (diamond)
  lines.push(`    ${forkId}{Fork}`);

  // Child branches
  const childExitIds: string[] = [];
  for (const child of node.children) {
    const result = renderNode(child, options, lines);
    lines.push(`    ${forkId} --> ${result.entryId}`);
    childExitIds.push(result.exitId);
  }

  // Join node (diamond)
  lines.push(`    ${joinId}{Join}`);
  for (const exitId of childExitIds) {
    lines.push(`    ${exitId} --> ${joinId}`);
  }

  lines.push(`    end`);

  // Apply state styling to subgraph via a connecting node
  const stateClass = getStateClass(node.state);
  lines.push(`    class ${subgraphId} ${stateClass}`);

  return { entryId: forkId, exitId: joinId };
}

/**
 * Render a race node as a subgraph with racing indicator.
 */
function renderRaceNode(
  node: RaceNode,
  options: RenderOptions,
  lines: string[]
): RenderResult {
  const subgraphId = generateNodeId("race");
  const startId = `${subgraphId}_start`;
  const endId = `${subgraphId}_end`;
  const name = escapeSubgraphName(node.name ?? "Race");

  // Subgraph for race block - escape name and emoji is safe in quoted strings
  lines.push(`    subgraph ${subgraphId}["⚡ ${name}"]`);
  lines.push(`    direction TB`);

  // Start node
  lines.push(`    ${startId}((Race))`);

  // Child branches
  const childExitIds: string[] = [];
  for (const child of node.children) {
    const result = renderNode(child, options, lines);
    lines.push(`    ${startId} --> ${result.entryId}`);
    childExitIds.push(result.exitId);

    // Mark winner
    if (isStepNode(child) && node.winnerId === child.id) {
      lines.push(`    ${result.exitId} -. winner .-> ${endId}`);
    }
  }

  // End node
  lines.push(`    ${endId}((First))`);
  for (const exitId of childExitIds) {
    if (
      !node.winnerId ||
      !node.children.some((c) => isStepNode(c) && c.id === node.winnerId)
    ) {
      lines.push(`    ${exitId} --> ${endId}`);
    }
  }

  lines.push(`    end`);

  const stateClass = getStateClass(node.state);
  lines.push(`    class ${subgraphId} ${stateClass}`);

  return { entryId: startId, exitId: endId };
}

/**
 * Render a decision node as a diamond with branches.
 */
function renderDecisionNode(
  node: DecisionNode,
  options: RenderOptions,
  lines: string[]
): RenderResult {
  const decisionId = node.key
    ? `decision_${node.key.replace(/[^a-zA-Z0-9]/g, "_")}`
    : generateNodeId("decision");

  // Escape condition and decision value - remove characters that break Mermaid
  const condition = escapeMermaidText(node.condition ?? "condition");
  const decisionValue = node.decisionValue !== undefined
    ? ` = ${escapeMermaidText(String(node.decisionValue)).slice(0, 30)}`
    : "";

  // Decision diamond - ensure no invalid characters
  const decisionLabel = `${condition}${decisionValue}`.trim();
  lines.push(`    ${decisionId}{${decisionLabel}}`);

  // Render branches
  const branchExitIds: string[] = [];
  let takenBranchExitId: string | undefined;

  for (const branch of node.branches) {
    const branchId = `${decisionId}_${branch.label.replace(/[^a-zA-Z0-9]/g, "_")}`;
    // Escape branch label - remove parentheses and other special chars
    const branchLabelText = escapeMermaidText(branch.label);
    const branchLabel = branch.taken
      ? `${branchLabelText} ✓`
      : `${branchLabelText} skipped`;
    const branchClass = branch.taken ? ":::success" : ":::skipped";

    // Branch label node
    lines.push(`    ${branchId}[${branchLabel}]${branchClass}`);

    // Connect decision to branch
    // Mermaid edge labels must be simple text - escape special characters
    // Also remove pipe character as it's used for edge label syntax
    const edgeLabel = branch.condition 
      ? `|${escapeMermaidText(branch.condition).replace(/\|/g, "")}|` 
      : "";
    lines.push(`    ${decisionId} -->${edgeLabel} ${branchId}`);

    // Render children of this branch
    if (branch.children.length > 0) {
      let prevId = branchId;
      for (const child of branch.children) {
        const result = renderNode(child, options, lines);
        lines.push(`    ${prevId} --> ${result.entryId}`);
        prevId = result.exitId;
      }
      branchExitIds.push(prevId);
      if (branch.taken) {
        takenBranchExitId = prevId;
      }
    } else {
      branchExitIds.push(branchId);
      if (branch.taken) {
        takenBranchExitId = branchId;
      }
    }
  }

  // Join point (if we have a taken branch)
  if (takenBranchExitId) {
    return { entryId: decisionId, exitId: takenBranchExitId };
  }

  // If no branch was taken, return decision as exit
  return { entryId: decisionId, exitId: decisionId };
}

export { mermaidRenderer as default };
