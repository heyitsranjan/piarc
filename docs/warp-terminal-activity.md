# Warp terminal activity and OMP status detection

## Conclusion first

Warp has two different status layers, and neither makes a plain `omp` PTY semantically observable:

1. **Shell/command activity is hook-driven.** Warp's shell bootstrap emits private, structured lifecycle messages. `Preexec` marks execution; the next `precmd` captures `$?`, emits `CommandFinished`, and emits `Precmd` for the next prompt/block. Warp's own architecture explicitly says raw PTY bytes do not identify prompt, command, or output boundaries. There is no evidence that normal command completion is inferred from process ancestry or output cadence. [Warp block-model engineering post](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment), [zsh bootstrap](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/assets/bundled/bootstrap/zsh_body.sh#L254-L480)
2. **AI status is richer only when Warp owns the agent state or receives structured CLI-agent plugin events.** Current Warp source distinguishes `InProgress`, `Success`, `Error`, `TransientError`, `Cancelled`, `Blocked`, and native-agent `WaitingForEvents`; plugin-backed CLI sessions expose only in-progress/success/failure/blocked. A command-detected CLI session has no trustworthy rich status overlay. [conversation status](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/ai/agent/conversation.rs#L4665-L4769), [CLI-session status](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent_sessions/mod.rs#L15-L40), [rich-status gate](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent_sessions/mod.rs#L122-L169)
3. **Warp recognizes `omp` as Oh My Pi by command name, but command recognition is not semantic instrumentation.** The public agent table maps `OhMyPi` to the `omp` prefix, while Warp's icon resolver states that command-detected sessions do not have rich status and renders status only for a plugin listener that has actually received a rich notification. [CLI-agent table](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent.rs#L138-L175), [status-overlay resolver](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/ui_components/agent_icon.rs#L23-L35), [resolver gate](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/ui_components/agent_icon.rs#L125-L155)
4. **Therefore an OMP spinner cannot, by itself, mean “thinking,” “continuing,” “executing a tool,” or “waiting for input.”** Without an OMP-specific event integration, Warp can at most know that the foreground `omp` command/block has not returned to the shell, plus that the executable looks like a known CLI agent. An interactive OMP process remains the foreground command during all of its internal phases. This last sentence is an **inference** from the confirmed hook state machine and command-only OMP recognition.

For PiArc, keep PTY/process state as the coarse liveness signal and add a small OMP extension that sends typed lifecycle events over a dedicated side channel. OMP already exposes agent, turn, streaming-message, tool-execution, approval, retry, and compaction events, so no terminal-output scraping is needed. [OMP extension event surface](https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md#event-surface-current-names-and-behavior)

## Confirmed Warp signal flow

```text
Warp launches a supported shell on a PTY
    ↓
Warp bootstrap installs shell lifecycle hooks
    ↓
precmd
    captures prior $?
    emits CommandFinished(exit_code, next_block_id)
    emits Precmd(prompt metadata such as cwd/git/session)
    → next block is prompt/command-ready
    ↓
Warp input editor writes the submitted command to the PTY
    → block is BeforeExecution
    ↓
shell preexec
    emits Preexec(command)
    → block becomes Executing; following bytes belong to output
    ↓
foreground command runs; children may come and go
    ↓
shell regains control and invokes precmd
    emits CommandFinished, then Precmd
    → completed block stores exit status/time; next prompt block starts
```

The source defines `BeforeExecution` as the period after a command is sent to the PTY but before `preexec`; `Executing` is specifically “between preexec and precmd.” `apply_preexec` starts the output grid and changes the state to `Executing`; block completion stores the exit code and completion timestamp. [block state](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L636-L653), [preexec transition](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L2960-L2992), [finish transition](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L1574-L1605)

### Native Warp envelope

On normal Unix PTYs, lifecycle JSON is hex-encoded and emitted as:

```text
ESC P $ d <ASCII hex of JSON> 0x9c
```

In bytes: `1b 50 24 64 ... 9c`. `d` means hex-encoded JSON. On Windows ConPTY the same payload uses private OSC 9278:

```text
ESC ] 9278 ; d ; <ASCII hex of JSON> BEL
```

These forms are defined by `DCS_START`, `DCS_JSON_MARKER`, `DCS_END`, `OSC_START`, and `warp_send_json_message`. [Warp zsh bootstrap lines 22–99](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/assets/bundled/bootstrap/zsh_body.sh#L22-L99), [typed DCS hook schema](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/src/terminal/model/ansi/dcs_hooks.rs#L1-L83)

The installed application inspected for this report identifies itself as `v0.2026.08.05.09.03.stable_01` at local path `/Applications/Warp.app/Contents/Info.plist` (`WarpVersion`; `CFBundleShortVersionString` is `0.2026.08.05.09.03.01`). The installed `Resources` directory does not contain plaintext shell bootstrap scripts; the exact protocol details above come from Warp's public, source-owned repository rather than private user data.

## Hook and escape-sequence table

`ST` below means String Terminator; Warp's private Unix DCS currently uses the single byte `0x9c`. `BEL` is `0x07`.

| Phase | Warp-native mechanism | Payload / state effect | Evidence |
|---|---|---|---|
| Shell/subshell ready for integration | `ESC P $ f {JSON} 0x9c` | Unencoded readiness JSON such as `{"hook":"SourcedRcFileForWarp","value":{"shell":"zsh"}}`; Warp then sends the setup script. This `$f` readiness envelope is different from normal `$d` hex lifecycle traffic. | [Warpify subshells](https://docs.warp.dev/terminal/warpify/subshells) |
| Previous command complete | Shell `precmd` emits private DCS/OSC JSON | `{"hook":"CommandFinished","value":{"exit_code":N,"next_block_id":"precmd-…"}}`; `$?` is captured before any other command in the hook. | [zsh `warp_precmd`](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/assets/bundled/bootstrap/zsh_body.sh#L301-L323) |
| Prompt/new block ready | Same `precmd`, after `CommandFinished` | `{"hook":"Precmd","value":{…}}`, carrying `pwd`, prompt mode, git/environment metadata, and `session_id`. This is Warp's native prompt-ready/new-block signal; there is no separate private “prompt ended” hook in the typed lifecycle enum. | [zsh `Precmd` payload](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/assets/bundled/bootstrap/zsh_body.sh#L448-L480), [hook enum](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/src/terminal/model/ansi/dcs_hooks.rs#L30-L82) |
| Command submitted / echoed | PTY input plus block state, not a standalone lifecycle hook | The block is `BeforeExecution` after Warp sends the command but before the shell calls `preexec`. | [block state](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L636-L653) |
| Command execution starts | Shell `preexec` emits private DCS/OSC JSON | `{"hook":"Preexec","value":{"command":"…"}}`; block becomes `Executing`. Zsh registers `warp_preexec` in `preexec_functions`; bash uses `bash-preexec` equivalents. | [zsh `warp_preexec`](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/assets/bundled/bootstrap/zsh_body.sh#L254-L258), [hook registration](https://github.com/warpdotdev/warp/blob/8c055374680788cb0920f18082527a2d6c6842b5/app/assets/bundled/bootstrap/zsh_body.sh#L1168-L1170), [Warp engineering explanation](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment) |
| Command output | Ordinary PTY bytes after `Preexec` | Routed to the executing block's output grid until completion. | [Warp block-model engineering post](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment) |
| Command exit and exit status | Next `precmd` → `CommandFinished` | Block is finalized with `exit_code` and completion time; non-zero status can affect block UI. | [finish transition](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L1574-L1605), [block UI docs](https://docs.warp.dev/terminal/blocks/block-basics) |

### OSC 133 and OSC 633 are related conventions, not Warp's native lifecycle transport

The semantic-prompts proposal defines OSC 133 as follows. Warp maintainers have referenced its `A`, `P`, and `B` markers for custom Powerlevel10k prompt compatibility, but Warp's current bootstrap source uses the private DCS/JSON protocol above. [semantic-prompts proposal](https://gitlab.freedesktop.org/Per_Bothner/specifications/-/raw/master/proposals/semantic-prompts.md), [Warp Powerlevel10k discussion](https://github.com/warpdotdev/Warp/issues/2851#issuecomment-1544182781)

| Convention | Meaning |
|---|---|
| `OSC 133 ; A [options] BEL` | Start a new command / enter prompt mode. |
| `OSC 133 ; P [options] BEL` | Start a prompt segment; `k=i` primary, `k=r` right prompt, `k=c`/`k=s` continuation. |
| `OSC 133 ; B [options] BEL` | End prompt; start user input. |
| `OSC 133 ; C [options] BEL` | End input; start command output/execution. |
| `OSC 133 ; D [; exit-code [; options]] BEL` | End current command; optional exit/error status. |

VS Code's OSC 633 protocol uses the analogous ordered markers `A` (prompt start), `B` (prompt end), `C` (pre-execution), `D[;exitcode]` (finished), plus `E;<commandline>[;<nonce>]` for an explicit command line. VS Code calls detection rich when the order is `A, B, E, C, D`; without `E`, it may reconstruct the command from the other markers or disable unreliable detection. No Warp-owned source inspected here claims native OSC 633 support. [VS Code shell-integration protocol](https://code.visualstudio.com/docs/terminal/shell-integration#_supported-escape-sequences)

## What the sidebar/session spinner represents

### Generic terminal status

Warp documents session search/status as the currently running command versus the last completed command or an empty session: `Running…`, `Completed …`, and `Empty Session`. [Session Navigation](https://docs.warp.dev/terminal/sessions/session-navigation)

The current implementation derives `RunningCommand` from an active block that is still long-running; otherwise it returns the last completed command. A block becomes “long-running” after 50 ms and only while it is `BeforeExecution`, `Executing`, or unfinished `Background`; completed states return false. [session context derivation](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/view.rs#L19211-L19274), [50 ms predicate](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L1712-L1747), [constant](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/model/block.rs#L67-L70)

**Limitation:** this proves the model behind `Running…`; it does not prove that every Warp UI glyph called a “spinner” is bound directly to the 50 ms predicate. The generic terminal state and agent status badge are separate code paths.

### Agent status badge/spinner

For an agent status overlay, `InProgress` renders a `ClockLoader`; success renders a check, error a triangle, blocked a stop, and transient recovery also uses a loader. Native Warp agents additionally have `WaitingForEvents`, currently rendered with the in-progress icon even though the enum describes it as quiescent and listening. [status-to-icon mapping](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/ai/agent/conversation.rs#L4665-L4769)

CLI-agent status is deliberately gated:

- command detection recognizes `omp` as Oh My Pi; [CLI-agent table](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent.rs#L138-L175)
- a command-detected non-Codex session has no listener; [CLI session fields](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent_sessions/mod.rs#L122-L153)
- `supports_rich_status()` becomes true only after a structured OSC 777 notification is received; [rich-status gate](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent_sessions/mod.rs#L156-L169)
- the sidebar/agent icon attaches status only when a listener exists and rich status is supported; otherwise the known agent can be branded but gets `status: None`. [agent-icon resolver](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/ui_components/agent_icon.rs#L125-L155)

Warp's official Claude Code plugin demonstrates the rich path. Hook scripts send:

```text
ESC ] 777 ; notify ; warp://cli-agent ; <JSON payload> BEL
```

The JSON includes protocol version, `agent`, `event`, session ID, cwd, project, and event-specific fields. [plugin README](https://github.com/warpdotdev/claude-code-warp#how-it-works), [`build-payload.sh`](https://github.com/warpdotdev/claude-code-warp/blob/main/plugins/warp/scripts/build-payload.sh), [`warp-notify.sh`](https://github.com/warpdotdev/claude-code-warp/blob/main/plugins/warp/scripts/warp-notify.sh)

The Claude plugin registers `UserPromptSubmit`, `PostToolUse`, `PermissionRequest`, idle `Notification`, `Stop`, and `StopFailure`. Prompt submission and a completed blocking tool transition Warp to `InProgress`; permission/question events transition it to `Blocked`; stop transitions to success or failure. The idle-prompt event is a notification and explicitly does **not** change the stored status. [hook registration](https://github.com/warpdotdev/claude-code-warp/blob/main/plugins/warp/hooks/hooks.json), [event-to-status state machine](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/terminal/cli_agent_sessions/mod.rs#L183-L258)

Consequently, even the documented CLI plugin protocol does **not** distinguish “model thinking” from “tool executing”: both are encompassed by `InProgress`, and the Claude plugin emits `PostToolUse` but no general tool-start status event. This is a confirmed limitation of the cited event registration/state machine, not a claim about what Warp's native Oz agent can internally observe.

## PTY, process ancestry, shell hooks, and fallback behavior

A PTY is a bidirectional byte stream. The terminal receives bytes but cannot inherently tell whether the shell produced them as a prompt or a descendant process produced them as command output. Warp's stated solution is shell instrumentation, not byte-pattern or process-tree inference. [Warp block-model engineering post](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)

Process relationships remain useful only for coarse liveness: the terminal owns the shell PTY; the shell starts foreground commands; those commands may start descendants. **Inference:** process ancestry or the PTY foreground process group can say that some process is still attached/running, but cannot identify an application's internal thinking, tool, continuation, or input-wait state, and does not by itself reproduce the shell's exact command boundary and `$?` payload.

Warp supports and bootstraps bash, zsh, fish, and PowerShell. If the configured login shell is unsupported, Warp shows a banner and loads a supported platform default rather than promising rich integration for the unsupported shell. [Supported Shells](https://docs.warp.dev/getting-started/supported-shells)

For nested/remote sessions, Warpification begins only after the explicit `SourcedRcFileForWarp` DCS readiness marker; Warp then injects a setup script enabling blocks, completions, and the input editor. Warp's SSH detector watches recognizable `ssh` command arguments and authentication/prompt output; aliases or script-wrapped SSH may not be detected, and unsupported remote extension environments fall back to a regular SSH session. These SSH heuristics select an integration path; they are not the normal local command-completion detector. [Warpify subshells](https://docs.warp.dev/terminal/warpify/subshells), [Warpify SSH](https://docs.warp.dev/terminal/warpify/ssh)

Without lifecycle integration, the architecture post's ambiguity remains. For a known CLI command, Warp may still show the agent's brand through command recognition, but its own source withholds the semantic status overlay until a rich plugin event is actually received. [agent icon resolver](https://github.com/warpdotdev/warp/blob/e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc/app/src/ui_components/agent_icon.rs#L23-L35)

## Mapping to PiArc's embedded PTY

Given the stated PiArc architecture—OMP is a child application running inside a PiArc-owned embedded PTY—the host can directly observe child spawn/exit and PTY bytes. Only child spawn/exit is a reliable semantic fact. PTY content, cursor changes, and process presence are presentation or liveness observations. **Inference:** an interactive `omp` child can remain alive and foreground-attached while it is streaming model output, running a tool, asking for approval, accepting another prompt, retrying, or compacting. Treat its exit as a process-lifecycle fact, not proof that a turn completed.

OMP exposes the required internal boundaries to extensions:

- `agent_start` / `agent_end`, `turn_start` / `turn_end`;
- `message_start` / `message_update` / `message_end`;
- `tool_execution_start` / `tool_execution_update` / `tool_execution_end`;
- `tool_approval_requested` / `tool_approval_resolved`;
- `auto_retry_start` / `auto_retry_end`; and
- `auto_compaction_start` / `auto_compaction_end`.

These are the canonical names in OMP's first-party extension documentation. [OMP extension event surface](https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md#event-surface-current-names-and-behavior)

## Minimal PiArc recommendation

Implement one small OMP extension and one dedicated host-side status channel. Do not parse rendered output, sample descendant processes, or depend on Warp escape sequences.

Prefer a dedicated inherited file descriptor, local socket, or equivalent IPC channel created by PiArc when it spawns OMP. Send newline-delimited, versioned JSON such as:

```json
{"v":1,"state":"tool","tool":"bash","turnId":"…","seq":42}
```

Keep this channel separate from PTY stdout so status frames cannot be rendered, copied, reordered with terminal output, or confused with an application's own OSC/DCS sequences. This is a recommendation, not a description of existing PiArc implementation.

| OMP event | Proposed PiArc state |
|---|---|
| child spawned, before OMP session ready | `starting` |
| `agent_start`, `turn_start`, or thinking/text `message_update` while no tool is active | `thinking` (or one simpler `working` state) |
| `tool_execution_start` | `tool` with tool name/id |
| `tool_execution_end` | return to `thinking` while the turn remains active |
| `tool_approval_requested` | `waiting_approval` |
| `tool_approval_resolved` | return to `tool` or `thinking` according to active state |
| `auto_retry_start` / `_end` | `retrying` / prior active state |
| `auto_compaction_start` / `_end` | `compacting` / prior active state |
| `agent_end` or `turn_end`, child still alive, no active tool/approval | `waiting_input` |
| child exit | `done` or `error` from exit code |

This mapping from documented OMP events to PiArc labels is **design inference**. Include a monotonic sequence number and reduce events on the host so late/out-of-order updates cannot regress the UI. Treat child exit as authoritative over stale “working” state.

If direct integration with Warp is later desired, OMP could adopt Warp's structured CLI-agent notification transport, but that is a separate adapter. PiArc itself should consume OMP-native events through IPC; Warp's current CLI status schema collapses thinking and tool work into `InProgress`, so imitating its spinner would lose the distinctions PiArc wants. [Warp Claude plugin transport](https://github.com/warpdotdev/claude-code-warp#how-it-works), [Warp CLI status state machine](https://github.com/warpdotdev/claude-code-warp)

## Limitations and confidence boundaries

- Public Warp source was inspected at `e72fd7aacbbb2236d9b3be2aad7e7178fe94b4bc` (2026-08-15); protocol examples are additionally pinned to Warp's blog-linked commit `8c055374680788cb0920f18082527a2d6c6842b5`. The installed build version is recorded above, but no source-to-binary hash equivalence is claimed.
- Warp's docs confirm the `Running…` session model, and source confirms the active/long-running predicate. No first-party text was found saying every visible glyph informally called a “sidebar spinner” is exactly that predicate; agent status badges are a separate path.
- Warp's own native agent can represent more states than a plugin-backed CLI session. Conclusions about OMP apply to command-detected `omp` without an OMP-specific rich listener/plugin.
- OSC 133 is a semantic-prompts proposal used by several terminal integrations and referenced by Warp for custom prompts. OSC 633 is VS Code's protocol. Neither should be presented as Warp's current native DCS lifecycle protocol.
- No application code was changed. No project build, tests, formatter, linter, or validation suite was run. The only repository change is this report.
