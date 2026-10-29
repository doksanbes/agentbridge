# Initial MVP validation report

Historical record of the initial 26-test milestone. Current Node 22, expanded usability tests, six-direction workflow and actual offline Codex loading evidence are in [USABILITY_VALIDATION.md](USABILITY_VALIDATION.md).

Completed October 29, 2026 in the local Windows workspace. No public repository, remote, package publication, deployment or paid service was created. No agent account, subscription or model API was needed.

## Observed results

| Check | Actual result |
| --- | --- |
| Frozen dependency install, scripts disabled | Passed with pnpm 11.25.0 |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed; executable `dist/cli.js` generated |
| `pnpm test` | 26 passed, 0 failed, 0 skipped; final run approximately 43 seconds |
| `pnpm audit --json` | Zero known info/low/moderate/high/critical advisories across 3 development packages at review time |
| Compiled CLI `--help` smoke check | Passed |
| Generated sample comparison | All 3 samples matched deterministic renderer output; 1109 / 1115 / 1114 UTF-8 bytes |

Environment: Windows, Node.js 24.22.1, Git 2.53.0.windows.3. Git and Node were supplied by the desktop's bundled runtime and added to PATH for commands. Development dependencies were downloaded once, with lifecycle scripts disabled; the compiled product itself performs no network operations.

The initial restricted-shell test run could not write synthetic `.git/config` files or replace files by rename in the sandbox's temporary directory. Full filesystem tests were rerun with authorized local permissions. A real plural sensitive-filename exclusion defect was fixed and covered by regression tests. A later exact-backup review added BOM preservation. Final results above reflect the corrected implementation. pnpm's current project settings are recorded in `pnpm-workspace.yaml` so the Windows hoisted installation and project-local cache agree with subsequent commands.

## Scenarios covered

- Full initialize → edit canonical context → record handoff → preview → generate → status workflow.
- Deterministic output, LF normalization, unchanged-output idempotence and documented agent filenames.
- Existing contradictory instruction files, all-or-nothing approval preflight, explicit filename approvals, exact backups and source/output drift.
- Tampered state never authorizes overwrite; invalid JSON state is rejected.
- No-write initialization, sync, handoff and status/check operations, verified by file-content snapshots.
- Tracked ignored files, environments, keys, credentials, hidden agent session directories, custom exclusions and untracked files.
- Canary private data in source bodies and commit messages does not appear in discovery or progress.
- Missing Git, no repository, empty/unborn repository, nested-folder selection and inherited Git overrides.
- Git worktrees, Unicode/spaced Windows paths, tracked deletions and sensitive rename endpoints.
- Symlinks/junctions, hard links, stale write expectations, locks, oversized inputs, invalid UTF-8, imports and likely credentials.
- Empty notes, intentional replacement of saved handoffs, unknown/irrelevant flags and wildcard approval rejection.
- UTF-8 BOM and CRLF preservation in backups, and missing Git beneath an existing repository boundary.

The synthetic ParcelKit outputs in `examples/generated/` were inspected for a concrete purpose, commands, architecture, decisions, goal and working agreements. The automated workflow verifies manual next steps and completed work survive generation into every target. No private project or actual chat history was used.

## Compatibility evidence and remaining work

The generated files use plain Markdown and the project instruction filenames described by [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Claude Code](https://code.claude.com/docs/en/memory) and [Gemini CLI](https://geminicli.com/docs/cli/gemini-md/). This establishes format compatibility, not an observed live-agent session. Global preferences, overrides, nested files, context budgets and agent versions still affect actual loading.

The prepared GitHub Actions workflow tests Windows/macOS/Linux with Node 22.18 and 24. It has **not run on GitHub**; macOS, Linux and Node 22 have not been executed locally. No claim of passing those environments is made.

Known limitations: no semantic instruction conflict detection or two-way merge; no automatic transcript transfer; a bounded filename-based Git summary rather than a semantic explanation; best-effort secret recognition; a 24 KiB combined output budget; root-project scope; no whole-operation filesystem transaction; and a small final file-check/write race in the presence of hostile concurrent mutation. Review backups and stale locks manually after interruption. See architecture and security documentation for recovery and trust boundaries.

Next milestone: user field trials and real agent-loading checks, followed by the most justified review/merge or existing-tool interoperability improvement. Establish a private vulnerability contact and repeat provenance/advisory review before any approved public release.
