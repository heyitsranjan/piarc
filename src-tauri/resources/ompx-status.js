const OSC = "\x1b]777;ompx://agent-status;";
const BEL = "\x07";

export default function ompxStatus(pi) {
  let agentActive = false;
  let generationState = "thinking";
  let retrying = false;
  let compacting = false;
  let lastPayload = "";
  const tools = new Map();
  const approvals = new Map();

  function currentActivity() {
    const approval = approvals.values().next().value;
    if (approval) return { state: "waiting_approval", detail: `Approve ${approval}` };
    if (compacting) return { state: "compacting" };
    if (retrying) return { state: "retrying" };

    const tool = tools.values().next().value;
    if (tool) return { state: "tool", detail: `Running ${tool}` };
    if (agentActive) return { state: generationState };
    return { state: "waiting_input" };
  }

  function emit(activity = currentActivity()) {
    const payload = JSON.stringify({ v: 1, ...activity });
    if (payload === lastPayload) return;
    lastPayload = payload;
    process.stdout.write(`${OSC}${payload}${BEL}`);
  }

  pi.on("session_start", () => emit());
  pi.on("agent_start", () => {
    agentActive = true;
    generationState = "thinking";
    emit();
  });
  pi.on("message_update", (event) => {
    const type = event.assistantMessageEvent?.type;
    if (type === "thinking_start" || type === "thinking_delta") {
      generationState = "thinking";
      emit();
    } else if (type === "text_start" || type === "text_delta") {
      generationState = "responding";
      emit();
    }
  });
  pi.on("tool_execution_start", (event) => {
    tools.set(event.toolCallId, event.toolName || "tool");
    emit();
  });
  pi.on("tool_execution_end", (event) => {
    tools.delete(event.toolCallId);
    emit();
  });
  pi.on("tool_approval_requested", (event) => {
    approvals.set(event.toolCallId, event.toolName || "tool");
    emit();
  });
  pi.on("tool_approval_resolved", (event) => {
    approvals.delete(event.toolCallId);
    emit();
  });
  pi.on("auto_retry_start", () => {
    retrying = true;
    emit();
  });
  pi.on("auto_retry_end", () => {
    retrying = false;
    emit();
  });
  pi.on("auto_compaction_start", () => {
    compacting = true;
    emit();
  });
  pi.on("auto_compaction_end", () => {
    compacting = false;
    emit();
  });
  pi.on("agent_end", () => {
    agentActive = false;
    retrying = false;
    compacting = false;
    tools.clear();
    approvals.clear();
    emit();
  });
  pi.on("session_shutdown", () => emit({ state: "done" }));
}
