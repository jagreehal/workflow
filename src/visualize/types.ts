/**
 * Workflow Visualization - Intermediate Representation Types
 *
 * The IR (Intermediate Representation) is a DSL that represents workflow
 * execution structure. Events are converted to IR, which can then be
 * rendered to various output formats (ASCII, Mermaid, JSON, etc.).
 */

// =============================================================================
// Step States
// =============================================================================

/**
 * Execution state of a step with semantic meaning for visualization.
 *
 * Color mapping:
 * - pending  → white/clear (not started)
 * - running  → yellow (currently executing)
 * - success  → green (completed successfully)
 * - error    → red (failed with error)
 * - aborted  → gray (cancelled, e.g., in race)
 * - cached   → blue (served from cache)
 * - skipped  → dim gray (not executed due to conditional logic)
 */
export type StepState =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "aborted"
  | "cached"
  | "skipped";

// =============================================================================
// Node Types
// =============================================================================

/**
 * Base properties shared by all IR nodes.
 */
export interface BaseNode {
  /** Unique identifier for this node */
  id: string;
  /** Human-readable name (from step options or inferred) */
  name?: string;
  /** Cache key if this is a keyed step */
  key?: string;
  /** Current execution state */
  state: StepState;
  /** Timestamp when execution started */
  startTs?: number;
  /** Timestamp when execution ended */
  endTs?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error value if state is 'error' */
  error?: unknown;
  /** Input value that triggered this step (for decision understanding) */
  input?: unknown;
  /** Output value from this step (for decision understanding) */
  output?: unknown;
}

/**
 * A single step execution node.
 */
export interface StepNode extends BaseNode {
  type: "step";
}

/**
 * Sequential execution - steps run one after another.
 * This is the implicit structure when steps are awaited in sequence.
 */
export interface SequenceNode extends BaseNode {
  type: "sequence";
  children: FlowNode[];
}

/**
 * Parallel execution - all branches run simultaneously.
 * Created by allAsync() or allSettledAsync().
 */
export interface ParallelNode extends BaseNode {
  type: "parallel";
  children: FlowNode[];
  /**
   * Execution mode:
   * - 'all': Fails on first error (allAsync)
   * - 'allSettled': Collects all results (allSettledAsync)
   */
  mode: "all" | "allSettled";
}

/**
 * Race execution - first to complete wins.
 * Created by anyAsync().
 */
export interface RaceNode extends BaseNode {
  type: "race";
  children: FlowNode[];
  /** ID of the winning branch (first to succeed) */
  winnerId?: string;
}

/**
 * Decision point - conditional branch (if/switch).
 * Shows which branch was taken and why.
 */
export interface DecisionNode extends BaseNode {
  type: "decision";
  /** Condition that was evaluated (e.g., "user.role === 'admin'") */
  condition?: string;
  /** Value that was evaluated (the input to the decision) */
  decisionValue?: unknown;
  /** Which branch was taken (true/false, or the matched case) */
  branchTaken?: string | boolean;
  /** All possible branches (including skipped ones) */
  branches: DecisionBranch[];
}

/**
 * A branch in a decision node.
 */
export interface DecisionBranch {
  /** Label for this branch (e.g., "if", "else", "case 'admin'") */
  label: string;
  /** Condition that would trigger this branch */
  condition?: string;
  /** Whether this branch was taken */
  taken: boolean;
  /** Steps in this branch */
  children: FlowNode[];
}

/**
 * Union of all flow node types.
 */
export type FlowNode = StepNode | SequenceNode | ParallelNode | RaceNode | DecisionNode;

/**
 * Root node representing the entire workflow.
 */
export interface WorkflowNode extends BaseNode {
  type: "workflow";
  /** Correlation ID from the workflow execution */
  workflowId: string;
  /** Child nodes (steps, parallel blocks, etc.) */
  children: FlowNode[];
}

// =============================================================================
// Workflow IR
// =============================================================================

/**
 * Complete workflow intermediate representation.
 * This is the main data structure produced by the IR builder.
 */
export interface WorkflowIR {
  /** Root workflow node */
  root: WorkflowNode;
  /** Metadata about the IR */
  metadata: {
    /** When the IR was first created */
    createdAt: number;
    /** When the IR was last updated */
    lastUpdatedAt: number;
  };
}

// =============================================================================
// Scope Events (for parallel/race detection)
// =============================================================================

// Re-export ScopeType from core for consistency
export type { ScopeType } from "../core";
import type { ScopeType } from "../core";

/**
 * Event emitted when entering a parallel/race scope.
 * This matches the scope_start event in WorkflowEvent.
 */
export interface ScopeStartEvent {
  type: "scope_start";
  workflowId: string;
  scopeId: string;
  scopeType: ScopeType;
  name?: string;
  ts: number;
}

/**
 * Event emitted when exiting a parallel/race scope.
 */
export interface ScopeEndEvent {
  type: "scope_end";
  workflowId: string;
  scopeId: string;
  ts: number;
  durationMs: number;
  /** For race scopes, the ID of the winning branch */
  winnerId?: string;
}

/**
 * Event emitted when a decision point is encountered.
 * Use this to track conditional logic (if/switch).
 */
export interface DecisionStartEvent {
  type: "decision_start";
  workflowId: string;
  decisionId: string;
  /** Condition being evaluated (e.g., "user.role === 'admin'") */
  condition?: string;
  /** Value being evaluated */
  decisionValue?: unknown;
  /** Name/label for this decision point */
  name?: string;
  ts: number;
}

/**
 * Event emitted when a decision branch is taken.
 */
export interface DecisionBranchEvent {
  type: "decision_branch";
  workflowId: string;
  decisionId: string;
  /** Label for this branch (e.g., "if", "else", "case 'admin'") */
  branchLabel: string;
  /** Condition for this branch */
  condition?: string;
  /** Whether this branch was taken */
  taken: boolean;
  ts: number;
}

/**
 * Event emitted when a decision point completes.
 */
export interface DecisionEndEvent {
  type: "decision_end";
  workflowId: string;
  decisionId: string;
  /** Which branch was taken */
  branchTaken?: string | boolean;
  ts: number;
  durationMs: number;
}

/**
 * Event emitted when a step is skipped due to conditional logic.
 */
export interface StepSkippedEvent {
  type: "step_skipped";
  workflowId: string;
  stepKey?: string;
  name?: string;
  /** Reason why this step was skipped (e.g., "condition was false") */
  reason?: string;
  /** The decision that caused this skip */
  decisionId?: string;
  ts: number;
}

/**
 * Union of scope-related events.
 */
export type ScopeEvent = ScopeStartEvent | ScopeEndEvent;

/**
 * Union of decision-related events.
 */
export type DecisionEvent = DecisionStartEvent | DecisionBranchEvent | DecisionEndEvent;

// =============================================================================
// Renderer Types
// =============================================================================

/**
 * Color scheme for rendering step states.
 */
export interface ColorScheme {
  pending: string;
  running: string;
  success: string;
  error: string;
  aborted: string;
  cached: string;
  skipped: string;
}

/**
 * Options passed to renderers.
 */
export interface RenderOptions {
  /** Show timing information (duration) */
  showTimings: boolean;
  /** Show step cache keys */
  showKeys: boolean;
  /** Terminal width for ASCII renderer */
  terminalWidth?: number;
  /** Color scheme */
  colors: ColorScheme;
}

/**
 * Renderer interface - transforms IR to output format.
 */
export interface Renderer {
  /** Unique identifier for this renderer */
  readonly name: string;
  /** Render IR to string output */
  render(ir: WorkflowIR, options: RenderOptions): string;
  /** Whether this renderer supports live (incremental) updates */
  supportsLive?: boolean;
  /** Render incremental update (optional) */
  renderUpdate?(
    ir: WorkflowIR,
    changedNodes: FlowNode[],
    options: RenderOptions
  ): string;
}

// =============================================================================
// Visualizer Types
// =============================================================================

/**
 * Output format for rendering.
 */
export type OutputFormat = "ascii" | "mermaid" | "json";

/**
 * Options for creating a visualizer.
 */
export interface VisualizerOptions {
  /** Name for the workflow in visualizations */
  workflowName?: string;
  /** Enable parallel detection heuristics (default: true) */
  detectParallel?: boolean;
  /** Show timing information (default: true) */
  showTimings?: boolean;
  /** Show step keys (default: false) */
  showKeys?: boolean;
  /** Custom color scheme */
  colors?: Partial<ColorScheme>;
}

/**
 * Options for live visualization.
 */
export interface LiveVisualizerOptions extends VisualizerOptions {
  /** Output stream (default: process.stdout) */
  stream?: NodeJS.WriteStream;
  /** Update interval in ms (default: 100) */
  updateInterval?: number;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a node is a StepNode.
 */
export function isStepNode(node: FlowNode): node is StepNode {
  return node.type === "step";
}

/**
 * Check if a node is a SequenceNode.
 */
export function isSequenceNode(node: FlowNode): node is SequenceNode {
  return node.type === "sequence";
}

/**
 * Check if a node is a ParallelNode.
 */
export function isParallelNode(node: FlowNode): node is ParallelNode {
  return node.type === "parallel";
}

/**
 * Check if a node is a RaceNode.
 */
export function isRaceNode(node: FlowNode): node is RaceNode {
  return node.type === "race";
}

/**
 * Check if a node is a DecisionNode.
 */
export function isDecisionNode(node: FlowNode): node is DecisionNode {
  return node.type === "decision";
}

/**
 * Check if a node has children.
 */
export function hasChildren(
  node: FlowNode
): node is SequenceNode | ParallelNode | RaceNode | DecisionNode {
  return "children" in node || (node.type === "decision" && "branches" in node);
}
