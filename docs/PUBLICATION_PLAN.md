# Proposed first public repository

Prepared October 29, 2026. **This is a plan, not an authorization to execute it.** No repository initialization, commit, GitHub creation, push, package publication, tag or deployment has been performed for AgentBridge.

- Owner/repository: `doksanbes/agentbridge`
- Visibility: public
- License: MIT for original AgentBridge work; external components retain their licenses
- Status: experimental, unreleased
- Description: `Experimental local-first CLI for reviewed project-context handoffs between Codex, Claude Code, and Gemini CLI. No AI APIs required.`
- Proposed initial commit: `Initial experimental AgentBridge CLI`
- Exact commit message: [INITIAL_COMMIT_MESSAGE.txt](INITIAL_COMMIT_MESSAGE.txt)
- Exact source set: [publication-files.txt](../publication-files.txt)
- Audit and evidence: [PUBLICATION_AUDIT.md](PUBLICATION_AUDIT.md)

## Read-only existence check already performed

The connected GitHub API returned **404 Not Found** for `GET /repos/doksanbes/agentbridge`; a repository search scoped to `doksanbes` returned no match. No public repository was found. GitHub can also return 404 for an inaccessible private repository, so this is not proof that the name is available to the owner. No creation attempt was made. GitHub CLI was not found on the current PATH; it must be installed and authenticated by the owner before using the commands below. No token values should be put in source files or command files.

## Required approvals and preconditions

Before proceeding, obtain explicit approval to publish the reviewed source set under MIT and to create the public repository, enable private reporting, and upload the initial commit. Confirm the publisher has authority to distribute the original work and has reviewed the chosen Git author identity. The available development history shows newly written AI-assisted code, not a rights assignment from unidentified outside contributors; no conflicting third-party ownership was found.

Authenticate GitHub CLI as `doksanbes` with permissions to create a repository and administer private vulnerability reporting. Use the account's normal browser authentication; do not print or record tokens. Review the staged author email before committing. No email address has been invented or copied from the workstation for this plan.

These commands are for **PowerShell**, run one block at a time. Check each command succeeds; stop on any error. Read-only checks may run before publication approval. All other blocks remain unexecuted until approval.

### 1. Confirm the authenticated owner and repository state (read-only)

```powershell
Set-Location -LiteralPath 'D:\agentbridge'
gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'Authenticate GitHub CLI before proceeding.' }
$publicationLogin = gh api user --jq '.login'
if ($LASTEXITCODE -ne 0 -or $publicationLogin -ne 'doksanbes') { throw 'Expected the authorized doksanbes account.' }
gh api --include repos/doksanbes/agentbridge
```

If the repository exists, stop and review its ownership, visibility and contents; do not create, overwrite, delete or push to it automatically. Proceed with creation only after a **404 is confirmed using an owner-authorized token with adequate visibility**. Authentication errors, rate limits, network failures or permission uncertainty are not evidence that the repository is absent.

### 2. Prepare and inspect the exact local initial commit (only after approval)

The source checkout currently has no `.git` directory. Do not initialize over an existing repository. The manifest intentionally excludes all local caches, runtimes, dependencies, compiled output and unreviewed context.

```powershell
if (Test-Path -LiteralPath '.git') { throw 'Existing local repository: review before proceeding.' }
node scripts/audit-publication.mjs
if ($LASTEXITCODE -ne 0) { throw 'Publication audit failed.' }
git init --initial-branch=main
if ($LASTEXITCODE -ne 0) { throw 'Git initialization failed.' }
git --literal-pathspecs add --pathspec-from-file=publication-files.txt
if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged whitespace check failed.' }
$publicationExpected = @(Get-Content -LiteralPath 'publication-files.txt' | Sort-Object)
$publicationStaged = @(git diff --cached --name-only | Sort-Object)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged paths.' }
if (Compare-Object $publicationExpected $publicationStaged) { throw 'Staged paths differ from the approved manifest.' }
git diff --cached --stat
git diff --cached
# Review the complete staged diff and your configured Git author identity locally.
# Only after that review:
git -c core.hooksPath=.git/agentbridge-no-hooks commit --file=docs/INITIAL_COMMIT_MESSAGE.txt
if ($LASTEXITCODE -ne 0) { throw 'Initial commit failed.' }
```

Commit signing and author identity remain the owner's configuration. No identity is silently configured. Keep the local audit JSON/hashes for comparison; changes to the manifest or file contents require another review.

### 3. Create the approved empty public repository (only after approval)

```powershell
gh repo create doksanbes/agentbridge --public --disable-wiki --description 'Experimental local-first CLI for reviewed project-context handoffs between Codex, Claude Code, and Gemini CLI. No AI APIs required.'
if ($LASTEXITCODE -ne 0) { throw 'Repository creation failed; do not continue.' }
```

The empty repository receives no generated README, `.gitignore` or license commit. The reviewed local files supply those. There is deliberately no `--push` flag; private reporting is configured before any code upload. Source: [GitHub CLI creation manual](https://cli.github.com/manual/gh_repo_create).

### 4. Enable and verify private vulnerability reporting (only after approval)

```powershell
gh api --method PUT repos/doksanbes/agentbridge/private-vulnerability-reporting
if ($LASTEXITCODE -ne 0) { throw 'Private reporting could not be enabled. Do not upload code.' }
$publicationPrivateReports = gh api repos/doksanbes/agentbridge/private-vulnerability-reporting --jq '.enabled'
if ($LASTEXITCODE -ne 0 -or $publicationPrivateReports -ne 'true') { throw 'Private reporting is not confirmed enabled.' }
```

The owner must also subscribe to repository security notifications and monitor private advisories. Verify the reporting form is available; a test report with real vulnerability details is unnecessary. If private reporting cannot be enabled, stop and choose a verified private contact before uploading code. Source: [GitHub repository security REST endpoints](https://docs.github.com/en/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository), [private reporting and notifications setup](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

### 5. Upload only the reviewed initial branch (requires explicit push approval)

```powershell
git remote add origin https://github.com/doksanbes/agentbridge.git
if ($LASTEXITCODE -ne 0) { throw 'Remote setup failed; inspect existing remotes.' }
git push --set-upstream origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed; do not force-push.' }
gh repo view doksanbes/agentbridge --json nameWithOwner,visibility,licenseInfo,url
gh run list --repo doksanbes/agentbridge --limit 6
```

Inspect GitHub's MIT detection and actual CI results after the approved upload. CI currently grants read-only repository access and only builds/tests/validates fixtures. No packages, tags, releases or deployments are authorized by this plan. Claude Code and Gemini CLI loading remain explicitly unverified; an initial public repository does not change that validation status.
