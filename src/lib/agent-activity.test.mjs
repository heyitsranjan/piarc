import { describe, expect, test } from "bun:test";
import process from "node:process";

import ompxStatus from "../../src-tauri/resources/ompx-status";
import { isAgentWorking, parseAgentActivity } from "./agent-activity";

describe("agent activity protocol", () => {
  test("parses a versioned OMPX status frame", () => {
    expect(
      parseAgentActivity(
        'ompx://agent-status;{"v":1,"state":"tool","detail":"Running bash","sessionId":"session-123"}'
      )
    ).toEqual({
      state: "tool",
      detail: "Running bash",
      sessionId: "session-123",
    });
  });

  test("rejects unrelated and malformed frames", () => {
    expect(parseAgentActivity("notify;other-app;{}")).toBeNull();
    expect(
      parseAgentActivity('ompx://agent-status;{"v":2,"state":"thinking"}')
    ).toBeNull();
    expect(
      parseAgentActivity('ompx://agent-status;{"v":1,"state":"unknown"}')
    ).toBeNull();
    expect(
      parseAgentActivity('ompx://agent-status;{"v":1,"state":"thinking","sessionId":42}')
    ).toBeNull();
  });

  test("extension reports the session currently open in its terminal", () => {
    const handlers = new Map();
    const writes = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      writes.push(String(chunk));
      return true;
    };

    try {
      ompxStatus({ on: (event, handler) => handlers.set(event, handler) });
      handlers.get("session_start")(
        {},
        {
          sessionManager: { getSessionId: () => "created-session" },
        }
      );
      handlers.get("session_switch")(
        {},
        {
          sessionManager: { getSessionId: () => "switched-session" },
        }
      );
    } finally {
      process.stdout.write = originalWrite;
    }

    const frames = writes.map((frame) =>
      parseAgentActivity(frame.slice("\x1b]777;".length, -1))
    );
    expect(frames.map((frame) => frame?.sessionId)).toEqual([
      "created-session",
      "switched-session",
    ]);
  });

  test("distinguishes working from attention and idle states", () => {
    expect(isAgentWorking({ state: "thinking" })).toBe(true);
    expect(isAgentWorking({ state: "waiting_approval" })).toBe(false);
    expect(isAgentWorking({ state: "waiting_input" })).toBe(false);
  });
});
