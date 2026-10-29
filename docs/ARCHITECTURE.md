# Architecture

AgentBridge 0.1.0 is a TypeScript ESM CLI compiled to JavaScript for Node 22.18+. The CLI performs no runtime network operations and executes only fixed, read-only Git commands with argument arrays and no shell. It never executes commands found in a project.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/cli.ts` | Strict arguments, command-specific option validation, exit codes and output |
| `src/safety.ts` | Relative paths, file-type/link guards, UTF-8/size limits, additive globs, credential/import checks, checked writes |
| `src/git.ts` | Root validation, authoritative Git ignore checks, tracked metadata inventory, status and recent commit paths |
| `src/context.ts` | Canonical template, reviewed input loading and deterministic agent renderers |
| `src/managed.ts` | Marked-section replacement, preservation of user text, strict marker/legacy migration checks |
| `src/handoff.ts` | Manual note formatting and optional sending/receiving agent labels |
| `src/sync.ts` | Hash baseline, synchronization plan, overwrite approvals, backups, sync lock and application |

## Files and ownership

```text
.agentbridge/
  context.md                  human-owned durable guidance
  handoff.md                  explicit latest notes + saved Git facts
  state.json                  v1 output SHA-256 baseline; no approval authority
  lock                        exclusive lock while applying a sync
  backups/<hash>/<filename>   exact pre-replacement UTF-8 text
.agentbridgeignore            optional additive filename exclusions
AGENTS.md                     Codex output
CLAUDE.md                     Claude Code output
GEMINI.md                     Gemini CLI output
```

The same reviewed content goes into each target's marked section, with an agent-specific provenance header. There is no agent-specific instruction synthesis. No timestamps, filesystem paths, randomness, or live Git state enter a sync render. Equal reviewed source bytes after LF normalization yield equal generated sections on all platforms; complete outputs also depend on each target's preserved user text, whose original line endings remain intact. Handoff snapshots change only on explicit save.

Text outside `<!-- agentbridge:begin -->` / `<!-- agentbridge:end -->` is user-owned. The initial adoption appends one section with approval. Subsequent syncs replace only that section, retaining the exact prefix/suffix. Malformed, reversed, inline or duplicate markers fail closed. Reserved markers in canonical context/notes are rejected. Untouched initial-MVP files with a matching baseline migrate with approval; edited legacy files stop for manual reconciliation rather than guessing which additions belong to the user. Pre-existing imports remain in their target file but are not followed or propagated.

## Sync protocol

1. Validate project/input/output paths and exclusion policy. Read bounded context, note, state and target files.
2. Produce all three proposals before changing files. Compare current output hashes with the recorded baseline and desired bytes.
3. Preview emits readable statuses and complete proposed content; `--json` includes content hashes for scripts. Checks return drift without writing.
4. Apply refuses any changed existing target without its exact filename in `--approve-overwrite`, regardless of baseline or state.
5. Acquire an exclusive sync lock. Recheck input and target bytes before writes. Back up every replaced target before replacing any output.
6. Create absent outputs with exclusive creation, write the combined preserved-user/managed-section output through sibling temporary files and rename, then update state. Unchanged outputs are not rewritten.

Preflight conflicts and concurrent modifications detected at recheck abort the operation. A process crash or I/O failure during the multi-file commit can leave partially updated outputs: there is no filesystem-wide transaction. The next preview reports remaining drift; inspect backups and approve only the desired replacements. A stale lock must be removed manually after checking that no writer is active. Hashes identify byte changes; they do not prove origin, authenticity, or correctness.

## Git and privacy

Only the selected Git root is inspected. Repository-related inherited `GIT_*` overrides are removed, optional Git locks are disabled, and fsmonitor is disabled to avoid invoking configured filesystem-monitor hooks. Git subprocesses have a ten-second timeout and two-MiB output bound. Errors fail closed instead of emitting partial inventory.

Discovery reads tracked path metadata, not source/manifest contents. Status ignores untracked files. History uses at most five commit IDs with changed paths, without commit messages, authors or patch content. Git ignore matching uses `check-ignore --no-index` so even force-tracked ignored files are excluded. Built-in/custom exclusions and unsafe link checks are then applied. A rename involving an excluded endpoint is omitted from working-tree status. Lists are sorted and capped. Counts communicate omissions without printing excluded names.

No-Git directories return an empty discovery inventory. Context operations still work when there are no Git ignore rules to evaluate. A missing Git executable, nested repository selection, or unavailable ignore engine cannot bypass an existing Git/ignore boundary. The MVP does not traverse submodules or discover a monorepo's nested instruction files. Review agent-level global/ancestor/nested instructions separately.

## Threat model and limits

`safePath` resolves the selected project root to an existing physical directory before walking child components, matching the CLI's root-selection behavior. An alias at or above that selected root (such as a Windows junction/short name or macOS temporary-directory symlink) is valid. Every descendant is still checked with `lstat` before its `realpath` is compared with the resolved root; descendant links, hard links and escapes remain rejected. No blanket lowercasing is applied, so filesystem case semantics and distinct case-sensitive directories are preserved. Missing roots and non-directory roots fail before child writes.

Protect accidental disclosure and unintentional instruction replacement in a normal local development workflow. Detect likely credentials and avoid automatic imports. Do not claim protection against a malicious local process that can mutate files between OS calls, filesystem permission changes, hostile Git binaries, crafted Git configurations/includes, or arbitrary natural-language secrets. There is a small final check-to-rename race; do not run writes concurrently with untrusted processes. Node file modes are best effort on Windows and do not replace ACLs. Git hashes and ordinary paths can themselves reveal project metadata; review before sharing.

Conflict detection is structural: unmanaged output, canonical-source change, output edit, invalid state, exclusion violation, or detected concurrent modification. It cannot reconcile instructions such as “use Python” versus “use Rust” or infer whether a note is stale. Such conflicts require human editing of the canonical file before approving generation.
