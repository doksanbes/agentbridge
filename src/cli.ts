#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { CONTEXT, HANDOFF, TARGETS, VERSION, initialContext, loadContext } from './context.js';
import { ProjectGit, renderProgress } from './git.js';
import { applySync, planSync } from './sync.js';
import { assertSafeText, projectRoot, readText, writeText } from './safety.js';
import { AGENTS, renderHandoff } from './handoff.js';
import type { Agent } from './handoff.js';
import { diagnoseProject, renderDoctor } from './doctor.js';
import { inspectSession, reviewedSession, sessionProject } from './session.js';
import { installCodexSkill } from './codex.js';
import { MAX_TEXT } from './safety.js';

const HELP = `AgentBridge ${VERSION} — offline project context handoffs

Usage: agentbridge <command> [options]

  init       Create .agentbridge/context.md; existing files remain intact
  discover   Show safe tracked filenames and project markers as JSON
  progress   Show Git commit IDs and tracked changes, without contents
  handoff    Print current notes + live Git facts; --save records a new handoff
  sync       Generate AGENTS.md, CLAUDE.md, GEMINI.md from reviewed context
  status     Check generated instructions for drift (read-only)
  doctor     Diagnose project setup and sync blockers without changing files
  session    Inspect, preview, then approve a session handoff (JSON on stdin)
  install-skill  Install the Codex handoff skill once; never overwrite a skill

Options:
  --project <directory>       Project directory (default: current directory)
  --dry-run                   Preview writes without changing any files
  --check                     Read-only sync check; exit 1 for drift
  --json                      Machine-readable sync/status/doctor output
  --inspect                   Collect session facts without reading stdin
  --approve <digest>          Apply the exact reviewed session preview
  --skill-home <directory>    Repository skill root (default: personal Codex skills)
  --approve-overwrite <names>  Approve named existing files, comma-separated
                              Example: AGENTS.md,CLAUDE.md,GEMINI.md
  --save                      Save manual notes and current Git facts (handoff)
  --done <text>               Completed work; repeat for multiple notes
  --next <text>               Next steps; repeat for multiple notes
  --blocked <text>            Blockers; repeat for multiple notes
  --replace-note              Explicitly replace an existing saved handoff
  --from <agent>              Sending agent: codex, claude, or gemini
  --to <agent>                Receiving agent (use with --from and --save)
  --help                      Show this help
  --version                   Show version

Exit codes: 0 success (doctor warnings allowed); 1 status/--check drift; 2 invalid/unsafe operation or doctor errors.
No network, agent invocation, transcript ingestion, or shell execution of project commands.
`;

async function main(): Promise<void> {
  let parsed;
  try { parsed = parseArgs({ options: {
    project: { type: 'string' }, 'dry-run': { type: 'boolean' }, check: { type: 'boolean' },
    'approve-overwrite': { type: 'string' }, save: { type: 'boolean' },
    done: { type: 'string', multiple: true }, next: { type: 'string', multiple: true },
    blocked: { type: 'string', multiple: true }, 'replace-note': { type: 'boolean' },
    from: { type: 'string' }, to: { type: 'string' }, json: { type: 'boolean' },
    help: { type: 'boolean' }, version: { type: 'boolean' },
    inspect: { type: 'boolean' }, approve: { type: 'string' }, 'skill-home': { type: 'string' },
  }, allowPositionals: true, strict: true }); }
  catch { throw new Error('Invalid command-line arguments. Run agentbridge --help.'); }
  const { values, positionals } = parsed;
  if (values.version) { console.log(VERSION); return; }
  if (values.help || !positionals.length) { console.log(HELP); return; }
  if (positionals.length !== 1) throw new Error('Expected one command. Use --project for the project directory.');
  const command = positionals[0]!;
  const permitted: Record<string, string[]> = {
    init: ['project', 'dry-run'], discover: ['project'], progress: ['project'],
    handoff: ['project', 'dry-run', 'save', 'done', 'next', 'blocked', 'replace-note', 'from', 'to'],
    sync: ['project', 'dry-run', 'check', 'approve-overwrite', 'json'], status: ['project', 'json'],
    doctor: ['project', 'json'],
    session: ['project', 'inspect', 'approve'],
    'install-skill': ['skill-home', 'dry-run'],
  };
  if (!permitted[command]) throw new Error('Unknown command. Run agentbridge --help.');
  for (const key of Object.keys(values)) if (!permitted[command]!.includes(key)) throw new Error(`Option --${key} does not apply to ${command}.`);
  if (command === 'install-skill') {
    console.log(await installCodexSkill(values['skill-home'], values['dry-run']));
    return;
  }
  if (command === 'session') {
    if (values.inspect && values.approve !== undefined) throw new Error('Inspection cannot apply an approval.');
    const git = await sessionProject(values.project ?? process.cwd(), values.project !== undefined);
    if (values.inspect) console.log(JSON.stringify(await inspectSession(git), null, 2));
    else {
      if (process.stdin.isTTY) throw new Error('Send the reviewed session JSON on stdin; use --inspect to collect facts.');
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of process.stdin) {
        const buffer = Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_TEXT) throw new Error('Session input is too large. Keep the handoff concise.');
        chunks.push(buffer);
      }
      let input;
      try { input = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
      catch { throw new Error('Session input must be valid UTF-8.'); }
      console.log(JSON.stringify(await reviewedSession(git, input, values.approve), null, 2));
    }
    return;
  }
  if (command === 'doctor') {
    const report = await diagnoseProject(values.project ?? process.cwd());
    console.log(values.json ? JSON.stringify(report, null, 2) : renderDoctor(report));
    process.exitCode = report.summary.errors ? 2 : 0;
    return;
  }
  const approvals = (values['approve-overwrite'] ?? '').split(',').filter(Boolean);
  if (approvals.some(name => !TARGETS.includes(name as typeof TARGETS[number]))) throw new Error('Overwrite approval must name AGENTS.md, CLAUDE.md, or GEMINI.md exactly.');
  const root = await projectRoot(values.project ?? process.cwd()).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Project directory does not exist. Create it first, or pass --project <existing-directory>.');
    }
    throw error;
  });
  const git = new ProjectGit(root);
  await git.initialize();
  if (command === 'init') {
    await git.assertControl(CONTEXT);
    const existing = await readText(git.root, CONTEXT);
    if (existing !== undefined) { console.log('Already initialized; canonical context preserved.'); return; }
    const content = initialContext();
    if (!values['dry-run']) await writeText(git.root, CONTEXT, content);
    console.log(`${values['dry-run'] ? 'Would create' : 'Created'} ${CONTEXT}. Edit it, then run sync --dry-run.\n${content}`);
  } else if (command === 'discover') console.log(JSON.stringify(await git.discover(), null, 2));
  else if (command === 'progress') console.log(renderProgress(await git.progress()));
  else if (command === 'handoff') {
    if (values.from || values.to) {
      if (!values.save || !values.from || !values.to || !AGENTS.includes(values.from as Agent) || !AGENTS.includes(values.to as Agent) || values.from === values.to) {
        throw new Error('Use --save --from <agent> --to <different-agent>; agents are codex, claude, and gemini.');
      }
    }
    await loadContext(git, !values.save);
    const hasNotes = [values.done, values.next, values.blocked].some(notes => notes?.length);
    if ([...(values.done ?? []), ...(values.next ?? []), ...(values.blocked ?? [])].some(note => !note.trim())) {
      throw new Error('Manual notes must contain non-empty text.');
    }
    if (!values.save && (hasNotes || values['replace-note'])) throw new Error('Use --save to record supplied notes. Add --dry-run to preview.');
    if (values.save && !hasNotes) throw new Error('Supply at least one --done, --next, or --blocked note when saving.');
    const previous = await readText(git.root, HANDOFF);
    let content: string;
    if (values.save) {
      content = renderHandoff({ ...(values.done ? { done: values.done } : {}), ...(values.next ? { next: values.next } : {}),
        ...(values.blocked ? { blocked: values.blocked } : {}), ...(values.from ? { from: values.from as Agent, to: values.to as Agent } : {}) }, await git.progress());
      if (previous !== undefined && !values['replace-note']) throw new Error('Saved handoff exists. Review it and use --replace-note to replace it.');
      if (!values['dry-run']) await writeText(git.root, HANDOFF, content, previous);
      console.log(`${values['dry-run'] ? 'Would save' : 'Saved'} ${HANDOFF}. Run sync to distribute it.\n`);
    } else content = `${previous ?? 'No manual handoff saved.\n'}\n## Live snapshot\n\n${renderProgress(await git.progress())}`;
    assertSafeText(content);
    console.log(content);
  } else {
    const plan = await planSync(git);
    const check = values.check || command === 'status';
    if (values.json) console.log(JSON.stringify({ files: plan.files.map(f => ({ file: f.file, status: f.status,
      previousHash: f.previousHash ?? null, nextHash: f.nextHash,
      ...(values['dry-run'] ? { proposedContent: f.content } : {}) })) }, null, 2));
    else {
      const descriptions = { create: 'will create', unchanged: 'up to date', update: 'reviewed source changed',
        conflict: 'edited since last sync; review before approving', unmanaged: 'will append a managed section; existing user text preserved' };
      console.log(plan.files.map(f => `${f.file}: ${f.status} — ${descriptions[f.status]}`).join('\n'));
      const approval = plan.files.filter(f => f.previous !== undefined && f.status !== 'unchanged').map(f => f.file);
      if (approval.length) console.log(`\nExisting files need explicit approval: --approve-overwrite ${approval.join(',')}`);
      console.log('User text outside the AgentBridge markers is preserved.');
      if (values['dry-run']) {
        for (const file of plan.files.filter(f => f.status !== 'unchanged')) console.log(`\n--- Proposed ${file.file} ---\n${file.content}`);
        console.log('\nDry run: no files changed.');
      }
    }
    if (check) { process.exitCode = plan.files.some(f => f.status !== 'unchanged') ? 1 : 0; return; }
    if (!values['dry-run']) {
      await applySync(git, plan, approvals);
      if (!values.json) console.log('Sync complete. Start or refresh the receiving agent to load the instructions.');
    }
  }
}

main().catch(error => {
  // Do not echo file contents, Git stderr, or raw user arguments on failure.
  const message = error instanceof Error ? error.message : 'Operation failed.';
  console.error(`AgentBridge: ${message.replace(/[\x00-\x1f\x7f]/g, ' ')}`);
  process.exitCode = 2;
});
