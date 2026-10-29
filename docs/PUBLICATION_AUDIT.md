# First experimental source-publication audit

Prepared October 29, 2026 for **doksanbes/agentbridge**, public, MIT, experimental. This concerns the exact source manifest, not a package or binary release. No publication action is authorized by this report.

## Audit conclusion

**Source preparation: YES, suitable for an experimental public repository subject to the owner's publication approval and the execution preconditions in the publication plan.** No known material ownership, licensing, credential-disclosure or security defect was identified in the reviewed source set. This is a review of available provenance and files, not certification of rights against all possible outside claims.

Before execution, the owner must confirm publication authority/author identity, authorize public creation and the initial upload, perform an owner-authenticated repository-name check, and enable/verify private reporting before uploading code. These are not yet performed. If any contrary ownership evidence, credential finding or security blocker appears, stop rather than proceeding with publication.

## Provenance and license scope

All proposed AgentBridge source, tests, scripts, original documents and synthetic examples were newly written in the recorded development work with AI assistance. Public competitor documentation informed the problem/format research; no competitor implementation or assets were incorporated. There is no imported project history in this checkout and no root Git repository has been initialized. The generic “AgentBridge contributors” copyright notice has not been replaced with an invented legal name.

MIT is assigned to that original work. It does not apply to third-party packages, tools, assets or marks. [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) distinguishes the original work from separate dependencies, and [PROVENANCE.md](PROVENANCE.md) preserves the development record. No third-party code, compiler runtime helpers, executable, logo or vendored package was found in the publication set.

The frozen development dependency set remains TypeScript 5.9.3 (Apache-2.0), `@types/node` 22.19.0 (MIT) and `undici-types` 6.21.0 (MIT). Installed license files and TypeScript's own third-party notices were inspected. Those installed packages and notices are not being redistributed in this source publication. The compiled CLI imports only Node built-ins and local project modules; it has zero runtime npm dependencies. Downloaded Node/Git/pnpm/Codex tools retain their own licenses and are not included. The package stays `private: true` to prevent accidental npm publication.

## Exact publication boundary and private-data review

[publication-files.txt](../publication-files.txt) lists every approved path. Only that list should be staged. [audit-publication.mjs](../scripts/audit-publication.mjs) verifies the list, rejects linked/binary/private inputs, detects unlisted source files, and emits per-file SHA-256 hashes without printing credential values. Its checks are read-only and do not open caches, private local context, dependencies or unlisted files for content scanning.

Reviewed contents include CLI code, tests, development validators, documentation, build configuration, the CI workflow and explicitly approved synthetic documentation samples. The examples contain only fictional ParcelKit guidance and disposable Git IDs. Generated documentation samples are intentionally included; generated executables, caches, runtime archives, dependency installations and test logs are excluded.

Credential/private-information scanning found only three expected pattern findings in regression fixtures: a dummy private-key header with no key material, a conventional dummy password in the same test line, and an explicitly fake password in a note-repair test. Those fixtures test rejection and are not real credentials. The scanner allows only those exact reviewed fixtures in their specific test files. No private home-directory path, personal workstation identity, provider token, real key material, chat history or customer data was found. No original private-history files were inspected or recovered.

Excluded from publication: `.cache/` (including isolated Codex diagnostics, tool binaries, zip archives, local audit evidence and retained workflow output), `node_modules/`, `dist/`, `coverage/`, `.agentbridge/` local state/notes/backups, and all unlisted files. Secret/key/environment patterns were also added to `.gitignore` as defense against accidental staging. The exact manifest is the primary upload boundary; `.gitignore` alone is not a secret audit.

## Security and unsupported capabilities

[SECURITY.md](../SECURITY.md) now proposes GitHub private vulnerability reporting to the `doksanbes` maintainer account, explains that the form is inactive before setup, provides safe fallback contact-request guidance, and defines best-effort acknowledgment/triage and coordinated disclosure. The plan enables and verifies the feature on an approved empty repository before the first push. No unverified email address or active-reporting claim was added.

README and contribution guidance prominently state that the project is experimental; **Claude Code and Gemini CLI actual instruction loading are unverified**. Offline Codex prompt inspection establishes loading only, not model behavior. Windows testing does not imply observed Linux/macOS success. Semantic conflict handling, secret heuristics, historical notes, local-process race limits and non-transactional multi-file updates remain documented. No paid AI/API requirement or account-based runtime integration is claimed.

## Repository check and proposed commit

The connected GitHub API returned 404 for `doksanbes/agentbridge`; an owner-scoped repository search returned no match. No public repository was found. An inaccessible private repository cannot be ruled out by these checks. GitHub CLI is not on the current PATH. An owner-authorized check and adequate permissions are prerequisites, not inferred approvals.

Proposed commit: **Initial experimental AgentBridge CLI**. Full text is in [INITIAL_COMMIT_MESSAGE.txt](INITIAL_COMMIT_MESSAGE.txt). The [publication plan](PUBLICATION_PLAN.md) contains the exact PowerShell/GitHub CLI commands, separated into read-only verification, approved local preparation, approved creation/security setup, and separately approved push.

## Verification record

The product was previously validated with all 35 tests passing on both Node 22.18.0 and 24.22.1, six simulated handoff directions on each runtime, and actual offline Codex prompt loading with zero inference requests. See [USABILITY_VALIDATION.md](USABILITY_VALIDATION.md).

This publication pass copied the exact **47-file** source set into a new source-only directory. The frozen installation with lifecycle scripts disabled passed, followed by typechecking and build. The complete suite passed **35/35 on Node 22.18.0** and **35/35 on Node 24.22.1** from that clean tree. The synthetic workflow passed all six directions with zero agent invocations. The fresh dependency audit returned zero known advisories across the same three development packages.

The publication-content scan passed with zero unreviewed findings and three explicitly reviewed dummy-fixture pattern findings. All local documentation links and source whitespace checks passed. A source-import review found only Node built-ins and project-relative modules in the product. The final documentation-only updates were synchronized into the clean tree and audited again; they do not change the tested product or dependencies.

The final local evidence and per-file hashes are retained under excluded `.cache/`; no build outputs or test logs belong in the first commit. The configured GitHub Actions matrix is Windows/macOS/Linux × Node 22.18/24 and includes the full suite and synthetic workflow. It has not run on GitHub, and publication readiness is not a claim that hosted CI passed.

No root repository, initial commit, remote repository, push, tag, release, package publication or deployment has been created by this preparation.
