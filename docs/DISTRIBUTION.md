# Zero-build distribution preparation

Experimental and unpublished: this milestone builds/tests a local archive. It does not create a release/tag, upload an asset, publish to npm or establish npm namespace ownership.

| Approach | Value | Maintenance/security | Decision |
| --- | --- | --- | --- |
| npm registry / npx | Short install/invocation with Node/npm. | Requires namespace ownership, approved publication, version/provenance policy. Colliding names can install unrelated software. | Future channel only. |
| Prebuilt npm-format `.tgz` | Install a reviewed archive without a checkout, pnpm or compiler; npm supplies command shims. | One platform-independent artifact; no bundled runtime/dependencies or custom installer. Exact inventory and offline installation are testable. Authenticity needs a trusted approved channel. | **Selected**; same format can support later approved registry distribution. |
| Plain zip/tar or native binaries | Extract plus node works; binaries could remove Node requirements. | Plain archives need PATH setup; binaries add platform builds, runtime licensing, signing and security updates. | Defer. |

Primary references: [npm tarball installation](https://docs.npmjs.com/cli/v11/commands/npm-install/), [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/), [files/bin/private metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), [lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/). No third-party implementation was copied.

## Intended installation

After obtaining an approved archive and checking its SHA-256 against a trusted value, run from its directory:

```sh
npm install --global --offline --ignore-scripts --no-audit --no-fund ./agentbridge-0.1.0.tgz
agentbridge --help
```

Requires Node 22.18+ or 24 with npm, a writable prefix and its executable directory on PATH. Git enables Git facts. Use `agentbridge.cmd` if PowerShell policy blocks scripts. npm supports `--prefix <writable-directory>`; do not elevate solely to install. See the self-contained [consumer guide](PACKAGE_README.md).

No approved public download or registry command exists yet. The candidate name/version is not a release. Namespace ownership is unverified: do not install an unrelated registry package named `agentbridge`. npx-style execution is tested through `npm exec` with the **local archive**, not a registry identifier.

## Maintainer build

After the frozen development dependency installation, run `pnpm typecheck`, `pnpm build`, `pnpm test`, `node scripts/audit-publication.mjs`, `pnpm package:build`, and `pnpm validate:package`. Only maintainers build TypeScript. A nonstandard Node installation can set `AGENTBRIDGE_NPM_CLI` to its trusted `npm-cli.js`; no npm download is performed by packaging.

Output is ignored `.cache/packages/agentbridge-0.1.0.tgz`, plus `.sha256` and `.manifest.json` sidecars. Use the supported `package:build` command rather than direct `npm pack` in a dirty checkout. Staging copies explicit regular inputs, rejects links/hard links, checks the static import set/shebang, strips scripts/development metadata and retains `private: true`. A new staging directory is required; extra `dist/` files are not copied. Root `files` is narrowed as defense in depth.

Exactly **13 files** are installed: `package.json`, consumer `README.md` (from `docs/PACKAGE_README.md`), `LICENSE`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and `dist/{cli,context,doctor,git,handoff,managed,safety,sync}.js`.

No TypeScript, declarations, compiler helpers, dependencies, pnpm metadata, lifecycle/build scripts, tests, examples, fixtures, chats, caches, Git data or local context are shipped. Node/npm/Git and development tools are not redistributed. Existing runtime code, exclusions and named overwrite approvals are unchanged.

## Reproducibility and tests

LF output and normalized metadata stabilize the package. Two packs of the same staging tree with the selected npm must have identical SHA-256 values. Record source commit, clean-source audit, Node/npm versions and per-file hashes for approved distribution. Repeatability is tested for the same inputs/toolchain; byte identity across different npm releases is not promised. Checksums detect differences, not origin. Trusted filesystem/toolchain assumptions still apply.

`validate:package` copies only the archive to a fresh temporary consumer directory with spaces/Unicode, fresh home/config, empty caches and isolated prefix. It installs offline with scripts disabled, verifies exact installed inventory and every file hash, invokes the actual Windows cmd/POSIX shim, and tests local-archive npm exec using a second empty cache. Child PATH needs only Node, Git and OS commands. A rejecting loopback registry must observe zero requests.

The installed CLI exercises init, filtered discovery with force-tracked ignored input, manual handoff, no-write preview, refusal without named approval, CRLF preservation, all outputs, status, doctor and blocked conflicts. Only synthetic data is used. Temporary consumer files are removed; reports stay in `.cache/`. CI runs this on Windows/macOS/Linux × Node 22.18/24 alongside tests/build/typecheck/source audit. There is no artifact upload or publishing step.

Actual Claude/Gemini loading and model behavior remain unverified. Final version/name, ownership, trusted distribution, signing/provenance policy and publication approval remain separate decisions.
