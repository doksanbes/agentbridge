import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { CONTEXT, HANDOFF, STATE, TARGETS, loadContext, renderInstructions } from './context.js';
import type { Target } from './context.js';
import type { ProjectGit } from './git.js';
import { digest, readText, safePath, writeText } from './safety.js';
import { mergeInstructions } from './managed.js';

interface State { version: 1; outputs: Partial<Record<Target, string>> }
export interface PlannedFile {
  file: Target;
  status: 'create' | 'unchanged' | 'update' | 'conflict' | 'unmanaged';
  previous?: string;
  content: string;
  previousHash?: string;
  nextHash: string;
}
export interface SourceWrite { file: string; previous: string | undefined; content: string }
export interface SyncPlan { files: PlannedFile[]; inputs: Record<string, string | undefined>; sources?: SourceWrite[] }

function parseState(text: string | undefined): State {
  if (text === undefined) return { version: 1, outputs: {} };
  try {
    const state = JSON.parse(text) as State;
    if (state.version !== 1 || !state.outputs || typeof state.outputs !== 'object' || Array.isArray(state.outputs) ||
        Object.entries(state.outputs).some(([key, hash]) => !TARGETS.includes(key as Target) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error();
    return state;
  } catch { throw new Error('Invalid sync state. Preserve it for diagnosis; restore a valid state or remove it to treat outputs as unmanaged.'); }
}

export async function planSync(git: ProjectGit, proposed?: { context: string; handoff: string; rawContext: string | undefined; rawHandoff: string | undefined }): Promise<SyncPlan> {
  const { context, handoff, rawContext, rawHandoff } = proposed ?? await loadContext(git);
  await git.assertControl(STATE);
  const stateText = await readText(git.root, STATE);
  const state = parseState(stateText);
  const inputs: Record<string, string | undefined> = {
    [CONTEXT]: rawContext, [HANDOFF]: rawHandoff, [STATE]: stateText,
  };
  const files: PlannedFile[] = [];
  for (const file of TARGETS) {
    await git.assertControl(file);
    const previous = await readText(git.root, file);
    const content = mergeInstructions(previous, renderInstructions(file, context, handoff), state.outputs[file]);
    const status = previous === undefined ? 'create' : previous === content ? 'unchanged' :
      state.outputs[file] === undefined ? 'unmanaged' : state.outputs[file] === digest(previous) ? 'update' : 'conflict';
    files.push({ file, status, content, nextHash: digest(content),
      ...(previous === undefined ? {} : { previous, previousHash: digest(previous) }) });
  }
  return { files, inputs, ...(proposed ? { sources: [
    { file: CONTEXT, previous: rawContext, content: context },
    { file: HANDOFF, previous: rawHandoff, content: handoff },
  ].filter(f => f.content !== f.previous) } : {}) };
}

export async function applySync(git: ProjectGit, plan: SyncPlan, approvals: string[]): Promise<void> {
  const blocked = plan.files.filter(f => f.previous !== undefined && f.status !== 'unchanged' && !approvals.includes(f.file));
  if (blocked.length) throw new Error(`Existing instructions require explicit approval: --approve-overwrite ${blocked.map(f => f.file).join(',')}. Preview with sync --dry-run first.`);
  // Preflight sources before creating the control directory for a new project.
  for (const file of [CONTEXT, HANDOFF, STATE]) await git.assertControl(file);
  await mkdir(path.dirname(await safePath(git.root, '.agentbridge/lock')), { recursive: true });
  const lockPath = await safePath(git.root, '.agentbridge/lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new Error('Another operation holds .agentbridge/lock. If interrupted, verify no writer is running before removing the lock.'); }
  try {
    for (const [file, previous] of Object.entries(plan.inputs)) {
      await git.assertControl(file);
      if (await readText(git.root, file) !== previous) throw new Error('Context changed after preview; retry.');
    }
    for (const file of plan.files) {
      await git.assertControl(file.file);
      if (await readText(git.root, file.file) !== file.previous) throw new Error('Instruction changed after preview; retry.');
    }
    // Back up every replaced instruction before writing any output. Backups contain
    // user content, are private-mode files, and are never read into generated context.
    const replacements = [...plan.files.filter(f => f.status !== 'unchanged'), ...(plan.sources ?? [])];
    for (const file of replacements) {
      if (file.previous === undefined) continue;
      const backup = `.agentbridge/backups/${digest(file.previous)}/${file.file}`;
      const existing = await readText(git.root, backup);
      if (existing !== undefined && existing !== file.previous) throw new Error('Backup integrity conflict.');
      if (existing === undefined) await writeText(git.root, backup, file.previous);
    }
    for (const file of plan.sources ?? []) await writeText(git.root, file.file, file.content, file.previous);
    for (const file of plan.files) if (file.status !== 'unchanged') {
      await writeText(git.root, file.file, file.content, file.previous);
    }
    const state: State = { version: 1, outputs: Object.fromEntries(plan.files.map(f => [f.file, f.nextHash])) };
    const content = JSON.stringify(state, null, 2) + '\n';
    if (content !== plan.inputs[STATE]) await writeText(git.root, STATE, content, plan.inputs[STATE]);
  } finally { await lock.close(); await unlink(lockPath); }
}
