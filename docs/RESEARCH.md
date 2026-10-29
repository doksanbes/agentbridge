# AgentBridge research and MVP decision

Official documentation and primary project READMEs reviewed October 28–29, 2026. Documentation changes over time; this records the observed behavior rather than assuming all installed agent versions match it. No competitor source code was incorporated.

## Supported context mechanisms

| Agent | Official behavior relevant to this MVP | Design implication |
| --- | --- | --- |
| Codex | Global guidance plus project-root-to-current-directory instruction discovery; `AGENTS.override.md` takes priority in its directory. Default combined project budget is 32 KiB. | Emit concise root `AGENTS.md`; warn that overrides and ancestors can affect loading. |
| Claude Code | `CLAUDE.md` supports imports and hierarchical project instructions. Recent versions can load `AGENTS.md` when project CLAUDE files are absent; settings/version affect this. | Emit self-contained `CLAUDE.md` for compatibility; do not require users to change settings or use symlinks. |
| Gemini CLI | Global/workspace/JIT `GEMINI.md` context, `@file` imports, configurable context filenames, and `/memory show` / `/memory reload`. | Emit self-contained root `GEMINI.md` with no imports or global settings edits. |

Sources: [official Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [official Claude Code memory](https://code.claude.com/docs/en/memory), [official Gemini CLI context files](https://geminicli.com/docs/cli/gemini-md/).

Agent configuration, skills, MCP servers, user memory, transcript persistence, and session resumption are different mechanisms with different trust and loading rules. AgentBridge transfers reviewed project text; it does not translate permissions, tools, model state, or private sessions. Ordinary inline Markdown avoids reliance on import syntax and Windows symlink configuration.

## Competitive landscape

| Primary source | Documented capability | Consequence for AgentBridge |
| --- | --- | --- |
| [Ruler](https://github.com/intellectronica/ruler) | Centralized rule files, distribution across many agents, nested rules, MCP propagation, backups and dry-run features. | Rule generation, backups and previews alone are not differentiation. Recommend Ruler for broad rule/config management. |
| [Rulesync by dyoshikawa](https://github.com/dyoshikawa/rulesync) | Unified generation, import/conversion, and broad rules/skills/commands/MCP support. | Avoid another broad configuration converter. Recommend Rulesync for that use case. Distinct from the similarly named hosted rulesync.dev product. |
| [ai-cli-handoff](https://github.com/omriariav/ai-cli-handoff) | Project handoffs with selected Claude conversations, privacy acknowledgments, local/global tooling carryover, managed instruction sections. | Existing handoff tools are substantive. Our scope intentionally requires no transcript or global tooling access. |
| [ContextLedger](https://github.com/manthan787/context-ledger) | Local session tracking, prompt capture/integrations, resume packs, handoffs and dashboard. | Session tracking already exists. Prefer a smaller manually curated artifact workflow with no capture hooks or database. |
| [context-absorb](https://github.com/ThatGuyAstro/context-absorb) | Local Claude/Codex session catalog, ranked transcript excerpts, structured handoffs, inbox/acknowledgment workflow. | Do not compete on session search or automatic transcript transfer. |

These are README-level capability comparisons, not audited claims that competitors lack safety or offline features. No performance, adoption, security superiority, or exhaustive market coverage is claimed. No stars/download counts were used as quality evidence.

## Actual problem and bounded advantage

A developer switching agents needs durable project rules, what was actually changed, and the next step. Repeating this manually is tedious; copying an entire conversation can expose private content and introduce irrelevant or stale context. Maintaining three files separately also creates silent drift.

The MVP provides one reviewable source, explicit notes, content-free Git facts, and per-invocation approval of every existing instruction-file replacement. It can operate without agent accounts or a model, and its compiled runtime has no third-party packages. This combination is the product hypothesis; it is not a claim that context synchronization itself is new. User demand has not yet been validated through interviews or field trials.

## Architecture chosen before implementation

TypeScript + Node.js with built-in filesystem, crypto, subprocess and argument APIs. No compelling reason to choose a different language was found. Git is used as the authoritative ignore engine and metadata source. A Markdown canonical context avoids a database or custom configuration language. Generated full files keep behavior transparent; existing files require review and explicit approval, with backups. Hash state distinguishes source updates from local output edits. Plain directories work with intentionally reduced discovery.

No API calls, subscriptions, hosted services, embeddings, semantic summaries, automatic history ingestion, agent hooks, dashboards, global setup, or two-way semantic merges are included. Those would expand trust requirements and duplicate mature tools before validating the core problem.

## Next milestone

Run opt-in field trials with developers switching among the three agents. Measure time to resume, missing facts, stale notes and overwrite friction. Validate actual instruction loading in installed agents without API-funded automated tests. Then prioritize a scoped three-way review/merge workflow or an export adapter for an established rule manager if the trials justify it. Keep transcript access outside the default trust boundary.
