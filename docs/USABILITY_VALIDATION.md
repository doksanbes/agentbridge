# Usability and end-to-end validation

## Fresh developer follow-up — October 29, 2026

After PR #1 merged, a fresh public clone was checked out at `c999a5ffe5e42f413fcc0c665040324f88624423` in a new operating-system temporary directory with spaces and Unicode in its path. The [post-merge main CI run](https://github.com/doksanbes/agentbridge/actions/runs/40848570913) passed all six Windows/macOS/Linux × Node 22.18.0/24 jobs, including typecheck, build, 39 tests and the simulated workflow. No expected job or validation step was missing or failed.

The fresh clone installed frozen dependencies with lifecycle scripts disabled and built successfully. A separate synthetic ParcelKit project exercised first-time initialization, tracked discovery, manual Codex-to-Claude notes, previews and all three generated targets. Existing CRLF team guidance survived sync. Unapproved writes and managed-section edits were blocked; named approval, explicit note replacement and restoration of a known-good damaged-marker file recovered the workflow. The independent six-direction validator also passed, ending with seven passing parser tests.

Observed first-user friction prompted focused changes:

- The README assumed an existing checkout and still said hosted CI had never run. It now includes the clone command, tested prerequisites and observed CI evidence.
- Saving a note, distributing it and starting the receiving session were separate steps that needed explanation. The walkthrough now joins them in a realistic Codex-to-Claude example and explains that route labels do not select output files.
- Empty tracked discovery, repeated-note protection, overwrite approval and malformed-marker recovery were correct but easy to misunderstand. A recovery table explains each case without bypassing safeguards.
- A missing project directory returned a raw `ENOENT` path. The CLI now explains how to select or create an existing project directory; a regression checks exit code 2, no directory creation and no path disclosure. Filesystem safety checks are unchanged.

Actual agent availability was checked again: Codex `0.165.0-alpha.1.2` was installed; Claude Code and Gemini CLI were not found on PATH or checked standard installation paths. The fresh clone's Codex validator verified purpose, constraints, saved handoff and latest next step through real offline prompt inspection with isolated configuration and **zero inference requests**. No account-backed session or model behavior was tested. Claude/Gemini loading remains **unverified**; simulated output is not a substitute.

After the onboarding changes, all **40 tests passed with zero failures or skips** locally on Windows under Node 22.18.0 and 24.22.1. Typechecking and builds passed on both versions. The updated six-direction workflow passed on Node 24, ending with seven passing parser tests. The publication preflight still found exactly 47 source files and zero unreviewed findings; no dependencies, filesystem checks or approval rules changed.

## Earlier pre-publication validation record

The remainder records the earlier local milestone, before repository creation and PR #1; its test counts and publication status are historical. It superseded the initial 26-test milestone while preserving its [historical record](VALIDATION.md). At that point no AgentBridge repository had been created and nothing had been pushed, published or released. No paid APIs, account-backed prompts, subscriptions or purchased services were used.

## Problems observed and fixes

| Observed problem | Evidence before the fix | Implemented behavior |
| --- | --- | --- |
| Existing guidance disappeared after an explicitly approved sync | A fixture's `CLAUDE.md` contained “Keep the public API stable.”; the initial MVP's output omitted it. | Append/update one delimited section. Preserve exact user prefix/suffix bytes in the same file, with approval and full backups. |
| Preview was hard to review | Complete Markdown appeared inside JSON strings with escaped newlines and hashes. | Readable statuses, explanations and full Markdown proposals by default; `--json` preserves automation support. |
| Notes had no sending/receiving agent identity | The original saved note carried tasks but no direction. | Optional paired `--from` / `--to` labels, validated against the three supported agent names. |
| XY Git codes needed interpretation | A snapshot showed ` M` or `M ` without explanation. | Retain codes and add readable staged/unstaged descriptions. |
| A credential-like old note prevented its own replacement | `handoff --save --replace-note` validated the old note before considering new safe notes. | Validate the canonical source and new note; permit explicit replacement of a bounded old note without propagating it. |
| A common credential filename appeared in metadata | The larger workflow caught `service-account.json` in a path summary; its contents were never read. | Add auth/service-account, kubeconfig, additional private-key and Terraform-state exclusions, including force-tracked cases. |

Additional regressions cover malformed/duplicate markers, marker injection in canonical text, edited legacy outputs, exact CRLF/BOM preservation, multiline notes and invalid route options. Original tests remain; JSON-based assertions now explicitly select `--json`.

## Real software workflow, simulated agents

`scripts/validate-workflow.mjs` creates a temporary Git project in a Windows path containing spaces and `ü`. It contains a JavaScript postal-code parser, Node test-runner tests, a README and a review queue. At each stage it implements an actual small code/test/documentation change, runs the fixture's tests, commits completed work, and leaves staged review work plus unstaged README changes. It saves explicit completed work, the next actionable step and a persistent blocker: no carrier sandbox is available, so only offline fixtures may be used.

The validator previews note writes and checks no note changed, saves the note, previews sync, confirms that unapproved existing instructions remain untouched, explicitly approves sync, checks status and verifies all three outputs. It checks private canaries, ignored environment files and sensitive credential paths remain absent. Original team instructions remain exact across all six stages. Fixture commit hooks are disabled. It never invokes an agent CLI.

| Direction | Completed work | Next step | Parser tests passing |
| --- | --- | --- | --- |
| Codex → Claude Code | Reject missing postal codes | Add full-width Unicode fixture and run the parser suite | 2 |
| Claude Code → Gemini CLI | Normalize full-width Unicode | Document input/output examples | 3 |
| Gemini CLI → Codex | Document parser examples | Add internal-whitespace normalization and a UK fixture | 3 |
| Codex → Gemini CLI | Normalize internal whitespace | Reject numeric input explicitly | 4 |
| Gemini CLI → Claude Code | Reject numeric input | Add null/object regressions | 5 |
| Claude Code → Codex | Finish null/object coverage | Review staged review queue and unstaged README notes | 7 |

All six directions passed under **both Node 24.22.1 and Node 22.18.0**. All targets had one well-formed managed section, the correct agent provenance header, the reviewed tasks/blocker and an output smaller than 24 KiB. The default preview displayed Markdown line breaks normally. These are simulations of agent collaboration, not observed model behavior or proof that Claude/Gemini loaded the files.

Replay with `pnpm build` then `pnpm validate:workflow`. The command prints the retained temporary project and `.cache/workflow-evidence-*` artifact paths. [Durable samples](../examples/workflow/README.md) include observed before/after instruction files and handoffs; the complete local evidence contains all six previews, fixture test output, notes and generated files.

## Before/after examples

Before, an approved sync produced a full generated file without the original team rule. A default preview rendered the note inside a string resembling `"## Next steps\n\n- Add Unicode fixture"`.

After, the beginning of the Claude output retains the user's team section and adds reviewed context inside a marked section:

```markdown
# Team instructions

Keep the public API stable.

<!-- agentbridge:begin -->
... reviewed shared project context ...
# Latest session handoff

From: Codex
To: Claude Code

## Completed
- Reject missing postal codes; 2 parser tests passed

## Next steps
- Add full-width Unicode fixture; run node --test test/parser.test.mjs

## Blockers
- Carrier test sandbox unavailable; use offline fixtures only
... filtered Git facts ...
<!-- agentbridge:end -->
```

The excerpt omits unchanged context and blank lines; [after-CLAUDE.md](../examples/workflow/after-CLAUDE.md) is the complete captured output. [before-CLAUDE.md](../examples/workflow/before-CLAUDE.md) records the original loss. These files are synthetic, not recovered chat histories.

## Actual agent validation, separately measured

| Agent | Availability checked | Actual loading result |
| --- | --- | --- |
| Codex CLI | Installed: `codex-cli 0.165.0-alpha.1.2` | **Verified offline** using its actual `debug prompt-input` command against the final reverse-handoff fixture. |
| Claude Code | Not found on PATH or the checked standard npm/native install locations | Not run; generated-file format and preservation tested by simulation only. |
| Gemini CLI | Not found on PATH or the checked standard npm install locations | Not run; generated-file format tested by simulation only. |

The Codex probe used a newly created `CODEX_HOME`, no existing credentials/configuration, and removed credential-bearing environment variables and inherited Codex overrides from its child environment. Update checks/analytics/feedback were disabled in its isolated config. The only configured model provider was a local HTTP endpoint that rejected requests. Its request counter stayed at **zero**. No inference turn was started, and no user account was used.

The real CLI's rendered prompt included the exact offline project purpose, public-API constraint, saved handoff and latest reverse-direction next step; the private canary was absent. This demonstrates actual Codex instruction loading, **not model compliance or quality**. `scripts/validate-codex.mjs` reproduces this optional developer check for a supplied synthetic project with an already installed compatible Codex binary. It is not invoked by AgentBridge or CI.

Official format references: [Codex project guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Claude Code memory](https://code.claude.com/docs/en/memory), [Gemini CLI context](https://geminicli.com/docs/cli/gemini-md/). The installed Codex's own `debug prompt-input --help` establishes the local inspection capability; availability may differ in other versions.

## Quality results

| Check | Observed result |
| --- | --- |
| Full suite on Windows / Node 24.22.1 | **35 passed, 0 failed, 0 skipped**; includes all original 26 tests |
| Full suite on Windows / Node 22.18.0 | **35 passed, 0 failed, 0 skipped** |
| Typechecking | Passed on Node 22 and 24 |
| Build | Passed |
| Six-direction workflow | Passed on Node 22 and 24; final fixture suite 7/7 in each |
| Frozen dependency installation | Passed, lifecycle scripts disabled |
| Dependency advisory audit | Zero known advisories across the unchanged 3 development packages at review time |
| Runtime dependencies | Zero third-party npm packages; no new package dependencies |
| GitHub Actions | Configured for Windows/macOS/Linux × Node 22.18/24; tests plus the simulated end-to-end workflow; no hosted run yet |

Node 22.18.0 was downloaded from the official Node.js distribution into ignored `.cache/node22` and verified against its published SHA-256 before execution: `c95d8a7e1c99e669cc08c9f1176e068c1f50847c37908fcb8c35b62482366511` for `node-v22.18.0-win-x64.zip`. It is a local validation prerequisite, not bundled AgentBridge source or a runtime dependency.

## Remaining limitations and repository readiness

Existing user rules are preserved, but natural-language contradictions between those rules and canonical guidance still need human review. Edits inside managed sections require approval to replace; malformed markers and edited unmarked legacy output require manual repair. No history import, semantic merge, automatic stale-note detection or scope-aware global/nested-agent audit is provided. Snapshots remain historical. Secret recognition is heuristic. The final file check/rename race and lack of a multi-file filesystem transaction remain documented.

Claude/Gemini real loading and model behavior are untested. Linux/macOS are prepared in CI but have not run. The switch to readable default sync/status output requires existing scripts to add `--json`.

**Engineering assessment:** ready to open a first public **experimental** source repository with these limits prominently documented, after the maintainer confirms MIT ownership/attribution and a private vulnerability-reporting contact. It is not a stable-release or fully cross-platform validation claim. No repository or release was created; those actions still require the user's explicit approval.
