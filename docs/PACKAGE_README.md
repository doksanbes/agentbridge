# AgentBridge — experimental

Carry reviewed project context between Codex, Claude Code and Gemini CLI, offline. One editable context file and explicit handoff notes generate `AGENTS.md`, `CLAUDE.md` and `GEMINI.md`. AgentBridge never calls a model or reads chat histories.

This guide covers the experimental v0.2.0 npm-format archive intended for GitHub prerelease distribution. Check [GitHub Releases](https://github.com/doksanbes/agentbridge/releases) for a maintainer-published v0.2.0 prerelease with an `agentbridge-0.2.0.tgz` asset. If that asset is not listed, it is not available through this channel. These instructions do not announce publication.

When available, obtain the precompiled `.tgz` asset, not GitHub's automatically generated source-code ZIP or tarball, which does not include the compiled CLI. Use npm to install the downloaded file locally. This is separate from npm registry installation: do not substitute an unqualified `npm install --global agentbridge` or registry-based npx command. The package name is local metadata, not proof of npm namespace ownership; registry publication requires separate verification and approval.

## Codex handoff skill — v0.2.0 candidate

The v0.2.0 candidate adds a one-time `agentbridge install-skill` setup. In Codex, select `$agentbridge-handoff to Claude Code` (or Gemini CLI), review the proposed summary and file changes, then approve. The skill handles project detection, context initialization, notes and synchronization. **This is absent from v0.1.0; bare `/handoff` is not supported in Codex.** No transcript storage or new inference API is used; the host agent drafts from the active session.

See the [candidate feature guide](https://github.com/doksanbes/agentbridge/blob/main/docs/SESSION_HANDOFF.md) for setup. Existing manual commands below continue to work. A human-approved synthetic desktop-chat handoff passed; desktop-picker activation, other interactive scenarios and actual Claude/Gemini loading remain unverified.

## Install a reviewed archive

Requires Node.js 22.18+ or 24 with npm. Git is needed for discovery/progress; a plain directory supports basic context with reduced functionality. No pnpm, TypeScript, clone, agent account or API key is needed.

Compare the archive's SHA-256 with the value obtained through your trusted distribution channel. A checksum from the same untrusted download is not an authenticity guarantee. Then, from the directory containing the archive:

```sh
npm install --global --offline --ignore-scripts --no-audit --no-fund ./agentbridge-0.2.0.tgz
agentbridge --version
```

Use a writable npm prefix; do not run as administrator solely to install this tool. Ensure that prefix's executable directory is on PATH. If PowerShell blocks the generated script, use `agentbridge.cmd`. The archive has no runtime dependencies or lifecycle hooks; install and runtime can work offline. npm may write its own cache/logs and command shims. For removal, use `npm uninstall --global --ignore-scripts agentbridge` with the same prefix.

## First handoff with Codex

Run `agentbridge install-skill` once. In your project’s Codex session, select `$agentbridge-handoff to Claude Code` (or choose the skill through `/skills`), review the proposed notes and file changes, then explicitly approve. A Codex account/session is needed for the agent-assisted drafting; AgentBridge itself remains offline and requires no API key. The CLI digest is not proof of human consent: the skill must wait for your reply.

## Manual CLI alternative

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

Codex instruction/skill discovery was verified through offline prompt inspection; the desktop session listed the installed skill and a synthetic handoff used real human approval. Actual Claude Code/Gemini CLI loading and some interactive scenarios remain unverified; model compliance is not guaranteed. Structural drift detection cannot resolve contradictory prose or prove note freshness. Secret recognition is heuristic. No write-permission or hostile-process safety certificate is provided. See included SECURITY.md for trust boundaries and private reporting; THIRD_PARTY_NOTICES.md preserves license scope.

Full source, documentation and compatibility evidence: [doksanbes/agentbridge](https://github.com/doksanbes/agentbridge). Original project work is MIT; Node, npm, Git and external agents retain their own licenses. This project is independent of OpenAI, Anthropic and Google.
