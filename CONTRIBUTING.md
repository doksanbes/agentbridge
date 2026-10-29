# Contributing

This is an independent local-first project. Keep the core usable without accounts, model calls, telemetry, paid services, or private transcript ingestion.

Use Node 22.18+ and pnpm 11.25.0:

```sh
npm install --global pnpm@11.25.0 --ignore-scripts
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm build
pnpm test
pnpm validate:workflow
node scripts/audit-publication.mjs
pnpm package:build
pnpm validate:package
```

Tests create disposable synthetic Git repositories in the operating system temporary directory. Git must be on PATH. They never operate on the checkout's Git history or use real agent sessions. Windows link tests use directory junctions, avoiding Developer Mode requirements. Restricted execution environments may need permission for Git fixture writes and atomic file replacements.

The workflow validator retains its temporary project and `.cache/workflow-evidence-*` artifacts for review; it simulates all six handoff directions without invoking agents. Only its synthetic fixture's source/tests are executed. Git commit hooks are disabled in fixture configuration. The optional Codex validator is a separate, explicit developer command that uses a fresh home, removes credential environment variables, and directs any provider traffic to a local rejecting endpoint; it must observe zero inference requests. Do not replace it with an account-backed prompt in automated tests.

Keep modules focused, errors actionable, and outputs deterministic. Add meaningful regression tests for behavior or security boundaries. Test new CLI behavior through a synthetic project, including a no-write preview. Do not add dependencies without recording their source, license, transitive dependencies and runtime necessity in `docs/PROVENANCE.md`; update the lockfile intentionally.

Before proposing a change, explain the developer problem, observable behavior, tests, and limitations. Do not copy competitor implementations or private/proprietary examples. Record attribution and licensing for any incorporated third-party work. Never include real credentials, chat histories or customer repositories in fixtures.

Use the [README source installation](README.md#install-from-source) for a clean checkout. Node 22 (22.18.0+) and 24 are tested locally on Windows and in GitHub Actions on Windows/macOS/Linux. The [post-merge main run](https://github.com/doksanbes/agentbridge/actions/runs/40848570913) passed all six jobs. Claude Code and Gemini CLI loading are unverified; do not describe generated-file simulation as actual agent validation. The optional Codex check verifies loading only, not model behavior.

Security reports go through the private process in [SECURITY.md](SECURITY.md), never ordinary public issues with exploit details. Publication, repository creation, package naming and release signing still require maintainer approval. Do not introduce publishing or deployment steps to CI.

Submit only work you have the right to contribute. Original contributions are provided under this project's MIT license. Clearly identify separately licensed third-party material, preserve its notices, and obtain review before including it; the MIT license does not relicense external work. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the [provenance record](docs/PROVENANCE.md).
