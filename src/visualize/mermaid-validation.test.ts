/**
 * Test Mermaid validation - ensure all generated Mermaid code is valid
 * 
 * This test generates Mermaid diagrams with various edge cases and validates
 * they render correctly without parse errors.
 */

import { describe, it, expect } from "vitest";
import { ok, type AsyncResult } from "../core";
import { createWorkflow } from "../workflow";
import { createEventCollector } from "./index";

// Test functions with special characters in names/keys
const fetchUserWithSpecialChars = async (
  id: string
): AsyncResult<{ id: string; name: string }, "NOT_FOUND"> => {
  return ok({ id, name: `User (${id})` });
};

const processDataWithBrackets = async (
  data: { value: string }
): AsyncResult<string, "ERROR"> => {
  return ok(`Processed: [${data.value}]`);
};

describe("Mermaid Validation - Special Characters", () => {
  it("should handle step names with parentheses", async () => {
    const collector = createEventCollector({ workflowName: "test-workflow" });

    const workflow = createWorkflow({ fetchUserWithSpecialChars }, {
      onEvent: collector.handleEvent,
    });

    await workflow(async (step, deps) => {
      await step(() => deps.fetchUserWithSpecialChars("1"), {
        key: "user:1",
        name: "Fetch User (with parens)",
      });
    });

    const mermaid = collector.visualizeAs("mermaid");
    // Should not contain unescaped parentheses in node labels
    expect(mermaid).not.toMatch(/\[.*\(.*\).*\]/);
    expect(mermaid).toContain("flowchart TD");
  });

  it("should handle step names with brackets", async () => {
    const collector = createEventCollector({ workflowName: "test-workflow" });

    const workflow = createWorkflow({ processDataWithBrackets }, {
      onEvent: collector.handleEvent,
    });

    await workflow(async (step, deps) => {
      await step(() => deps.processDataWithBrackets({ value: "test" }), {
        key: "process:data",
        name: "Process [Data] with Brackets",
      });
    });

    const mermaid = collector.visualizeAs("mermaid");
    // Should not contain unescaped brackets in node labels
    expect(mermaid).not.toMatch(/\[.*\[.*\].*\]/);
    expect(mermaid).toContain("flowchart TD");
  });

  it("should handle step names with quotes", async () => {
    const collector = createEventCollector({ workflowName: "test-workflow" });

    const workflow = createWorkflow({ fetchUserWithSpecialChars }, {
      onEvent: collector.handleEvent,
    });

    await workflow(async (step, deps) => {
      await step(() => deps.fetchUserWithSpecialChars("1"), {
        key: "user:1",
        name: 'Step with "quotes"',
      });
    });

    const mermaid = collector.visualizeAs("mermaid");
    // Should not contain double quotes (should be replaced with single)
    expect(mermaid).not.toMatch(/\[.*".*".*\]/);
    expect(mermaid).toContain("flowchart TD");
  });

  it("should handle parallel subgraph names with special chars", async () => {
    const collector = createEventCollector({ workflowName: "test-workflow" });

    const workflow = createWorkflow({ fetchUserWithSpecialChars }, {
      onEvent: collector.handleEvent,
    });

    await workflow(async (step, deps) => {
      await step.parallel("Parallel (with parens)", async () => {
        const user = await deps.fetchUserWithSpecialChars("1");
        return ok([user]);
      });
    });

    const mermaid = collector.visualizeAs("mermaid");
    // Should not contain unescaped parentheses in subgraph names
    expect(mermaid).not.toMatch(/subgraph.*\[.*\(.*\).*\]/);
    expect(mermaid).toContain("flowchart TD");
  });

  it("should handle race subgraph names with special chars", async () => {
    const collector = createEventCollector({ workflowName: "test-workflow" });

    const fetch1 = async (): AsyncResult<string, "ERROR"> => ok("result1");
    const fetch2 = async (): AsyncResult<string, "ERROR"> => ok("result2");

    const workflow = createWorkflow({ fetch1, fetch2 }, {
      onEvent: collector.handleEvent,
    });

    await workflow(async (step) => {
      await step.race("Race [with brackets]", () =>
        Promise.resolve(ok("result1"))
      );
    });

    const mermaid = collector.visualizeAs("mermaid");
    // Should not contain unescaped brackets in subgraph names
    expect(mermaid).not.toMatch(/subgraph.*\[.*\[.*\].*\]/);
    expect(mermaid).toContain("flowchart TD");
  });

  it("should handle all edge cases together", async () => {
    const collector = createEventCollector({ workflowName: "edge-cases" });

    const workflow = createWorkflow(
      { fetchUserWithSpecialChars, processDataWithBrackets },
      {
        onEvent: collector.handleEvent,
      }
    );

    await workflow(async (step, deps) => {
      // Step with special chars in name
      const user = await step(() => deps.fetchUserWithSpecialChars("1"), {
        key: "user:1",
        name: 'Fetch "User" (with) [special] chars',
      });

      // Parallel with special chars
      await step.parallel('Parallel "test" [brackets]', async () => {
        return ok([user]);
      });

      // Process with brackets
      await step(() => deps.processDataWithBrackets(user), {
        key: "process",
        name: "Process {data}",
      });
    });

    const mermaid = collector.visualizeAs("mermaid");
    
    // Validate no invalid characters
    expect(mermaid).toContain("flowchart TD");
    // Should not have unescaped brackets/parens in labels
    expect(mermaid).not.toMatch(/\[.*\([^)]*\).*\]/); // No unescaped parens in brackets
    expect(mermaid).not.toMatch(/\[.*\[[^\]]*\].*\]/); // No nested brackets
    expect(mermaid).not.toMatch(/\[.*".*".*\]/); // No double quotes
  });
});
