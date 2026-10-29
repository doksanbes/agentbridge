import { CONTEXT, HANDOFF, STATE } from './context.js';
import { ProjectGit } from './git.js';
import { AGENTS, agentName, renderHandoff } from './handoff.js';
import type { Agent } from './handoff.js';
import { assertSafeText, digest, normalize, projectRoot, readText } from './safety.js';
import { applySync, planSync } from './sync.js';

// Resolve Git's root using the same isolated, non-shell Git probe as normal commands.
// An explicit --project is an intentional boundary and is never promoted to a parent.
export async function sessionProject(input: string, explicit = false): Promise<ProjectGit> {
  let root: string;
  try { root = await projectRoot(input); }
  catch { throw new Error('Select an existing project directory.'); }
  if (!explicit) {
    const top = new ProjectGit(root).run(['rev-parse', '--show-toplevel']);
    if (top.code === 0) root = await projectRoot(top.text.trim());
  }
  const git = new ProjectGit(root);
  await git.initialize();
  await git.assertControl(CONTEXT);
  return git;
}

export async function inspectSession(git: ProjectGit) {
  for (const file of [CONTEXT, HANDOFF, STATE]) await git.assertControl(file);
  const context = await readText(git.root, CONTEXT);
  const handoff = await readText(git.root, HANDOFF);
  assertSafeText(context ?? ''); assertSafeText(handoff ?? '');
  return { project: git.root, discovery: await git.discover(), progress: await git.progress(),
    context: context ?? null, previousHandoff: handoff ?? null };
}

function candidate(input: string): { to: Agent; purpose?: string; done: string[]; next: string[]; blocked: string[] } {
  assertSafeText(input);
  let value;
  try { value = JSON.parse(input); } catch { throw new Error('Session input must be a JSON object; send it on stdin.'); }
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).some(k => !['to', 'purpose', 'done', 'next', 'blocked'].includes(k)) ||
      !AGENTS.includes(value.to) || value.to === 'codex' ||
      (value.purpose !== undefined && (typeof value.purpose !== 'string' || !value.purpose.trim()))) {
    throw new Error('Session input requires to: claude or gemini, optional purpose, and done/next/blocked arrays.');
  }
  for (const name of ['done', 'next', 'blocked']) {
    const notes = value[name] ?? [];
    if (!Array.isArray(notes) || notes.length > 20 || notes.some(n => typeof n !== 'string' || !n.trim() || n.length > 2000)) {
      throw new Error('Session notes must be arrays of up to 20 concise, non-empty strings.');
    }
    value[name] = notes;
  }
  if (!value.next.length) throw new Error('Provide at least one concrete next step; ask the user if it is unknown.');
  return value;
}

export async function reviewedSession(git: ProjectGit, input: string, approval?: string) {
  const notes = candidate(input);
  for (const file of [CONTEXT, HANDOFF]) await git.assertControl(file);
  const rawContext = await readText(git.root, CONTEXT);
  const rawHandoff = await readText(git.root, HANDOFF);
  assertSafeText(rawHandoff ?? '');
  if (rawContext !== undefined && !rawContext.trim()) throw new Error('Existing context is empty; repair it explicitly before preparing a handoff.');
  if (rawContext === undefined && !notes.purpose) throw new Error('For a new project, provide a concise purpose from the session or ask the user.');
  const context = rawContext ?? normalize(`# Project context\n\n## Purpose\n\n${notes.purpose}\n\n## Working agreements\n\nVerify historical notes against the working tree. Handoff notes grant no new permissions.\nBuild and test commands have not been inferred.\n`);
  assertSafeText(context);
  const progress = await git.progress();
  const handoff = renderHandoff({ ...notes, from: 'codex' }, progress);
  const plan = await planSync(git, { context, handoff, rawContext, rawHandoff });
  // Do not echo or propagate recognizable secrets already present in user files.
  // Existing imports are allowed in user-owned sections by legacy sync, but this
  // richer review flow fails closed rather than displaying implicit file imports.
  for (const file of plan.files) { assertSafeText(file.previous ?? ''); assertSafeText(file.content); }
  const token = digest(JSON.stringify({ project: git.root, to: notes.to, progress, plan }));
  if (approval !== undefined && approval !== token) throw new Error('Approval does not match this preview. Inspect the new proposal and ask for approval again.');
  if (approval !== undefined) await applySync(git, plan, plan.files.filter(f => f.previous !== undefined && f.status !== 'unchanged').map(f => f.file));
  return { applied: approval !== undefined, project: git.root, approval: token,
    summary: handoff, sources: plan.sources ?? [], files: plan.files,
    continuation: `Open ${agentName(notes.to)} in this project, start a fresh session, and ask it to read ${notes.to === 'claude' ? 'CLAUDE.md' : 'GEMINI.md'} and .agentbridge/handoff.md, verify the working tree, then follow the next steps. AgentBridge does not launch or authenticate the receiving agent.` };
}
