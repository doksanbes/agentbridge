# Version-aware approved release builds

The published immutable v0.1.0 release, tag and existing attestations are historical evidence and remain unchanged. They use source 1aa6cd22ae92dfba99df50f898234f460ccf96d3 and signer cda9ad08ea2a105e70e7cd557b965a2337811056. Verify those historical assets using that pinned signer and the original approved-source/v1 predicate; the new policy deliberately does not reinterpret them.

## Trust and approval boundary

The manual `attested-build.yml` workflow accepts four required, auditable dispatch inputs: `version` (numeric, without v), `source_commit` (full SHA), `archive_sha256` and `manifest_sha256` (full SHA-256 values). No input enters executable shell text. Validation rejects unknown/missing fields, whitespace, alternate refs, version/path injection and malformed hashes.

The job runs only for doksanbes/agentbridge on refs/heads/main. Its exact workflow commit must equal the approved source commit, eliminating the previous source/signer split. Checkout is pinned to github.sha with credentials disabled. An authenticated 404 must prove both release and tag absent; authentication, network and rate-limit failures stop the gate. Inputs cannot select arbitrary source code for a privileged job.

The workflow is not an approval UI. Only an authorized maintainer may dispatch it after reviewing the source, successful main CI, exact archive, canonical manifest and their hashes. Main-branch review/protection and trusted GitHub workflow dispatch access are security assumptions. The source and locked build dependencies execute in a job holding its declared permissions; reviewed trusted code is essential.

## Exact assets and actual package inventory

For version X.Y.Z the only publication assets are:

- agentbridge-X.Y.Z.tgz
- agentbridge-X.Y.Z.tgz.sha256
- agentbridge-X.Y.Z.tgz.manifest.json

`pnpm validate:package` builds twice, requires identical archive digests and verifies a fresh offline installation. Packaging has an explicit source-reviewed allowlist. The release policy independently parses the actual gzip/tar bytes without extraction, checks header checksums, permits regular 0644 files only, and rejects links, duplicate/unsafe/extra paths, oversized entries, extensions, truncation and trailing hidden entries. Every actual file hash and size must match the canonical manifest and the allowlist; no fixed historical file count is accepted as proof.

The candidate currently has 15 files, including dist/codex.js (the embedded handoff skill/installer) and dist/session.js. This count is an audit result, not a version-wide assumption. package.json must match the release version, MIT/private/CLI metadata and contain no dependencies or install hooks. Zero runtime dependencies and offline operation remain required.

The canonical manifest records version, archive digest, actual per-file hashes/sizes, modes and a content-inventory digest. Host OS and Node/npm execution details remain in the build report, rather than changing the public manifest bytes across platforms. The workflow's pinned build profile is Node 22.18.0 with its bundled npm 10.9.3 and pnpm 11.25.0, no restored cache. This is repeatability under a reviewed toolchain, not a proof that every future toolchain produces identical bytes.

## Attestations and verification

Only contents:read, id-token:write and attestations:write are granted to the main-only job. Checkout, setup-node and official actions/attest remain SHA-pinned. Storage records are disabled. There are no contents/packages/artifact-metadata write permissions, artifact uploads, release/tag creation, registry publishing or deployment steps.

The policy rechecks the exact clean source commit and version, archive SHA-256, manifest SHA-256 and checksum bytes before generating a binding. The explicit subject-checksums file contains exactly the three audited assets. Official actions/attest emits standard SLSA provenance and a new custom predicate:

`https://github.com/doksanbes/agentbridge/attestations/approved-source/v2`

The custom predicate binds repository, source commit, version, archive digest, exact manifest digest, complete inventory and all three asset names/digests. It is not interchangeable with historical v1 evidence. All three assets are cryptographically verified against both predicates, the exact signer/source SHA and the exact workflow path. The policy then compares successful gh verifier output against independently re-audited local bytes, rejecting missing/duplicate/extra subjects and mismatched fields. Unit fixtures and unsigned JSON are not cryptographic verification or attestations.

Maintainer procedure (performed by the release operator, not required of end users):

1. Review the infrastructure/version PR, require all six CI jobs and obtain explicit merge approval. Never bypass protection.
2. After merge, verify main CI and record the exact merge/source SHA. Build that clean commit, audit the source and package, verify isolated offline installation and retain the full per-file manifest and all asset hashes. A pre-merge candidate digest/source record is not final release evidence.
3. Record the four dispatch values from those reviewed bytes. Dispatch from main. Require success of both real signature checks and semantic policy checks on every asset. Record the workflow URL, source/signer SHA and attestation IDs. No new attestation exists merely because this PR passes CI.
4. Independently rebuild the same source and run the policy locally. Prepare approval.json containing version/sourceCommit/archiveSha256/manifestSha256. `node scripts/attestation-policy.mjs prepare . <approval.json> <binding.json> <subjects.sha256>` audits local bytes and produces the expected binding/subject list. Use new output paths; existing files are never silently replaced.
5. For each exact asset, run `gh attestation verify <asset> --repo doksanbes/agentbridge --signer-workflow doksanbes/agentbridge/.github/workflows/attested-build.yml --signer-digest <approved-source-sha> --predicate-type https://slsa.dev/provenance/v1`, and then the v2 predicate with `--format json`. Only after gh succeeds run `node scripts/attestation-policy.mjs verify . <approval.json> <verified-source.json>`.
6. Recheck immutability/private vulnerability reporting, publication authorization, exact release notes and tag/release absence. Create a draft prerelease targeted at the exact source; upload only the three approved assets, download/reverify them, then publish with prerelease true and latest false. Never overwrite an existing tag/release or replace immutable assets. Check exact published notes, tag target and assets again after publication; download and verify hashes and both signatures anew.

Merging the present PR requires separate explicit approval. After that gate, the owner has authorized v0.2.0 publication only if all evidence succeeds. No release or tag is created by this workflow or this PR.

References: [pinned attest action](https://github.com/actions/attest/tree/1e69f48acb82d1966a394da916b4c1698aa569d6), [GitHub attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations), [release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes). Original policy/tests are MIT; official actions retain their own licenses and are not packaged.
