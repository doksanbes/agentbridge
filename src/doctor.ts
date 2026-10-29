import { lstat } from 'node:fs/promises';
import { CONTEXT, HANDOFF } from './context.js';
import { ProjectGit } from './git.js';
import { projectRoot, readText, safePath } from './safety.js';
import { planSync } from './sync.js';

export interface Diagnostic {
  code: string;
  severity: 'ok' | 'warning' | 'error';
  message: string;
  hint?: string;
}
export interface DoctorReport {
  version: 1;
  checks: Diagnostic[];
  summary: { errors: number; warnings: number };
}

export function checkNodeVersion(version: string): Diagnostic {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  if (major < 22 || major === 22 && minor < 18) {
    return { code: 'node-unsupported', severity: 'error', message: 'Node.js 22.18 or newer is required.', hint: 'Use the tested Node 22.18+ or 24 line.' };
  }
  return major === 22 || major === 24
    ? { code: 'node-supported', severity: 'ok', message: `Node.js ${version} is on a tested version line.` }
    : { code: 'node-untested', severity: 'warning', message: 'This Node.js version line has not been validated.', hint: 'Use Node 22.18+ or 24 for tested support.' };
}

// Only fixed diagnostic text and known target filenames leave this module.
// Errors may contain private paths or file contents, so never forward them.
export async function diagnoseProject(input: string): Promise<DoctorReport> {
  const checks: Diagnostic[] = [checkNodeVersion(process.versions.node)];
  const finish = (): DoctorReport => ({ version: 1, checks, summary: {
    errors: checks.filter(check => check.severity === 'error').length,
    warnings: checks.filter(check => check.severity === 'warning').length,
  } });
  let root: string;
  try { root = await projectRoot(input); }
  catch {
    checks.push({ code: 'project-unavailable', severity: 'error', message: 'Project directory is missing, inaccessible, or not a directory.', hint: 'Select an existing directory with --project. For Git projects, select the repository root.' });
    return finish();
  }
  checks.push({ code: 'project-ready', severity: 'ok', message: 'Selected project directory exists.' });
  const git = new ProjectGit(root);
  try { await git.initialize(); }
  catch {
    checks.push({ code: 'git-inspection-blocked', severity: 'error', message: 'Project policy or Git metadata could not be safely inspected.', hint: 'Check repository ownership, Git health and .agentbridgeignore syntax. No context was loaded.' });
    return finish();
  }
  if (git.state === 'not-root') {
    checks.push({ code: 'project-not-root', severity: 'error', message: 'Selected directory is inside a Git repository, but is not its root.', hint: 'Run doctor with --project pointing to the repository root.' });
    return finish();
  }
  checks.push(git.state === 'ready'
    ? { code: 'git-ready', severity: 'ok', message: 'Git is available and the project root is selected.' }
    : { code: git.state, severity: 'warning', message: git.state === 'missing-git' ? 'Git is not available; discovery and progress facts are unavailable.' : 'No Git repository was found; discovery and progress facts are unavailable.', hint: 'Basic context can work without Git when ignore rules do not block it. Install Git and use a repository root for Git facts.' });

  // Check the policy boundary before reading any context. Do not open excluded
  // files even for diagnostics, and do not fall back to raw filesystem reads.
  let source: string | undefined;
  try {
    await git.assertControl(CONTEXT);
    source = await readText(root, CONTEXT);
  } catch {
    checks.push({ code: 'context-blocked', severity: 'error', message: 'Canonical context cannot be safely read.', hint: 'Check ignore rules, path types, links, file size, UTF-8 and permissions. Do not bypass exclusions.' });
    return finish();
  }

  try {
    const lock = await lstat(await safePath(root, '.agentbridge/lock')).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    });
    if (lock && !lock.isFile()) throw new Error();
    checks.push(lock
      ? { code: 'sync-lock-present', severity: 'warning', message: 'A sync lock exists; a writer may be active or interrupted.', hint: 'Verify no writer is running before manually removing .agentbridge/lock. Doctor never removes it.' }
      : { code: 'sync-lock-absent', severity: 'ok', message: 'No sync lock was present at inspection time.' });
  } catch {
    checks.push({ code: 'sync-lock-unsafe', severity: 'error', message: 'Sync lock path is unsafe or inaccessible.', hint: 'Review .agentbridge/lock and its parent path manually. No lock was opened or removed.' });
  }
  if (source === undefined) {
    checks.push({ code: 'context-missing', severity: 'warning', message: 'Project is not initialized.', hint: 'Run init for this project, edit .agentbridge/context.md, then save a handoff and preview sync.' });
    return finish();
  }
  try {
    const plan = await planSync(git);
    checks.push({ code: 'context-valid', severity: 'ok', message: 'Context, optional note, sync state and targets passed sync preflight.' });
    checks.push(plan.inputs[HANDOFF]?.trim()
      ? { code: 'handoff-present', severity: 'ok', message: 'A saved handoff is present; verify its facts before acting.' }
      : { code: 'handoff-missing', severity: 'warning', message: 'No non-empty handoff note is saved.', hint: 'Use handoff --save with reviewed --done, --next or --blocked notes, then preview sync.' });
    for (const file of plan.files) {
      const ready = file.status === 'unchanged';
      checks.push({ code: `output-${file.status}`, severity: ready ? 'ok' : 'warning', message: `${file.file}: ${file.status}.`,
        ...(!ready ? { hint: file.status === 'create' ? 'Preview sync --dry-run before creating instructions.'
          : `Review sync --dry-run and reconcile edits before approving --approve-overwrite ${file.file}. User text outside markers is preserved.` } : {}) });
    }
  } catch {
    checks.push({ code: 'sync-preflight-blocked', severity: 'error', message: 'Sync preflight is blocked; no output proposals are reported.', hint: 'Run sync --dry-run for the validation error. Review context, notes, state and instruction markers; preserve user guidance before repairing.' });
  }
  return finish();
}

export function renderDoctor(report: DoctorReport): string {
  return ['AgentBridge doctor (read-only)', '', ...report.checks.flatMap(check => [
    `${check.severity.toUpperCase()} [${check.code}] ${check.message}`, ...(check.hint ? [`  Next: ${check.hint}`] : []),
  ]), '', `${report.summary.errors} error(s), ${report.summary.warnings} warning(s). No files changed.`,
  'Agent CLI availability/loading, model behavior, write access and semantic correctness were not checked.'].join('\n');
}
