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
  it("rejects questions that the bounded answer workflow cannot accept", async () => {
    const offline = await runAgent({
      records: sampleRecords,
      answers: {},
      onCall: async () => {},
    });
    const { measured: _measured, ...proposal } = offline;
    const tools = createTools(sampleRecords, async () => {});
    const result = await tools.call("submit_proposal", {
      ...proposal,
      questions: [
        {
          id: "unsupported_choice",
          question: "Choose?",
          why: "Unknown policy",
          blocking: true,
          options: ["yes"],
        },
      ],
    });
    expect(result).toHaveProperty("error");
    expect(tools.proposal).toBeUndefined();
    await tools.call("submit_proposal", proposal);
    expect(tools.proposal!.questions).toHaveLength(7);
  });
});

describe("model tool loop", () => {
  it("retries a transient token limit and still validates the proposal", async () => {
    const offline = await runAgent({
      records: sampleRecords,
      answers: {},
      onCall: async () => {},
    });
    const { measured: _measured, ...proposal } = offline;
    let requests = 0;
    const result = await runAgent({
      records: sampleRecords,
      answers: {},
      apiKey: "test",
      onCall: async () => {},
      fetcher: async () => {
        if (++requests === 1)
          return new Response("", {
            status: 429,
            headers: { "retry-after": "0" },
          });
        return Response.json({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "proposal",
                    type: "function",
                    function: {
                      name: "submit_proposal",
                      arguments: JSON.stringify(proposal),
                    },
                  },
                ],
              },
            },
          ],
        });
      },
    });
    expect(requests).toBe(2);
    expect(result.spec).toEqual(proposal.spec);
    expect(result.measured.email!.total).toBe(250);
  });
  it.each([
    { retryAfter: "0", requests: 3 },
    { retryAfter: "60", requests: 1 },
  ])(
    "bounds retry count and the deadline ($retryAfter seconds)",
    async ({ retryAfter, requests }) => {
      let attempts = 0;
      await expect(
        runAgent({
          records: [],
          answers: {},
          apiKey: "test",
          onCall: async () => {},
          fetcher: async () => {
            attempts++;
            return new Response("", {
              status: 429,
              headers: { "retry-after": retryAfter },
            });
          },
        }),
      ).rejects.toThrow("rate limit reached");
      expect(attempts).toBe(requests);
    },
  );
  it("hands a rate-limited key over to the next key without waiting", async () => {
    const offline = await runAgent({
      records: sampleRecords,
      answers: {},
      onCall: async () => {},
    });
    const { measured: _measured, ...proposal } = offline;
    const used: string[] = [];
    const result = await runAgent({
      records: sampleRecords,
      answers: {},
      apiKeys: ["key-a", "key-b"],
      onCall: async () => {},
      fetcher: async (_url, init) => {
        const key = new Headers(init?.headers).get("authorization")!;
        used.push(key);
        // The first key tried is exhausted for a minute; only rotation finishes in time.
        if (used.length === 1)
          return new Response("", {
            status: 429,
            headers: { "retry-after": "60" },
          });
        return Response.json({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "proposal",
                    type: "function",
                    function: {
                      name: "submit_proposal",
                      arguments: JSON.stringify(proposal),
                    },
                  },
                ],
              },
            },
          ],
        });
      },
    });
    expect(used).toHaveLength(2);
    expect(new Set(used)).toEqual(new Set(["Bearer key-a", "Bearer key-b"]));
    expect(result.spec).toEqual(proposal.spec);
  });
  it("waits only after every key is limited, then reports all keys", async () => {
    const used: string[] = [];
    await expect(
      runAgent({
        records: [],
        answers: {},
        apiKeys: ["key-a", "key-b"],
        onCall: async () => {},
        fetcher: async (_url, init) => {
          used.push(new Headers(init?.headers).get("authorization")!);
          return new Response("", {
            status: 429,
            headers: { "retry-after": "0" },
          });
        },
      }),
    ).rejects.toThrow("rate limit reached on all 2 keys");
    // Two keys per round, one first round plus two bounded waits.
    expect(used).toHaveLength(6);
  });
  it("skips a rejected key and spreads sessions across keys", async () => {
    const firsts: string[] = [];
    for (let session = 0; session < 2; session++) {
      const used: string[] = [];
      await expect(
        runAgent({
          records: [],
          answers: {},
          apiKeys: ["key-a", "key-b", "key-a"],
          onCall: async () => {},
          fetcher: async (_url, init) => {
            used.push(new Headers(init?.headers).get("authorization")!);
            return new Response("", { status: 401 });
          },
        }),
      ).rejects.toThrow("HTTP 401");
      expect(used).toHaveLength(2);
      firsts.push(used[0]!);
    }
    expect(new Set(firsts).size).toBe(2);
  });
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
        expect(
          sent.tools.map(
            (tool: { function: { name: string } }) => tool.function.name,
          ),
        ).toEqual(["submit_proposal"]);
        expect(
          JSON.parse(sent.messages[1].content).inspection.profiles.signup_dt
            .total,
        ).toBe(250);
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
    expect(calls.slice(-3).map((c) => c.rejected)).toEqual([true, true, false]);
    expect(calls.slice(0, -3).every((c) => !c.rejected)).toBe(true);
    expect(result.spec).toEqual(valid.spec);
    expect(result.measured.email!.total).toBe(250);
  });
});
