# AgentBridge v0.2.0 — Codex Handoff Preview

Experimental prerelease candidate. Publication is conditional on reviewed source,
successful CI, exact asset audit and real signature verification. These candidate
notes do not announce availability or claim an attestation has been generated.

AgentBridge now includes a Codex skill for a shorter handoff: select
`$agentbridge-handoff to Claude Code` (or Gemini CLI), review the proposed summary
and file changes, then explicitly approve. The skill drafts from the active session
and filtered Git facts. No chat-history ingestion, API keys or new inference service
is introduced. The host agent retains its own account and privacy requirements.

## Install and use

Once the approved prerelease is available, download `agentbridge-0.2.0.tgz`, its
checksum and manifest. Verify the archive and both attestations using the exact
source/signer SHA and workflow in the final release evidence. Use the precompiled
asset, not GitHub's automatic source-code archive.

```sh
npm install --global --offline --ignore-scripts --no-audit --no-fund ./agentbridge-0.2.0.tgz
agentbridge install-skill
```

Requires Node 22.18+ or 24 with npm, Git for progress facts, a writable npm prefix
on PATH, and Codex for agent-assisted drafting. Use `agentbridge.cmd` when PowerShell
blocks the generated script. In the project's Codex session select the skill with
`$agentbridge-handoff to Claude Code` or `/skills`. Bare `/handoff` is not a Codex
command provided by AgentBridge. Existing differing personal skills are never
overwritten; review such a file before upgrading it. Restart the host if a newly
installed skill is not listed.

The CLI detects the Git root, preserves existing canonical context, previews without
writes and saves only with the exact preview's approval digest. Existing user
instruction sections are preserved; replaced notes/instructions are backed up.
Legacy manual commands continue to work offline. This installs a downloaded
GitHub archive, not a registry package named agentbridge. No npm registry
publication or namespace ownership is claimed.

## Verification and limitations

The final release evidence must record the actual source commit, archive and
manifest SHA-256, complete package inventory, workflow URL and both verified
attestation IDs. The v2 source predicate binds all three exact assets and the full
manifest; standard SLSA provenance binds them to the reviewed workflow/source.
Attestations establish origin and integrity, not freedom from vulnerabilities.

A synthetic project in the desktop chat exercised a real human approval, saving,
instruction synchronization and preservation. Codex CLI/personal skill discovery
was checked without inference, and the desktop session listed the installed skill.
Starting through the desktop picker, other interactive scenarios and **real Claude
Code/Gemini CLI instruction loading remain unverified**. No universal model
compliance claim is made. Receiving agents require separate installation/accounts.

Approval digests prevent stale/accidental application but do not prove human
consent; the skill must wait for the user. Git status is not a source-content hash
or proof of passing tests. Notes may be inaccurate or stale. Secret detection is
heuristic; review before sharing. The richer preview rejects implicit imports and
recognizable credentials in existing instructions. Multi-file transactions,
hostile concurrent writers and Windows ACL management remain outside guarantees.

Original AgentBridge code is MIT; Node/npm/Git and external agents retain their
own licenses. AgentBridge is independent of OpenAI, Anthropic and Google.
Report vulnerabilities through [private reporting](https://github.com/doksanbes/agentbridge/security/advisories/new).

Exactly three proposed assets: `agentbridge-0.2.0.tgz`,
`agentbridge-0.2.0.tgz.sha256`, `agentbridge-0.2.0.tgz.manifest.json`.
The immutable v0.1.0 release and its signatures remain unchanged.
