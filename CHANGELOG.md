# Changelog

## 0.2.0 — prerelease candidate

- Add a Codex handoff skill and stdin-based session preview/apply flow with content-bound approval, automatic Git root detection, preserved context and instruction files, and prior-note backups. No model calls or transcript ingestion.
- Validate synthetic handoffs and installed candidate archives across the six CI platforms; distinguish documented skill support from actual invocation and model behavior.

- Add reusable main-only attestation dispatch with explicit version/source/archive/manifest approval; inspect actual archive contents and bind all three assets under a new source predicate. Preserve immutable v0.1.0 signatures.
- Read CLI/generated-header version from installed package metadata and emit a canonical cross-platform package manifest.

## 0.1.0

- Prepare an unpublished, repeatable 13-file npm-format archive with no runtime dependencies or installation hooks; validate isolated offline installation, command shims and handoff safety on all CI platforms. Keep npm publication disabled.

- Add a clone-to-first-handoff walkthrough, a realistic Codex-to-Claude example, and conflict/recovery guidance; distinguish hosted CI from actual agent-loading checks.
- Explain missing project directories with an actionable CLI error instead of a raw filesystem path.

- Resolve project-root aliases before filesystem containment checks, fixing false path-escape failures on Windows/macOS while retaining descendant-link, hard-link and write protections.

- Preserve existing user instructions outside explicit managed sections, with strict marker validation and conservative migration of legacy generated files.
- Show readable previews/status by default, retain machine-readable output through `--json`, and explain staged/unstaged Git changes.
- Record optional handoff directions through `--from` / `--to`; keep multiline notes structured and allow explicit repair of credential-like old notes.
- Expand sensitive-file exclusions for auth/service-account files, private key formats and Terraform metadata.
- Add repeatable six-direction software-project validation, offline Codex prompt inspection, and Node 22.18 compatibility evidence.

- Initialize an editable canonical Markdown project context.
- Add read-only `doctor` diagnostics for Node/project/Git setup, context, saved notes, sync locks and output drift, with human-readable next steps and versioned JSON. No automatic fixes or agent probes.
- Discover filtered tracked paths without opening source or manifest contents.
- Generate deterministic AGENTS.md, CLAUDE.md and GEMINI.md instructions.
- Show bounded Git progress facts and record explicit manual handoffs.
- Preview synchronization; detect drift and local output edits using SHA-256 baselines.
- Require exact filename approval on every existing instruction replacement and retain backups.
- Exclude sensitive, ignored and custom-excluded paths; reject unsafe links, imports and credential-like input.
- Add synthetic unit/integration tests, cross-platform CI configuration, MIT licensing and provenance review.
