# AgentBridge — experimental

Carry reviewed project context between Codex, Claude Code and Gemini CLI, offline. One editable context file and explicit handoff notes generate `AGENTS.md`, `CLAUDE.md` and `GEMINI.md`. AgentBridge never calls a model or reads chat histories.

This archive is distribution preparation, **not a published release or npm package**. Use only an archive supplied through a maintainer-approved channel. No public download or registry installation is available yet. The package name is local metadata, not proof of npm namespace ownership.

## Install a reviewed archive

Requires Node.js 22.18+ or 24 with npm. Git is needed for discovery/progress; a plain directory supports basic context with reduced functionality. No pnpm, TypeScript, clone, agent account or API key is needed.

Compare the archive's SHA-256 with the value obtained through your trusted distribution channel. A checksum from the same untrusted download is not an authenticity guarantee. Then, from the directory containing the archive:

```sh
npm install --global --offline --ignore-scripts --no-audit --no-fund ./agentbridge-0.1.0.tgz
agentbridge --version
```

Use a writable npm prefix; do not run as administrator solely to install this tool. Ensure that prefix's executable directory is on PATH. If PowerShell blocks the generated script, use `agentbridge.cmd`. The archive has no runtime dependencies or lifecycle hooks; install and runtime can work offline. npm may write its own cache/logs and command shims. For removal, use `npm uninstall --global --ignore-scripts agentbridge` with the same prefix.

## First handoff

From your **existing software project's root**, run:

```sh
agentbridge doctor
agentbridge init
```

Edit `.agentbridge/context.md` with the project purpose, verified commands, constraints and current goal. Then record actual work from the previous session; these example facts must be replaced with your own:

```sh
agentbridge handoff --save --from codex --to claude --done "Reject empty postal codes; two tests passed" --next "Add a Unicode fixture and run npm test" --blocked "Carrier sandbox unavailable; use offline fixtures"
agentbridge sync --dry-run
agentbridge sync
agentbridge status
```

If instructions already exist, the unapproved sync stops without replacing them. After reviewing the preview, repeat sync with only the printed filenames, for example `agentbridge sync --approve-overwrite CLAUDE.md`. Every changed existing instruction requires exact approval, including later updates. User text outside AgentBridge markers stays in its own file. Keep backups under `.agentbridge/backups/` out of version control; they can contain private guidance.

Review the generated `CLAUDE.md`, then start a new receiving session from the project root. Direction labels record history; sync still generates all three targets. To save another note, review the old one and use `--replace-note`, then preview/sync again. Malformed markers require manual reconciliation; doctor never repairs files or removes locks.

## Limits and reporting

Codex loading was verified through offline prompt inspection; actual Claude Code/Gemini CLI loading and all model behavior remain unverified. Structural drift detection cannot resolve contradictory prose or prove note freshness. Secret recognition is heuristic. No write-permission or hostile-process safety certificate is provided. See included SECURITY.md for trust boundaries and private reporting; THIRD_PARTY_NOTICES.md preserves license scope.

Full source, documentation and compatibility evidence: [doksanbes/agentbridge](https://github.com/doksanbes/agentbridge). Original project work is MIT; Node, npm, Git and external agents retain their own licenses. This project is independent of OpenAI, Anthropic and Google.
