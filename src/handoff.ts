import { normalize, assertSafeText } from './safety.js';
import { renderProgress } from './git.js';
import type { Progress } from './git.js';

export const AGENTS = ['codex', 'claude', 'gemini'] as const;
export type Agent = typeof AGENTS[number];
export const agentName = (agent: Agent): string => ({ codex: 'Codex', claude: 'Claude Code', gemini: 'Gemini CLI' })[agent];

export function renderHandoff(notes: { done?: string[]; next?: string[]; blocked?: string[]; from?: Agent; to?: Agent }, progress: Progress): string {
  const sections = [['Completed', notes.done], ['Next steps', notes.next], ['Blockers', notes.blocked]] as const;
  const text = sections.filter(([, list]) => list?.length).map(([title, list]) =>
    `## ${title}\n\n${list!.map(note => `- ${note.trim().replace(/\r\n?/g, '\n').replaceAll('\n', '\n  ')}`).join('\n')}\n`).join('\n');
  const route = notes.from && notes.to ? `From: ${agentName(notes.from)}\nTo: ${agentName(notes.to)}\n\n` : '';
  const content = normalize(`# Manual session notes\n\n${route}${text}\n${renderProgress(progress)}`);
  assertSafeText(content);
  return content;
}
