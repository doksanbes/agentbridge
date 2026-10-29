// Developer-only probe for an already installed Codex CLI. This never starts a turn.
// The caller explicitly selects a synthetic project. No existing user session is read.
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const project = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the temporary synthetic project path from validate-workflow.mjs.');
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, '.cache'), { recursive: true });
const home = await mkdtemp(path.join(root, '.cache', 'codex-validation-home-'));
let requests = 0;
const server = createServer((_request, response) => { requests++; response.writeHead(403); response.end('No inference permitted.'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await writeFile(path.join(home, 'config.toml'), `model = "offline-validation-model"
model_provider = "offline_validation"
check_for_update_on_startup = false
[analytics]
enabled = false
[feedback]
enabled = false
[model_providers.offline_validation]
name = "Local instruction inspection only"
base_url = "http://127.0.0.1:${port}/v1"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
`);
const env = { ...process.env, CODEX_HOME: home };
for (const name of Object.keys(env)) if (/(TOKEN|API_KEY|AUTHORIZATION|ACCESS_KEY|SECRET)/i.test(name) || name.startsWith('CODEX_') && name !== 'CODEX_HOME') delete env[name];
const codex = process.env.AGENTBRIDGE_CODEX_BINARY ?? 'codex';
const args = ['-C', project, 'debug', 'prompt-input', 'Validate only the local reviewed project context.'];
let output = '', stderr = '', total = 0;
try {
  const child = spawn(codex, args, { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const timer = setTimeout(() => child.kill(), 30_000);
  child.stdout.on('data', chunk => { total += chunk.length; if (total > 4 * 1024 * 1024) child.kill(); else output += chunk; });
  child.stderr.on('data', chunk => { if (stderr.length < 8192) stderr += chunk; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }).finally(() => clearTimeout(timer));
  await writeFile(path.join(home, 'diagnostics.txt'), stderr);
  assert.equal(code, 0, 'Codex prompt inspection failed; see isolated diagnostics.');
  const prompt = JSON.parse(output);
  const promptText = JSON.stringify(prompt);
  const instructions = await readFile(path.join(project, 'AGENTS.md'), 'utf8');
  assert.ok(promptText.includes('Normalize postal codes offline without carrier calls.'), 'Project purpose missing from actual Codex prompt.');
  assert.ok(promptText.includes('Keep the public API stable.'), 'Project constraints missing from actual Codex prompt.');
  assert.ok(promptText.includes('Latest session handoff'), 'Saved handoff missing from actual Codex prompt.');
  const latest = 'Review the staged review queue and unstaged README notes before committing';
  assert.ok(instructions.includes(latest)); assert.ok(promptText.includes(latest), 'Latest next step missing from actual Codex prompt.');
  assert.ok(!promptText.includes('SYNTHETIC_PRIVATE_CANARY'));
  assert.equal(requests, 0, 'Instruction inspection attempted an inference request.');
  const report = { actualCli: 'codex', mode: 'debug prompt-input', instructionLoadingVerified: true,
    modelBehaviorVerified: false, inferenceRequests: requests, isolatedHome: home,
    verified: ['project purpose', 'constraints', 'saved handoff', 'latest next step', 'excluded canary absent'] };
  await writeFile(path.join(home, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
