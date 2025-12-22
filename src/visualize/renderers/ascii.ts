/**
 * ASCII Terminal Renderer
 *
 * Renders the workflow IR as ASCII art with box-drawing characters
 * and ANSI colors for terminal display.
 */

import type {
  FlowNode,
  ParallelNode,
  RaceNode,
  DecisionNode,
  Renderer,
  RenderOptions,
  StepNode,
  WorkflowIR,
} from "../types";
import { isParallelNode, isRaceNode, isStepNode, isDecisionNode } from "../types";
import { formatDuration } from "../utils/timing";
import {
  bold,
  colorByState,
  colorize,
  defaultColorScheme,
  dim,
  getColoredSymbol,
  stripAnsi,
} from "./colors";

// =============================================================================
// Box Drawing Characters
// =============================================================================

const BOX = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  teeRight: "├",
  teeLeft: "┤",
  teeDown: "┬",
  teeUp: "┴",
  cross: "┼",
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Pad a string to a fixed width, accounting for ANSI codes.
 */
function padEnd(str: string, width: number): string {
  const visibleLen = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLen);
  return str + " ".repeat(padding);
}

/**
 * Create a horizontal line with optional title.
 */
function horizontalLine(width: number, title?: string): string {
  if (!title) {
    return BOX.horizontal.repeat(width);
  }

  const titleText = ` ${title} `;
  const remainingWidth = width - titleText.length;
  if (remainingWidth < 4) {
    return BOX.horizontal.repeat(width);
  }

  const leftPad = 2;
  const rightPad = remainingWidth - leftPad;

  return (
    BOX.horizontal.repeat(leftPad) + titleText + BOX.horizontal.repeat(rightPad)
  );
}

// =============================================================================
// ASCII Renderer
// =============================================================================

/**
 * Create the ASCII terminal renderer.
 */
export function asciiRenderer(): Renderer {
  return {
    name: "ascii",
    supportsLive: true,

    render(ir: WorkflowIR, options: RenderOptions): string {
      const colors = { ...defaultColorScheme, ...options.colors };
      const width = options.terminalWidth ?? 60;
      const innerWidth = width - 4; // Account for borders

      const lines: string[] = [];

      // Header
      const workflowName = ir.root.name ?? "workflow";
      const headerTitle = bold(workflowName);
      lines.push(
        `${BOX.topLeft}${horizontalLine(width - 2, headerTitle)}${BOX.topRight}`
      );
      lines.push(`${BOX.vertical}${" ".repeat(width - 2)}${BOX.vertical}`);

      // Render children
      const childLines = renderNodes(ir.root.children, options, colors, 0);
      for (const line of childLines) {
        lines.push(
          `${BOX.vertical}  ${padEnd(line, innerWidth)}${BOX.vertical}`
        );
      }

      // Footer with timing
      lines.push(`${BOX.vertical}${" ".repeat(width - 2)}${BOX.vertical}`);

      if (ir.root.durationMs !== undefined && options.showTimings) {
        const status = ir.root.state === "success" ? "Completed" : "Failed";
        const statusColored = colorByState(status, ir.root.state, colors);
        const footer = `${statusColored} in ${formatDuration(ir.root.durationMs)}`;
        lines.push(
          `${BOX.vertical}  ${padEnd(footer, innerWidth)}${BOX.vertical}`
        );
        lines.push(`${BOX.vertical}${" ".repeat(width - 2)}${BOX.vertical}`);
      }

      lines.push(
        `${BOX.bottomLeft}${BOX.horizontal.repeat(width - 2)}${BOX.bottomRight}`
      );

      return lines.join("\n");
    },
  };
}

/**
 * Render a list of nodes.
 */
function renderNodes(
  nodes: FlowNode[],
  options: RenderOptions,
  colors: ReturnType<typeof Object.assign>,
  depth: number
): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    if (isStepNode(node)) {
      lines.push(renderStepNode(node, options, colors));
    } else if (isParallelNode(node)) {
      lines.push(...renderParallelNode(node, options, colors, depth));
    } else if (isRaceNode(node)) {
      lines.push(...renderRaceNode(node, options, colors, depth));
    } else if (isDecisionNode(node)) {
      lines.push(...renderDecisionNode(node, options, colors, depth));
    }
  }

  return lines;
}

/**
 * Render a single step node.
 */
function renderStepNode(
  node: StepNode,
  options: RenderOptions,
  colors: ReturnType<typeof Object.assign>
): string {
  const symbol = getColoredSymbol(node.state, colors);
  const name = node.name ?? node.key ?? "step";
  const nameColored = colorByState(name, node.state, colors);

  let line = `${symbol} ${nameColored}`;

  // Add key if requested
  if (options.showKeys && node.key) {
    line += dim(` [key: ${node.key}]`);
  }

  // Add input/output if available (for decision understanding)
  if (node.input !== undefined) {
    const inputStr = typeof node.input === "string" 
      ? node.input 
      : JSON.stringify(node.input).slice(0, 30);
    line += dim(` [in: ${inputStr}${inputStr.length >= 30 ? "..." : ""}]`);
  }
  if (node.output !== undefined && node.state === "success") {
    const outputStr = typeof node.output === "string"
      ? node.output
      : JSON.stringify(node.output).slice(0, 30);
    line += dim(` [out: ${outputStr}${outputStr.length >= 30 ? "..." : ""}]`);
  }

  // Add timing if available and requested
  if (options.showTimings && node.durationMs !== undefined) {
    line += dim(` [${formatDuration(node.durationMs)}]`);
  }

  return line;
}

/**
 * Render a parallel node (allAsync).
 */
function renderParallelNode(
  node: ParallelNode,
  options: RenderOptions,
  colors: ReturnType<typeof Object.assign>,
  depth: number
): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  // Header
  const symbol = getColoredSymbol(node.state, colors);
  const name = node.name ?? "parallel";
  const mode = node.mode === "allSettled" ? " (allSettled)" : "";
  lines.push(`${indent}${BOX.teeRight}${BOX.teeDown}${BOX.horizontal} ${symbol} ${bold(name)}${mode}`);

  // Children
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isLast = i === node.children.length - 1;
    const prefix = isLast ? `${indent}${BOX.vertical} ${BOX.bottomLeft}` : `${indent}${BOX.vertical} ${BOX.teeRight}`;

    if (isStepNode(child)) {
      lines.push(`${prefix} ${renderStepNode(child, options, colors)}`);
    } else {
      // Nested structure - recurse
      const nestedLines = renderNodes([child], options, colors, depth + 1);
      for (const line of nestedLines) {
        lines.push(`${indent}${BOX.vertical}   ${line}`);
      }
    }
  }

  // Timing footer
  if (options.showTimings && node.durationMs !== undefined) {
    lines.push(`${indent}${BOX.bottomLeft}${BOX.horizontal}${BOX.horizontal} ${dim(`[${formatDuration(node.durationMs)}]`)}`);
  }

  return lines;
}

/**
 * Render a race node (anyAsync).
 */
function renderRaceNode(
  node: RaceNode,
  options: RenderOptions,
  colors: ReturnType<typeof Object.assign>,
  depth: number
): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  // Header with lightning bolt for race
  const symbol = getColoredSymbol(node.state, colors);
  const name = node.name ?? "race";
  lines.push(`${indent}${BOX.teeRight}⚡ ${symbol} ${bold(name)}`);

  // Children
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isLast = i === node.children.length - 1;
    const prefix = isLast ? `${indent}${BOX.vertical} ${BOX.bottomLeft}` : `${indent}${BOX.vertical} ${BOX.teeRight}`;

    // Mark winner
    const isWinner = node.winnerId && child.id === node.winnerId;
    const winnerSuffix = isWinner ? dim(" (winner)") : "";

    if (isStepNode(child)) {
      lines.push(`${prefix} ${renderStepNode(child, options, colors)}${winnerSuffix}`);
    } else {
      const nestedLines = renderNodes([child], options, colors, depth + 1);
      for (const line of nestedLines) {
        lines.push(`${indent}${BOX.vertical}   ${line}`);
      }
    }
  }

  // Timing footer
  if (options.showTimings && node.durationMs !== undefined) {
    lines.push(`${indent}${BOX.bottomLeft}${BOX.horizontal}${BOX.horizontal} ${dim(`[${formatDuration(node.durationMs)}]`)}`);
  }

  return lines;
}

/**
 * Render a decision node (conditional branch).
 */
function renderDecisionNode(
  node: DecisionNode,
  options: RenderOptions,
  colors: ReturnType<typeof Object.assign>,
  depth: number
): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  // Header with decision info
  const symbol = getColoredSymbol(node.state, colors);
  const name = node.name ?? "decision";
  const condition = node.condition 
    ? dim(` (${node.condition})`)
    : "";
  const decisionValue = node.decisionValue !== undefined
    ? dim(` = ${String(node.decisionValue)}`)
    : "";
  const branchTaken = node.branchTaken !== undefined
    ? dim(` → ${String(node.branchTaken)}`)
    : "";

  lines.push(
    `${indent}${BOX.teeRight}${BOX.teeDown}${BOX.horizontal} ${symbol} ${bold(name)}${condition}${decisionValue}${branchTaken}`
  );

  // Render branches
  for (let i = 0; i < node.branches.length; i++) {
    const branch = node.branches[i];
    const isLast = i === node.branches.length - 1;
    const prefix = isLast 
      ? `${indent}${BOX.vertical} ${BOX.bottomLeft}` 
      : `${indent}${BOX.vertical} ${BOX.teeRight}`;

    // Branch label with taken/skipped indicator
    const branchSymbol = branch.taken ? "✓" : "⊘";
    const branchColor = branch.taken ? colors.success : colors.skipped;
    const branchLabel = colorize(
      `${branchSymbol} ${branch.label}`,
      branchColor
    );
    const branchCondition = branch.condition
      ? dim(` (${branch.condition})`)
      : "";

    lines.push(`${prefix} ${branchLabel}${branchCondition}`);

    // Render children of this branch
    if (branch.children.length > 0) {
      const childLines = renderNodes(branch.children, options, colors, depth + 1);
      for (const line of childLines) {
        lines.push(`${indent}${BOX.vertical}   ${line}`);
      }
    } else if (!branch.taken) {
      // Show that this branch was skipped
      lines.push(
        `${indent}${BOX.vertical}   ${dim("(skipped)")}`
      );
    }
  }

  // Timing footer
  if (options.showTimings && node.durationMs !== undefined) {
    lines.push(
      `${indent}${BOX.bottomLeft}${BOX.horizontal}${BOX.horizontal} ${dim(`[${formatDuration(node.durationMs)}]`)}`
    );
  }

  return lines;
}

export { defaultColorScheme };
