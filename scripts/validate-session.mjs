// Synthetic workflow, not evidence of model behavior. Optional Codex probe renders
// a prompt with an isolated home and rejecting local provider; never starts a turn.
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { isolatedEnv } from './package-tools.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, '.cache'), { recursive: true });
const base = await mkdtemp(path.join(root, '.cache', 'session-demo-'));
const project = path.join(base, 'ParcelKit ü'); await mkdir(project);
const cliPath = path.join(root, 'dist/cli.js');
function command(binary, args, cwd = project, input, env = process.env) {
  const result = spawnSync(binary, args, { cwd, input, env, encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
const cli = (args, input) => command(process.execPath, [cliPath, ...args], project, input);
const git = args => command('git', ['-c', 'core.hooksPath=.git/no-hooks', ...args]);
git(['init', '--initial-branch=main']);
await writeFile(path.join(project, 'postal.mjs'), 'export function normalize(value) { if (!value.trim()) throw new Error("Empty postal code"); return value.trim(); }\n');
await writeFile(path.join(project, 'postal.test.mjs'), `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { normalize } from './postal.mjs';\ntest('empty', () => assert.throws(() => normalize(' ')));\ntest('trim', () => assert.equal(normalize(' 12345 '), '12345'));\n`);
git(['add', '--', 'postal.mjs', 'postal.test.mjs']);
// Per-command synthetic identity; no global Git identity is read or changed.
git(['-c', 'user.name=AgentBridge synthetic fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Add offline postal validation']);
const testOutput = command(process.execPath, ['--test', 'postal.test.mjs']);
assert.match(testOutput, /pass 2/);
await writeFile(path.join(project, 'README.md'), '# ParcelKit\nUnicode support is pending.\n');
git(['add', '--', 'README.md']);
await writeFile(path.join(project, 'postal.mjs'), (await readFile(path.join(project, 'postal.mjs'), 'utf8')) + '// TODO: full-width Unicode input\n');
await writeFile(path.join(project, '.env'), 'SYNTHETIC_PRIVATE_CANARY');
await writeFile(path.join(project, '.gitignore'), '.env\n');
await writeFile(path.join(project, 'CLAUDE.md'), '# Team rule\r\nKeep the public API stable.\r\n');
const inspect = JSON.parse(cli(['session', '--inspect']));
const notes = JSON.stringify({ to: 'claude', purpose: 'Normalize postal codes offline without carrier calls.',
  done: ['Implemented empty-input rejection and trimming; node --test postal.test.mjs passed both tests in this synthetic run.'],
  next: ['Add full-width Unicode coverage; run node --test postal.test.mjs.'],
  blocked: ['Synthetic blocker: carrier sandbox unavailable; use offline fixtures.'] });
const preview = JSON.parse(cli(['session'], notes));
await assert.rejects(readFile(path.join(project, '.agentbridge/handoff.md')), { code: 'ENOENT' });
// Simulated explicit approval. No claim that a human or model performed this step.
const approved = JSON.parse(cli(['session', '--approve', preview.approval], notes));
assert.equal(approved.applied, true);
assert.ok((await readFile(path.join(project, 'CLAUDE.md'), 'utf8')).startsWith('# Team rule\r\nKeep the public API stable.\r\n'));
const geminiNotes = JSON.stringify({ to: 'gemini', next: ['Review Unicode coverage; no additional tests have been run.'] });
const gemini = JSON.parse(cli(['session'], geminiNotes));
cli(['session', '--approve', gemini.approval], geminiNotes);
const report = { project, simulatedApproval: true, actualFixtureTests: 2, inferredTestResults: false,
  verified: ['Git root detection', 'read-only preview', 'explicit digest approval', 'existing CRLF instructions preserved', 'Claude target', 'repeated Gemini target', 'private canary absent'],
  codexPromptInspection: false, modelBehaviorVerified: false, claudeLoadingVerified: false, geminiLoadingVerified: false };
assert.ok(!JSON.stringify({ inspect, preview, approved, gemini }).includes('SYNTHETIC_PRIVATE_CANARY'));
await writeFile(path.join(base, 'preview.json'), JSON.stringify(preview, null, 2) + '\n');
if (process.env.AGENTBRIDGE_CODEX_BINARY) {
  // Repository-scoped skill avoids touching the real user's skill installation.
  cli(['install-skill', '--skill-home', project]);
  const home = path.join(base, 'isolated-home');
  const env = await isolatedEnv(home);
  env.CODEX_HOME = path.join(home, 'codex'); await mkdir(env.CODEX_HOME, { recursive: true });
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.writeHead(403); res.end('No inference authorized.'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await writeFile(path.join(env.CODEX_HOME, 'config.toml'), `model = "offline-inspection"\nmodel_provider = "offline_validation"\ncheck_for_update_on_startup = false\n[analytics]\nenabled = false\n[feedback]\nenabled = false\n[model_providers.offline_validation]\nname = "Rejecting local provider"\nbase_url = "http://127.0.0.1:${server.address().port}/v1"\nwire_api = "responses"\nrequires_openai_auth = false\nsupports_websockets = false\n`);
    const output = command(process.env.AGENTBRIDGE_CODEX_BINARY, ['-C', project, 'debug', 'prompt-input', '$agentbridge-handoff to Claude Code'], project, undefined, env);
    const rendered = JSON.stringify(JSON.parse(output));
    assert.ok(rendered.includes('Prepare a reviewed Codex-to-Claude Code or Gemini CLI project handoff'), 'Skill metadata was not discovered by the real Codex CLI.');
    assert.ok(rendered.includes('SKILL.md'), 'Skill location missing from actual prompt.');
    assert.equal(requests, 0);
    report.codexPromptInspection = true; report.inferenceRequests = requests;
    // debug prompt-input appends a literal prompt. It exposes skill discovery, but
    // does not simulate interactive skill selection or an actual agent turn.
    report.skillDiscoveryVerified = true; report.interactiveInvocationVerified = false;
    report.skillBodyPresentInDebugPrompt = rendered.includes('agentbridge session --inspect');
    report.codexVersion = command(process.env.AGENTBRIDGE_CODEX_BINARY, ['--version'], project, undefined, env).trim();
  } finally { await new Promise(resolve => server.close(resolve)); }
}
await writeFile(path.join(base, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
