# Provenance and dependency review

Zero-build preparation, October 29, 2026: packaging scripts, synthetic package tests and consumer/distribution documentation are original AI-assisted project work. No dependencies or competitor implementations were added. The source manifest grows from 50 to 56 files. The separate 13-file archive contains compiled original ES2022 code and notices only; inspected imports use Node built-ins/local modules and no compiler helpers are emitted. Development packages and runtimes are not redistributed. Both manifests remain private and publication is unapproved; see [distribution review](DISTRIBUTION.md).

Local MVP review: October 29, 2026. This is an engineering inventory, not a legal opinion or a guarantee of originality. The repository is prepared under MIT, with release pending maintainer approval.

First source-publication preparation for `doksanbes/agentbridge` is recorded in [PUBLICATION_AUDIT.md](PUBLICATION_AUDIT.md). The exact manifest excludes installed dependencies, compiled output, downloaded tools and local evidence. [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) explicitly limits MIT to original project work and inventories external licenses. No external implementation or assets were added during publication preparation.

Doctor milestone review, October 29, 2026: the new diagnostics module, synthetic regression tests and product review are original AI-assisted project work under the existing MIT scope. Public documentation informed the candidate assessment; no competitor implementation was incorporated. No dependencies or third-party notices changed. The source manifest explicitly adds these three files, increasing the audited source set from 47 to 50; generated builds and local evidence remain excluded.

Usability follow-up review on the same date: no third-party code or npm packages were added. Managed-section handling, note formatting, regression tests and development validators were newly written for AgentBridge. Node 22.18.0 was downloaded from the official distribution and checksum-verified only for local tests; its files remain under ignored `.cache/` and are not included in package output. The optional Codex validator invokes an existing executable through its local debug interface; it does not redistribute Codex or call a paid service.

## Project provenance

Implementation, tests, example content and project documentation were newly written for this project with AI assistance. Competitive research used public official documentation and project READMEs to establish capabilities. No competitor implementation, asset, logo, package source, or documentation passage was copied into AgentBridge. The example project and all test repositories are synthetic. Agent names are compatibility references; no affiliation is claimed.

The standard MIT license is used for AgentBridge's own code. The generic copyright holder is “AgentBridge contributors”; the maintainer should confirm project ownership and contributor rights before any public release. Package metadata remains `private: true` to prevent accidental npm publication. Package-name availability, trademark clearance, and public security contact setup have not been performed.

## Dependency inventory

Versions and licenses were inspected in the installed package manifests and lockfile. The lockfile pins registry integrity hashes. Development installation was run with lifecycle scripts disabled.

| Component | Version | License | Role / distribution |
| --- | --- | --- | --- |
| TypeScript | 5.9.3 | Apache-2.0 | Development compiler only; not bundled in compiled CLI |
| `@types/node` | 22.19.0 | MIT | Development types only |
| `undici-types` | 6.21.0 | MIT | Transitive development types from `@types/node` |
| Node.js | 22.18+ required; 22.18.0 and 24.22.1 tested locally | Separate upstream distribution/not bundled | Runtime prerequisite |
| Git | 2.53.0.windows.3 tested locally | Separate upstream distribution/not bundled | Optional metadata prerequisite |
| pnpm | 11.25.0 | Separate upstream distribution/not bundled | Development/build prerequisite |

There are **zero third-party runtime npm dependencies**. Compiled JavaScript contains AgentBridge code and imports only Node built-ins. The compiler is intentionally pinned to a pure-JavaScript version with a small dependency footprint. This review does not redistribute Node, Git, pnpm or the compiler; they keep their own licenses and notices. If a future release bundles any of them, repeat the review and include the required upstream notices.

Sources for package provenance: [TypeScript](https://github.com/microsoft/TypeScript), [DefinitelyTyped Node definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node), [Undici](https://github.com/nodejs/undici). Installed license files remain in `node_modules/`; no third-party source is vendored.

## CI supply chain

GitHub Actions `checkout` v7.0.1 and `setup-node` v7.1.0 are pinned to full commit IDs verified against their official release/commit pages. The workflow installs pinned pnpm and the frozen development lockfile with scripts disabled, grants read-only repository permission, and does not publish or deploy. These action implementations are externally downloaded by GitHub when CI is run, not incorporated into AgentBridge source.

No vulnerability-free claim is made. A registry advisory audit is a separate point-in-time check; the follow-up review again returned zero known advisories for the same three development packages. See [latest validation](USABILITY_VALIDATION.md) for the actual result. Before release, repeat the dependency/license/advisory review, establish ownership and a security contact, and obtain explicit approval for repository creation or package publication.
