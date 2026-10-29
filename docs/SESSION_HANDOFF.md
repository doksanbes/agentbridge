# Reviewed session handoff (unreleased)

This feature is on the feature branch, **not in the published v0.1.0 archive**.
AgentBridge remains experimental. Install a reviewed candidate build once; then a
Codex skill handles discovery, preparation and synchronization after your approval.

## Setup once

For now, check out this feature branch and follow the source installation in the
README, then run `pnpm package:build`. Install that locally built candidate archive:

```sh
npm install --global --offline --ignore-scripts --no-audit --no-fund ./.cache/packages/agentbridge-0.1.0.tgz
agentbridge install-skill
```

The filename retains development metadata; this is not a replacement published
v0.1.0 asset or a new release. Verify the candidate's checksum and source before
installing. Requires Node 22.18+ or 24, npm, a writable prefix on PATH and installed
Codex. Use `agentbridge.cmd` if PowerShell blocks npm's script shim. No new account,
API key, subscription, paid API or runtime dependency is introduced by AgentBridge.
The host agent's normal account and inference requirements still apply.

`install-skill` creates only `~/.agents/skills/agentbridge-handoff/SKILL.md`.
It is idempotent and refuses to replace different content. Use `--dry-run` to
preview installation, `--skill-home <existing-directory>` for a selected home or
repository-scoped installation. It rejects linked descendant paths. To uninstall,
review then remove that skill directory yourself; no project files are removed.

## One action, then approval

In Codex CLI, type `$agentbridge-handoff to Claude Code`, or choose the skill using
`/skills`. In Codex desktop use the Skills selector/mention offered by your version
(current documentation also describes skill selection with `@` in ChatGPT).
Restart the host if a newly installed skill is not listed.

**Bare `/handoff` is not implemented in Codex.** It would require assuming an
unsupported custom slash command or using deprecated custom prompts. Skill names
are discoverable; you do not have to remember the underlying CLI sequence.

A realistic interaction, with results known from the active session:

> User: $agentbridge-handoff to Claude Code
>
> Codex: ParcelKit, repository root selected. Completed: empty-input rejection and
> trimming; the two postal tests passed earlier in this session. Next: add full-width
> Unicode coverage and rerun those tests. Blocked: carrier sandbox unavailable;
> use offline fixtures. I will create context, replace the saved handoff and update
> AGENTS.md, CLAUDE.md and GEMINI.md. Existing team rules are preserved; here are
> the proposed changes. Approve this exact handoff and these files?
>
> User: Approve.
>
> Codex: Saved. Open Claude Code in this project, start a fresh session, and ask it
> to read CLAUDE.md and .agentbridge/handoff.md, verify the working tree, then
> continue with Unicode coverage.

Choose Gemini CLI instead and the continuation points to `GEMINI.md`. Sync still
prepares all three formats. AgentBridge does not start, authenticate, or send data
to the destination. Review saved context before committing or sharing it.

## What happens

- `session --inspect` detects the canonical Git root from the working directory.
  An explicit `--project` is an exact boundary. Plain directories work with no Git
  facts. Missing paths, nested explicit roots and unevaluable ignore rules fail safely.
- Inspection returns filtered tracked paths, project-marker filenames, up to five
  commit IDs, tracked status, and existing AgentBridge context/notes. No patches,
  source bodies, commit messages/authors/remotes, untracked contents, secrets,
  ignored files or stored conversations are collected. Root paths and permitted
  filenames are shown locally to the agent/user, so inspect in the intended project.
- Codex drafts purpose, completed work, next steps, blockers and test evidence from
  the active conversation. Git does not prove completion or passing tests. Unknown
  purpose/destination/next steps require a question. Summaries can be wrong: review.
- JSON on stdin to `agentbridge session` returns full proposed contents, previous
  contents, statuses and a SHA-256 approval token. Preview writes **nothing**.
  Existing canonical context is preserved; new context needs a concise purpose.
- After a separate human approval, the skill resubmits identical input using
  `session --approve <digest>`. The digest binds root, visible Git facts, source
  snapshots, previous output bytes and proposed writes. Changed inputs invalidate it.
  It authorizes the named replacements displayed in that preview. Legacy `sync`
  retains its exact-filename `--approve-overwrite` gate.
- Existing user bytes outside managed sections are preserved. Replaced notes and
  instructions receive content-addressed private-mode backups. Conflicting managed
  edits are included in the preview and require approval; damaged markers stop.

The approval digest prevents accidental/stale writes; it is **not proof a human
approved**. An agent or caller can compute it. The skill must wait for the human;
there is no desktop consent UI enforced by the CLI. No multi-file filesystem
transaction or protection against hostile concurrent writers is promised. If an
I/O error interrupts applying, inspect the files/backups with `doctor` and preview
again. Do not remove a lock until you know no writer is running.
Git facts bind filtered status and paths, not source-content hashes; unchanged
status does not prove unchanged source bytes or fresh test results.

Secret detection is heuristic. The reviewed session flow also refuses recognizable
credentials or implicit `@file` imports in existing instructions/notes rather than
echoing them in a rich preview. The existing manual workflow remains available;
review and repair such input explicitly. Do not put private material into summaries.
The host agent sees the active session and returned context under its own privacy
settings; AgentBridge's offline runtime does not make a hosted model local.

## Integrations and evidence

Reviewed official documentation on 2026-10-29:

| Host | Supported mechanism | Decision and verification boundary |
| --- | --- | --- |
| Codex CLI | Local SKILL.md, user/repository discovery, `$` mention or `/skills` | Implemented first. Real CLI offline prompt inspection can verify discovery; interactive invocation and model approval behavior require an actual session. |
| Codex desktop | Standalone skills and a skill selector | Same installed skill, documented support. Desktop interactive workflow has not been exercised. |
| Claude Code | SKILL.md and `/skill-name`; CLAUDE.md project instructions | A future incoming adapter could use this. This change generates CLAUDE.md; actual Claude loading remains unverified. |
| Gemini CLI | TOML custom slash commands, skills, GEMINI.md project context | A future adapter could expose `/handoff`. This change generates GEMINI.md; actual Gemini loading remains unverified. |

Sources: [OpenAI skills](https://learn.chatgpt.com/docs/build-skills),
[deprecated Codex custom prompts](https://learn.chatgpt.com/docs/custom-prompts),
[Claude skills](https://code.claude.com/docs/en/skills),
[Claude memory](https://code.claude.com/docs/en/memory),
[Gemini custom commands](https://geminicli.com/docs/cli/custom-commands/),
[Gemini project context](https://geminicli.com/docs/cli/gemini-md/).
Hook references: [Codex](https://learn.chatgpt.com/docs/hooks),
[Claude Code](https://code.claude.com/docs/en/hooks),
[Gemini CLI](https://geminicli.com/docs/hooks/).
Hooks are unnecessary for an explicitly requested handoff and risk capturing work
without review. No hooks, transcript access, MCP server or private API is used.

`node scripts/validate-session.mjs` demonstrates a temporary synthetic postal-code
project, runs its two tests, prepares a Claude handoff, simulates approval, then
prepares a repeated Gemini handoff. It is not a real agent behavioral evaluation.
With `AGENTBRIDGE_CODEX_BINARY` selecting an installed executable, it additionally
uses Codex's debug prompt renderer with isolated configuration and a rejecting
local provider. It checks discovered skill metadata with zero inference requests;
the renderer does not exercise interactive skill expansion or approval behavior.

CI exercises the synthetic flow and clean offline package installation on Windows,
macOS and Linux with Node 22.18 and 24. No inference tests run in CI. The candidate
archive now has 15 explicit files (the original 13 plus dist/codex.js and
dist/session.js), no dependencies or install hooks. The immutable v0.1.0 artifact
and its pinned attested-build workflow are unchanged.
