# Synthetic example

`context.md` illustrates a reviewed project context for the fictional ParcelKit library. The commands and file layout describe that synthetic project, not AgentBridge.

`generated/AGENTS.md`, `generated/CLAUDE.md` and `generated/GEMINI.md` show the complete plain-Markdown output for that source, without handoff notes. They are review samples, not an initialized AgentBridge project. To use the example in a disposable project, run AgentBridge `init` there, copy `context.md` into its `.agentbridge/context.md`, then preview and sync.

The test suite constructs actual disposable Git and non-Git projects and exercises the full CLI. No real repository contents or conversations are used.

These original initial-MVP samples remain unchanged. [Observed workflow samples](workflow/README.md) show current managed sections, preserved user guidance, directed handoffs and reverse-direction output.
