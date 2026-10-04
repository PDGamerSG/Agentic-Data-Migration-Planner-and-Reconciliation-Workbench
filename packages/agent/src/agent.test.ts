import { describe, expect, it } from "vitest";
import {
  createTools,
  runAgent,
  questionDefinitions,
  riskDefinitions,
  answersSchema,
} from "./index";
import { sampleRecords } from "@manifest/fixtures";
import { checkPlan } from "@manifest/core";
import { sourceSchema, targetSchema } from "@manifest/fixtures";
describe("restricted planner", () => {
  it("proposes tested mappings using only the registry", async () => {
    const calls: string[] = [];
    const p = await runAgent({
      records: sampleRecords,
      answers: {},
      onCall: async (c) => {
        calls.push(c.tool);
      },
    });
    expect(calls).toContain("test_mapping");
    expect(calls.at(-1)).toBe("submit_proposal");
    expect(checkPlan(p.spec, sourceSchema, targetSchema)).toEqual([]);
    expect(p.measured.email!.total).toBe(250);
    expect(p.risks.filter((r) => r.severity === "high")).toHaveLength(3);
    expect(p.questions).toHaveLength(7);
  });
  it("validates clarification decisions and applies them", async () => {
    expect(answersSchema.safeParse({ unknown_status: "active" }).success).toBe(
      false,
    );
    const p = await runAgent({
      records: sampleRecords,
      answers: {
        date_order: "DD/MM/YYYY",
        unknown_status: "inactive",
        missing_credit: "zero",
        duplicates: "none",
      },
      onCall: async () => {},
    });
    expect(p.spec.dedupe?.keep).toBe("none");
    expect(
      p.spec.mappings.find((m) => m.targetField === "status")!.steps,
    ).toContainEqual(
      expect.objectContaining({
        mapping: expect.objectContaining({ X: "inactive" }),
      }),
    );
  });
  it("rejects writes, unknown tools, oversized reads and invalid fields", async () => {
    const calls: { rejected: boolean }[] = [];
    const tools = createTools(sampleRecords, async (c) => {
      calls.push(c);
    });
    await tools.call("execute_migration", {});
    await tools.call("sample_source_records", { offset: 0, limit: 21 });
    await tools.call("profile_source_field", { field: "secret" });
    expect(calls.every((c) => c.rejected)).toBe(true);
    expect(tools.proposal).toBeUndefined();
  });
  it("retains mandatory policy findings even when model omits them", async () => {
    const offline = await runAgent({
      records: sampleRecords,
      answers: {},
      onCall: async () => {},
    });
    const tools = createTools(sampleRecords, async () => {});
    const { measured: _measured, ...proposal } = offline;
    await tools.call("submit_proposal", {
      ...proposal,
      risks: [],
      questions: [],
    });
    expect(tools.proposal!.risks.map((r) => r.id)).toEqual(
      riskDefinitions.map((r) => r.id),
    );
    expect(tools.proposal!.questions.map((q) => q.id)).toEqual(
      questionDefinitions.map((q) => q.id),
    );
  });
  it("bounds calls and validates provider responses", async () => {
    await expect(
      runAgent({
        records: [],
        answers: {},
        onCall: async () => {},
        apiKey: "test",
        fetcher: async () => new Response("{}", { status: 429 }),
      }),
    ).rejects.toThrow("429");
  });
});

describe("model tool loop", () => {
  it("repairs invalid proposals and rejects unauthorized model calls", async () => {
    const offline = await runAgent({
      records: sampleRecords,
      answers: {},
      onCall: async () => {},
    });
    const { measured: _measured, ...valid } = offline;
    const attempts = [
      { name: "execute_migration", arguments: {} },
      {
        name: "submit_proposal",
        arguments: { ...valid, spec: { ...valid.spec, mappings: [] } },
      },
      { name: "submit_proposal", arguments: valid },
    ];
    let index = 0;
    const calls: { rejected: boolean; tool: string }[] = [];
    const result = await runAgent({
      records: sampleRecords,
      answers: {},
      apiKey: "injected-test-key",
      onCall: async (c) => {
        calls.push(c);
      },
      fetcher: async (_url, init) => {
        const sent = JSON.parse(String(init?.body));
        expect(sent.tools).toHaveLength(8);
        const attempt = attempts[index++]!;
        return Response.json({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: `call-${index}`,
                    type: "function",
                    function: {
                      name: attempt.name,
                      arguments: JSON.stringify(attempt.arguments),
                    },
                  },
                ],
              },
            },
          ],
        });
      },
    });
    expect(calls.map((c) => c.rejected)).toEqual([true, true, false]);
    expect(result.spec).toEqual(valid.spec);
    expect(result.measured.email!.total).toBe(250);
  });
});
