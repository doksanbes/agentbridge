# AgentBridge

Carry reviewed project context between Codex, Claude Code, and Gemini CLI, entirely offline.

AgentBridge combines one editable Markdown context file, explicit session notes, and filtered Git facts. It generates the three agents' project instruction files and reports drift before replacing anything. It never calls an AI model or reads chat histories.

**Status: experimental, 0.1.0 (unreleased).** For developers who switch coding agents mid-task and want the next session to know what is done, what to do next, and what is blocked. You review the facts; AgentBridge writes them into `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, while preserving existing user instructions outside its managed section.

**Limits:** it does not transfer conversations, infer completed work, launch agents, or resolve contradictory instructions. There is no published npm package. This independent project is not affiliated with OpenAI, Anthropic, or Google.

## Install from source

Requirements: Git, Node.js **22.18+ or 24**, and pnpm **11.25.0**. These are the tested Node lines; other versions have not been validated. Install Node and Git first, then run:

```sh
git clone https://github.com/doksanbes/agentbridge.git
cd agentbridge
# Skip this command if pnpm 11.25.0 is already installed.
npm install --global pnpm@11.25.0 --ignore-scripts
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
node dist/cli.js --help
```

The first installation downloads open-source development packages. After building, the CLI runs offline using only Node.js, with zero runtime packages. **AgentBridge requires no API key, agent account, subscription, or paid API.** Running a receiving agent is a separate activity with that tool's own requirements. The package is marked `private` to prevent accidental npm publication.

## First handoff: Codex to Claude Code

Run these commands from the AgentBridge checkout. Replace `../my-project` with the **existing project root** containing your code, not the AgentBridge checkout. Quote paths containing spaces. On Windows, an absolute path such as `"D:\work\my project"` also works. If running from another directory, use the absolute path to AgentBridge's `dist/cli.js`.

1. Initialize the project and inspect its tracked filenames:

   ```sh
   node dist/cli.js init --project "../my-project"
   node dist/cli.js discover --project "../my-project"
   ```

   Edit `../my-project/.agentbridge/context.md` in your editor. Replace the template with the project's purpose, verified test commands, constraints and current goal. Discovery lists safe tracked paths; it does not write the context for you or read source contents. A new repository with no tracked files produces an empty inventory.

2. Record what actually happened in the previous session. For example, in a ParcelKit postal-code parser, Codex finished empty-input validation and two tests passed. The next session needs Unicode coverage, while a carrier sandbox is unavailable:

   ```sh
   node dist/cli.js progress --project "../my-project"
   node dist/cli.js handoff --project "../my-project" --save --from codex --to claude --done "Reject empty postal codes; two tests passed" --next "Add a full-width Unicode postal-code fixture; run npm test" --blocked "Carrier sandbox unavailable; use offline fixtures only"
   ```

   These notes are supplied by you, not inferred from Git or chat history. Use the commands and results you actually verified in your project. `handoff --save` writes `.agentbridge/handoff.md`; **sync is still needed to distribute it**.

3. Review the full generated files before applying them:

   ```sh
   node dist/cli.js sync --project "../my-project" --dry-run
   node dist/cli.js sync --project "../my-project"
   node dist/cli.js status --project "../my-project"
   ```

   This succeeds when the three instruction files are absent. If any already exist, sync stops and prints the exact filenames needing approval. After reviewing the preview, approve only those names. For example, if only `CLAUDE.md` already exists:

   ```sh
   node dist/cli.js sync --project "../my-project" --approve-overwrite CLAUDE.md
   ```

4. Review `CLAUDE.md` in the project, then start a new Claude Code session **from that project root**. The generated handoff includes:

   ```markdown
   From: Codex
   To: Claude Code

   ## Completed
   - Reject empty postal codes; two tests passed

   ## Next steps
   - Add a full-width Unicode postal-code fixture; run npm test

   ## Blockers
   - Carrier sandbox unavailable; use offline fixtures only
   ```

   Claude Code documents `/memory` for inspecting instruction files; its actual loading has **not been verified here**. Ask the receiving agent to review the context and next step before coding. No model compliance is guaranteed.

For Gemini CLI or the reverse direction, change the paired `--from` / `--to` values to distinct names from `codex`, `claude`, and `gemini`. These labels record history; **every sync still generates all three instruction files**. No agent is launched. A fresh session avoids relying on an agent's in-session reload behavior.

## Update, conflicts and recovery

On the next handoff, review the old `.agentbridge/handoff.md`, then add `--replace-note` to the save command. You can also edit the note directly. Repeat `--done`, `--next`, and `--blocked` for multiple entries, or add `--dry-run` to preview a save. `handoff` without `--save` prints the saved note plus fresh Git facts. Saved snapshots remain historical until explicitly replaced; plain sync does not refresh them.

After editing context or notes, preview and sync again. **Every change to an existing instruction file requires exact filename approval, even if AgentBridge created it.** A typical later sync, after reviewing all three proposals:

```sh
node dist/cli.js sync --project "../my-project" --dry-run
node dist/cli.js sync --project "../my-project" --approve-overwrite AGENTS.md,CLAUDE.md,GEMINI.md
```

| Situation | Recovery |
| --- | --- |
| Project directory does not exist | Create your software project first, or correct `--project`; `init` creates context inside an existing directory. |
| Discovery is empty | Only tracked paths are listed. Check the selected Git root and which files you intentionally track. Exclusions still apply to tracked files. |
| Saved handoff exists | Review it, then edit it directly or save with `--replace-note`. Sync again afterward. |
| `status` reports drift | Review `sync --dry-run`, reconcile context/notes and local edits, then approve the affected filenames. Exit code 1 means drift. |
| Managed section has a `conflict` | Move any rules you want to keep into canonical context or outside the markers before approving. Approval replaces edits inside the section. |
| Malformed markers or edited legacy output | No files are changed. Manually reconcile the file or restore a reviewed, known-good backup, preserving any newer user guidance, then preview again. |

Approvals apply to one invocation. There is no wildcard approval or `--force`. Text outside `<!-- agentbridge:begin -->` and `<!-- agentbridge:end -->` is preserved byte-for-byte in its own target file, including CRLF and UTF-8 BOMs; it is not copied into other agents' files. Review the complete proposal for natural-language contradictions, which AgentBridge cannot detect.

Before replacement, existing files are backed up in `.agentbridge/backups/<sha256>/<filename>`. Review backups before restoring them; never blindly discard newer guidance. Add that backup directory to your project's `.gitignore` before sharing: it can contain old private instructions. AgentBridge never changes ignore rules. Untouched legacy generated files can migrate after approval; edited legacy files require manual reconciliation.

## Verified compatibility

The [post-merge main CI run](https://github.com/doksanbes/agentbridge/actions/runs/40848570913) passed all six Windows/macOS/Linux × Node 22.18/24 jobs. A clean public clone also passed installation, setup, preview, handoff, conflicts and recovery on Windows in a path containing spaces and Unicode.

| Agent | Generated files | Actual CLI loading |
| --- | --- | --- |
| Codex | `AGENTS.md`, simulated handoffs tested | Verified offline with installed `codex-cli 0.165.0-alpha.1.2` using prompt inspection; zero inference requests |
| Claude Code | `CLAUDE.md`, simulated handoffs tested | **Unverified**; CLI not found in the validation environment |
| Gemini CLI | `GEMINI.md`, simulated handoffs tested | **Unverified**; CLI not found in the validation environment |

All six transfer directions were simulated against a real synthetic software project. These checks verify files and workflow, not model behavior. The [validation report](docs/USABILITY_VALIDATION.md) separates simulated and actual agent evidence. Official loading references: [Claude Code memory](https://code.claude.com/docs/en/memory) and [Gemini CLI context](https://geminicli.com/docs/cli/gemini-md/).

## Commands

| Command | Result |
| --- | --- |
| `init [--dry-run]` | Create `.agentbridge/context.md`; preserve existing context |
| `discover` | JSON inventory of filtered tracked paths and common manifest filenames; never read manifest contents |
| `progress` | Five recent commit IDs, filtered changed paths, and tracked working-tree status |
| `handoff` | Print saved notes plus live Git facts |
| `handoff --save --next "..."` | Record explicit notes with current Git facts |
| `sync [--dry-run]` | Preview or generate all three instruction files |
| `sync --check` / `status` | Read-only drift check suitable for CI |

All commands accept `--project <directory>`. Use the Git root for Git projects; nested-folder writes are rejected. A plain directory without Git supports initialization, notes, and sync but reports no discovered files. When ignore rules exist but cannot be safely evaluated, writes and context reads fail closed.

Exit codes: `0` success, `1` drift from `status` or `sync --check`, `2` invalid or unsafe operation. `--dry-run` reports drift without failing and never writes context, backups, state, locks, or instructions. Sync/status output is readable text by default. Sync preview prints the full proposed files with normal Markdown line breaks. Add `--json` to sync/status for machine-readable statuses, hashes and proposed content. Existing scripts that parsed the initial MVP's default JSON must add that flag.

Statuses: `create`, `unchanged`, `update` (source changed), `conflict` (output edited since last sync and requires a change), `unmanaged` (no prior baseline). Every changed existing file requires its exact overwrite approval, including appends that preserve user text. Git status entries include readable staged/unstaged descriptions alongside the original XY code.

## Context and privacy

`.agentbridge/context.md` is ordinary, human-editable Markdown. Include purpose, verified commands, architecture, decisions, constraints, and the current goal. `init` supplies an honest template rather than inventing architecture or commands. See [example context](examples/context.md).

Complete generated samples are in [examples/generated](examples/generated).

The only content inputs are that context, the explicit handoff note, optional `.agentbridgeignore`, and sync state. Current instruction files are read to detect changes, preserve their user sections in the same file, and keep backups; their contents are never imported into the canonical file or other outputs. No home-directory search, environment-file reads, source-file reads, transcript discovery, hooks, MCP configuration changes, telemetry, subprocess agents, or network requests occur in the CLI.

Discovery uses tracked paths only. Git facts omit commit messages, authors, remote URLs, branches, diffs, and untracked paths. Git ignore rules are checked even for tracked paths. Built-in exclusions cover hidden agent/config directories, environments, credentials, service-account/auth files, keys, Terraform state/variable files, databases, logs, dependency/build directories, private directories, sessions and transcripts. Symlinks, junctions, hard-linked context files, unsafe paths, invalid UTF-8 and oversized context are refused. Credential-pattern checks are best effort; review context yourself.

Add stricter filename exclusions in `.agentbridgeignore`:

```text
# Additive exclusions; never re-include a built-in exclusion.
internal/
**/customer-*.json
/design/*.md
```

Supported patterns: `*`, `**`, `?`, root `/`, directory trailing `/`, and comments. Negation, character classes, braces, and backslashes are rejected. Patterns are case-insensitive for portability. This deliberately small syntax is not a replacement for Git's ignore engine.

Keep the combined user text and generated section under 24 KiB per file. `@file` import syntax is rejected in canonical context and notes so AgentBridge does not introduce automatic imports. Existing user imports outside its section are preserved; AgentBridge never follows them. Plain email addresses remain allowed. Arbitrary instructions can still conflict semantically: AgentBridge detects file drift, not disagreements in natural language. Review global and nested agent instructions separately.

## Development and evidence

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm validate:workflow
```

Tests use Node's built-in runner and temporary synthetic repositories. `validate:workflow` runs all six agent-pair handoff directions against a real disposable parser project, executes its tests, and retains the synthetic project and artifacts for inspection. It simulates the agents and does not invoke their CLIs. The optional developer-only `node scripts/validate-codex.mjs "<synthetic-project-path>"` uses an installed Codex prompt-inspection command with isolated configuration and a loopback-only provider; it starts no inference turn.

AgentBridge focuses on reviewed task handoffs rather than global agent configuration; rule synchronization alone is already served by established tools. See [competitive research](docs/RESEARCH.md), [architecture](docs/ARCHITECTURE.md), [latest validation](docs/USABILITY_VALIDATION.md), [initial MVP validation](docs/VALIDATION.md), and [provenance/dependency review](docs/PROVENANCE.md). The GitHub Actions workflow runs tests and the simulated workflow on Windows, macOS, and Linux with Node 22 and 24. The linked post-merge main run passed all six jobs; PRs run the same matrix.

Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Security boundaries and private reporting: [SECURITY.md](SECURITY.md). Original project code, documentation and synthetic examples are [MIT](LICENSE); external tools and dependencies retain their own licenses as recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
