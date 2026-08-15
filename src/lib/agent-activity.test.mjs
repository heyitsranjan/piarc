import { describe, expect, test } from "bun:test";

import { isAgentWorking, parseAgentActivity } from "./agent-activity";

describe("agent activity protocol", () => {
  test("parses a versioned OMPX status frame", () => {
    expect(
      parseAgentActivity(
        'ompx://agent-status;{"v":1,"state":"tool","detail":"Running bash"}'
      )
    ).toEqual({ state: "tool", detail: "Running bash" });
  });

  test("rejects unrelated and malformed frames", () => {
    expect(parseAgentActivity("notify;other-app;{}")).toBeNull();
    expect(
      parseAgentActivity('ompx://agent-status;{"v":2,"state":"thinking"}')
    ).toBeNull();
    expect(
      parseAgentActivity('ompx://agent-status;{"v":1,"state":"unknown"}')
    ).toBeNull();
  });

  test("distinguishes working from attention and idle states", () => {
    expect(isAgentWorking({ state: "thinking" })).toBe(true);
    expect(isAgentWorking({ state: "waiting_approval" })).toBe(false);
    expect(isAgentWorking({ state: "waiting_input" })).toBe(false);
  });
});
