# Security policy

AgentBridge 0.x is experimental. Security fixes are considered for the current experimental main branch; no stable-release support window or response SLA is promised. It processes explicitly selected project context and local Git metadata; the product CLI does not contact services or load agent transcripts. Claude Code and Gemini CLI instruction loading remain unverified.

## Boundaries

- Legacy sync instruction replacements require explicit filename approval. The v0.2.0 session flow requires approval of a digest binding the exact preview, named replacements, project root and visible Git facts. State files never authorize replacement. Backups preserve overwritten UTF-8 text and prior session notes.
- Ignored paths, built-in sensitive filenames and `.agentbridgeignore` exclusions are removed before inventory/progress output. No source-file contents, patches, commit messages or authors are collected.
- Symlinks/junctions in input/output paths and hard-linked context files are rejected. Inputs are bounded and must be valid UTF-8.
- Credential-pattern detection and `@file` blocking reduce accidental propagation. They cannot recognize every secret, private statement or indirect instruction.
- Existing instruction files are inspected for change detection, same-file preservation of user sections, and backups. They are never imported into other targets. Existing imports outside the managed section remain unchanged and are never followed by AgentBridge. Backups may contain sensitive text and should be excluded from version control and protected with local permissions.
- Managed sections require unique standalone markers. Damaged boundaries or edited legacy outputs stop for manual repair. Marker declarations inside canonical context or handoff notes are refused.
- Sensitive-path exclusions include common auth/service-account files, private-key formats, kubeconfig and Terraform state/variable files. Patterns remain heuristic; filename variation can evade them.
- The Codex skill must show the proposed summary and file changes and wait for a separate human approval. A digest prevents accidental/stale application; it cannot prove a human consented or prevent an agent from computing approval itself. Skill compliance and model behavior are not enforced by this CLI. The host agent can see the returned local context under its own privacy settings. No inference service or transcript access is added.
- Session previews refuse credential-like existing text and implicit imports. Git facts contain filtered paths/status, not file-content hashes; a token does not certify that all source bytes or test outcomes remain current. Reverify facts before acting.

Use trusted Node and Git binaries on PATH and a trusted local filesystem. Do not run apply concurrently with untrusted processes. Filesystem-wide transactions, adversarial concurrent mutation protection and Windows ACL management are not provided. No automatic cleanup deletes backups or context. Review saved notes before sharing or committing them.

## Reporting

The maintainer account is `doksanbes`. Use [GitHub private vulnerability reporting](https://github.com/doksanbes/agentbridge/security/advisories/new). Select **Report a vulnerability** from the repository's Security/Advisories page. This sends a private report to repository maintainers, not a public issue.

Private vulnerability reporting was verified enabled on October 29, 2026. If it becomes unavailable, use the fallback below. Distribution preparation does not itself publish a package or release.

If the form is unavailable, request a private contact from the maintainer without including vulnerability details. A public issue may contain only that contact request. Do not post secrets, exploit details, private paths or real user data publicly. No unverified email address is provided here.

In the private report, include the version/commit, operating system, Node/Git versions, expected and observed behavior, a minimal synthetic reproduction, and impact. Report only dummy data; redact paths and credentials. If a real credential was exposed, revoke it through its issuing service rather than posting it in the report.

The maintainer should acknowledge reports within seven days and provide a triage/status update within thirty days where possible; these are best-effort targets, not guarantees. Keep reproduction, remediation and coordination in the private advisory until a fix or mitigation and a mutually agreed disclosure plan are ready. Do not promise a fixed remediation deadline before triage. Ask the reporter whether they want public credit before naming them.

See [architecture](https://github.com/doksanbes/agentbridge/blob/main/docs/ARCHITECTURE.md) for detailed trust boundaries and recovery behavior. See [GitHub's setup documentation](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) for enabling private reporting and notifications.
