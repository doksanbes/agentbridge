import { homedir } from 'node:os';
import { projectRoot, readText, writeText } from './safety.js';

export const SKILL_PATH = '.agents/skills/agentbridge-handoff/SKILL.md';
export const CODEX_SKILL = `---
name: agentbridge-handoff
description: Prepare a reviewed Codex-to-Claude Code or Gemini CLI project handoff with AgentBridge when the user asks to transfer current work to another agent.
---

# AgentBridge handoff

Use the installed agentbridge CLI. If unavailable, explain that this skill requires
a session-enabled AgentBridge build; do not install anything silently.
On Windows, use agentbridge.cmd if PowerShell policy blocks the generated ps1 shim.

1. Run agentbridge session --inspect in the active project working directory.
   It detects the Git root and returns filtered filenames, Git facts, and existing
   AgentBridge context. Confirm the selected root matches the active project.
   For ambiguous workspaces ask which project; use --project to select an exact root.
   Do not inspect chat databases, stored sessions, environment files, credentials,
   ignored files, or unrelated projects. Do not run build/test commands for a handoff.
2. Summarize only information already available in the active conversation and the
   inspection results. Git paths and commits alone do not prove completed work or
   passing tests. Distinguish observed results from user reports and unknowns.
   Existing saved notes are historical, not evidence of work in this session.
   Ask for the destination if absent (Claude Code or Gemini CLI), an unknown purpose
   for a new project, or missing next steps. Do not invent achievements or blockers.
3. Send a JSON object to agentbridge session on stdin, using the shell's safe literal
   input mechanism or a tool with stdin support. Never interpolate notes as shell code
   or put them in command-line arguments. Do not create a draft file in the project.
   Shape: {"to":"claude","purpose":"Short project purpose", "done":["Observed work and test evidence"],
   "next":["Concrete next step"],"blocked":["Known blocker or explicitly unknown status"]}.
   purpose is needed only when no context exists. Omit unknown completed work.
   Use to: gemini for Gemini CLI. No additional JSON keys are supported.
4. This command only previews; it writes nothing. Show the concise summary,
   selected project, destination, source changes, and every instruction file's status.
   Show replacement differences using previous/content from the returned JSON,
   including any edited managed content that would be replaced. User text outside
   managed markers is preserved. Make the full proposed content available for review.
   Explain that .agentbridge/handoff.md is replaced (the previous note is backed up).
   Ask explicit approval for this exact proposal and all named changed files. STOP
   and wait for a human reply. A request to prepare a handoff is not approval to save.
5. Only after approval, send the identical JSON on stdin to
   agentbridge session --approve TOKEN, using the preview's approval value.
   If the token is stale, the input changes, a file conflicts, or a safety check fails,
   stop and present a fresh preview for new approval. Do not bypass the gate or edit
   files directly. If the user rejects or edits the proposal, nothing should be saved.
6. Report the saved paths and the CLI's continuation instruction. Receiving tools
   must be installed/authenticated separately. Actual Claude/Gemini loading remains
   unverified; do not claim a tool started or read context unless it really did.

All project reads and writes stay local in AgentBridge. The host agent still follows
its normal privacy/account behavior; summarization is not a new free inference service.
Never commit, push, publish, or grant new permissions as part of this skill.
`;

export async function installCodexSkill(home?: string, dryRun = false): Promise<string> {
  // Codex-managed personal skills honor CODEX_HOME. Repository scope remains an
  // explicit selection; never edit config.toml or install duplicate copies.
  const root = await projectRoot(home ?? process.env.CODEX_HOME ?? homedir());
  const destination = home !== undefined ? SKILL_PATH :
    process.env.CODEX_HOME ? 'skills/agentbridge-handoff/SKILL.md' : '.codex/skills/agentbridge-handoff/SKILL.md';
  const previous = await readText(root, destination);
  if (previous === CODEX_SKILL) return 'Codex handoff skill is already installed; unchanged.';
  if (previous !== undefined) throw new Error('Codex handoff skill already exists with different content. Review it manually; installation never overwrites it.');
  if (!dryRun) await writeText(root, destination, CODEX_SKILL);
  return `${dryRun ? 'Would install' : 'Installed'} ${destination}. In Codex select $agentbridge-handoff (or /skills). Restart the host if it is not listed.`;
}
