export const AGENT_ACTIVITY_OSC = 777;

const PREFIX = "piarc://agent-status;";

const STATES = [
  "starting",
  "thinking",
  "responding",
  "tool",
  "waiting_approval",
  "retrying",
  "compacting",
  "waiting_input",
  "done",
  "error",
  "disconnected",
] as const;

export type AgentActivityState = (typeof STATES)[number];

export interface AgentActivity {
  state: AgentActivityState;
  detail?: string;
}

export interface AgentActivityFrame extends AgentActivity {
  sessionId?: string;
}

export function parseAgentActivity(data: string): AgentActivityFrame | null {
  if (!data.startsWith(PREFIX)) return null;

  try {
    const message = JSON.parse(data.slice(PREFIX.length)) as Record<string, unknown>;
    if (message.v !== 1 || !STATES.includes(message.state as AgentActivityState))
      return null;
    if (message.detail !== undefined && typeof message.detail !== "string") return null;
    if (message.sessionId !== undefined && typeof message.sessionId !== "string")
      return null;
    return {
      state: message.state as AgentActivityState,
      detail: message.detail as string,
      sessionId: message.sessionId as string,
    };
  } catch {
    return null;
  }
}

export function isAgentWorking(activity: AgentActivity): boolean {
  switch (activity.state) {
    case "starting":
    case "thinking":
    case "responding":
    case "tool":
    case "retrying":
    case "compacting":
      return true;
    default:
      return false;
  }
}

/** True once when an active agent returns to its normal prompt. */
export function isAgentCompletion(previous: AgentActivity, next: AgentActivity): boolean {
  return isAgentWorking(previous) && next.state === "waiting_input";
}

export function agentActivityLabel(activity: AgentActivity): string {
  if (activity.detail) return activity.detail;
  switch (activity.state) {
    case "starting":
      return "Starting agent";
    case "thinking":
      return "Agent thinking";
    case "responding":
      return "Agent responding";
    case "tool":
      return "Running tool";
    case "waiting_approval":
      return "Waiting for approval";
    case "retrying":
      return "Agent retrying";
    case "compacting":
      return "Compacting context";
    case "waiting_input":
      return "Waiting for input";
    case "done":
      return "Agent finished";
    case "error":
      return "Agent error";
    case "disconnected":
      return "Disconnected";
  }
}
