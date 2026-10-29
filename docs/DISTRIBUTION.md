# Experimental GitHub archive distribution

This guide describes the experimental v0.1.0 archive intended for GitHub prerelease distribution. Check [GitHub Releases](https://github.com/doksanbes/agentbridge/releases) for the maintainer-published prerelease and its precompiled `agentbridge-0.1.0.tgz` asset. If the asset is not listed, it is not available through this channel. These instructions do not announce publication. Creating tags/releases, uploading assets and publishing to npm require separate approval; npm namespace ownership is not implied.

| Approach | Value | Maintenance/security | Decision |
| --- | --- | --- | --- |
| npm registry / npx | Short install/invocation with Node/npm. | Requires namespace ownership, approved publication, version/provenance policy. Colliding names can install unrelated software. | Future channel only. |
| Prebuilt npm-format `.tgz` | Install a reviewed archive without a checkout, pnpm or compiler; npm supplies command shims. | One platform-independent artifact; no bundled runtime/dependencies or custom installer. Exact inventory and offline installation are testable. Authenticity needs a trusted approved channel. | **Selected**; same format can support later approved registry distribution. |
| Plain zip/tar or native binaries | Extract plus node works; binaries could remove Node requirements. | Plain archives need PATH setup; binaries add platform builds, runtime licensing, signing and security updates. | Defer. |

Primary references: [npm tarball installation](https://docs.npmjs.com/cli/v11/commands/npm-install/), [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/), [files/bin/private metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), [lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/). No third-party implementation was copied.

## Install a verified GitHub archive

When the maintainer-published asset is available, obtain the precompiled `.tgz` rather than GitHub's automatic source-code archives. After checking its SHA-256 against a trusted value, run from its directory:

```sh
npm install --global --offline --ignore-scripts --no-audit --no-fund ./agentbridge-0.1.0.tgz
agentbridge --help
```

Requires Node 22.18+ or 24 with npm, a writable prefix and its executable directory on PATH. Git enables Git facts. Use `agentbridge.cmd` if PowerShell policy blocks scripts. npm supports `--prefix <writable-directory>`; do not elevate solely to install. See the self-contained [consumer guide](PACKAGE_README.md).

Installing a downloaded GitHub archive with npm is separate from npm registry installation. Verify namespace ownership and obtain separate approval before any registry publication; do not substitute an unrelated registry package named `agentbridge`. npx-style execution is tested through `npm exec` with the **local archive**, not a registry identifier. Release availability is determined by the published prerelease asset, not by this guide.

## Maintainer build

After the frozen development dependency installation, run `pnpm typecheck`, `pnpm build`, `pnpm test`, `node scripts/audit-publication.mjs`, `pnpm package:build`, and `pnpm validate:package`. Only maintainers build TypeScript. A nonstandard Node installation can set `AGENTBRIDGE_NPM_CLI` to its trusted `npm-cli.js`; no npm download is performed by packaging.

Output is ignored `.cache/packages/agentbridge-0.1.0.tgz`, plus `.sha256` and `.manifest.json` sidecars. Use the supported `package:build` command rather than direct `npm pack` in a dirty checkout. Staging copies explicit regular inputs, rejects links/hard links, checks the static import set/shebang, strips scripts/development metadata and retains `private: true`. A new staging directory is required; extra `dist/` files are not copied. Root `files` is narrowed as defense in depth.

The unreleased candidate installs **15 files** (published v0.1.0 remains 13): `package.json`, consumer `README.md` (from `docs/PACKAGE_README.md`), `LICENSE`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and `dist/{cli,codex,context,doctor,git,handoff,managed,safety,session,sync}.js`.

No TypeScript, declarations, compiler helpers, dependencies, pnpm metadata, lifecycle/build scripts, tests, examples, fixtures, chats, caches, Git data or local context are shipped. Node/npm/Git and development tools are not redistributed. Exclusions and legacy named overwrite approvals remain in effect; the unreleased session flow adds digest-bound approval for an entire reviewed proposal.

## Reproducibility and tests

Staged files use normalized 0644 permissions, independent of host execute bits and umask. npm uses the manifest's bin entry to make the installed command executable; the validator exercises its real shims. An initial comparison found identical payloads but a CLI execute-bit difference between Windows and POSIX archives; normalization addresses that difference. This does not promise identical archives for every future toolchain.

LF output and normalized metadata stabilize the payload. Two packs of the same staging tree with the selected npm must have identical SHA-256 values. Record source commit, clean-source audit, OS, Node/npm versions and per-file hashes for approved distribution. Repeatability is tested for the same inputs/platform/toolchain; byte identity across operating systems or npm releases is not promised. Reports distinguish the content hash (sorted paths, byte sizes and SHA-256 values) from archive bytes and modes. Select one pinned maintainer build profile, such as Linux with Node 22.18.0/npm 10.9.3, for an approved archive; its package can install on every tested OS. Checksums detect differences, not origin. Trusted filesystem/toolchain assumptions still apply.

`validate:package` copies only the archive to a fresh temporary consumer directory with spaces/Unicode, fresh home/config, empty caches and isolated prefix. It installs offline with scripts disabled, verifies exact installed inventory and every file hash, invokes the actual Windows cmd/POSIX shim, and tests local-archive npm exec using a second empty cache. Child PATH needs only Node, Git and OS commands. A rejecting loopback registry must observe zero requests.

The installed CLI exercises init, filtered discovery with force-tracked ignored input, manual handoff, no-write preview, refusal without named approval, CRLF preservation, all outputs, status, doctor and blocked conflicts. Only synthetic data is used. Temporary consumer files are removed; reports stay in `.cache/`. CI runs this on Windows/macOS/Linux × Node 22.18/24 alongside tests/build/typecheck/source audit. There is no artifact upload or publishing step.

Actual Claude/Gemini loading and model behavior remain unverified. Final version/name, ownership, trusted distribution, signing/provenance policy and publication approval remain separate decisions.
