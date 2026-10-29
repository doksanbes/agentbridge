// Developer-only validation. No agent is invoked and no account is used.
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(workspace, 'dist/cli.js');
await mkdir(path.join(workspace, '.cache'), { recursive: true });
const artifacts = await mkdtemp(path.join(workspace, '.cache', 'workflow-evidence-'));
const project = await mkdtemp(path.join(tmpdir(), 'AgentBridge ParcelKit ü '));
const put = async (name, text) => {
  await mkdir(path.dirname(path.join(project, name)), { recursive: true });
  await writeFile(path.join(project, name), text);
};
const get = name => readFile(path.join(project, name), 'utf8');
function execute(binary, args, cwd = project, expected = 0) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  assert.equal(result.status, expected, `${binary} ${args[0]} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
const git = (...args) => execute('git', args);
const bridge = (args, expected = 0) => execute(process.execPath, [cli, ...args, '--project', project], project, expected);
git('init', '--initial-branch=main');
git('config', 'user.name', 'Synthetic Workflow'); git('config', 'user.email', 'demo@example.invalid');
git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
git('config', 'core.hooksPath', path.join(project, '.git', 'agentbridge-no-hooks'));
await put('.gitignore', '.env\nprivate/\n.agentbridge/backups/\n.agentbridge/lock\n');
await put('README.md', '# ParcelKit synthetic project\n\nRun `node --test test/parser.test.mjs`.\n');
await put('docs/review.md', '# Review queue\n');
await put('src/parser.mjs', 'export const postalCode = input => input.trim();\n');
await put('test/parser.test.mjs', 'import test from "node:test"; import assert from "node:assert/strict"; import { postalCode } from "../src/parser.mjs"; test("plain", () => assert.equal(postalCode("12345"), "12345"));\n');
git('add', '.'); git('commit', '-m', 'Synthetic baseline');
// Force-track dummy sensitive paths to exercise ignore and filename policies.
await put('.env', 'SYNTHETIC_PRIVATE_CANARY');
await put('service-account.json', 'SYNTHETIC_PRIVATE_CANARY');
git('add', '-f', '.env', 'service-account.json'); git('commit', '-m', 'Synthetic exclusion fixtures');
await put('CLAUDE.md', '# Team instructions\r\n\r\nKeep the public API stable.\r\n');
bridge(['init']);
await put('.agentbridge/context.md', `# ParcelKit

## Purpose
Normalize postal codes offline without carrier calls.

## Verified development command
Run \`node --test test/parser.test.mjs\` from the project root.

## Architecture and constraints
\`src/parser.mjs\` exports \`postalCode(input)\`; \`test/parser.test.mjs\` uses Node's test runner.
Keep the public API stable. Carrier validation remains out of scope until a test sandbox is available.

## Current goal
Complete parser edge cases, fixtures and documentation. Verify the latest handoff's next step against the current tree.
`);

const routes = [
  ['codex', 'claude', 'Reject missing postal codes', 'Add full-width Unicode fixture; run node --test test/parser.test.mjs'],
  ['claude', 'gemini', 'Normalize full-width Unicode postal codes', 'Document the Unicode example in README.md'],
  ['gemini', 'codex', 'Document input/output examples', 'Normalize repeated internal whitespace and add a UK fixture'],
  ['codex', 'gemini', 'Normalize internal whitespace', 'Reject numeric input explicitly and add a regression test'],
  ['gemini', 'claude', 'Reject numeric input explicitly', 'Add null and object regressions, then run the complete suite'],
  ['claude', 'codex', 'Finish null and object regression coverage', 'Review the staged review queue and unstaged README notes before committing'],
];
const results = [];
for (let index = 0; index < routes.length; index++) {
  const [from, to, done, next] = routes[index];
  const stage = index + 1;
  const source = `export function postalCode(input) {
  ${stage >= 5 ? 'if (typeof input !== "string") throw new TypeError("Postal code must be text");' : ''}
  const value = input.trim()${stage >= 2 ? '.normalize("NFKC")' : ''}${stage >= 4 ? '.replace(/\\s+/gu, " ")' : ''};
  if (!value) throw new Error("Missing postal code");
  return value;
}\n`;
  await put('src/parser.mjs', source);
  const cases = [
    'test("plain", () => assert.equal(postalCode("12345"), "12345"));',
    'test("missing", () => assert.throws(() => postalCode("   "), /Missing postal code/));',
    ...(stage >= 2 ? ['test("Unicode", () => assert.equal(postalCode("１２３４５"), "12345"));'] : []),
    ...(stage >= 4 ? ['test("UK whitespace", () => assert.equal(postalCode(" SW1A   1AA "), "SW1A 1AA"));'] : []),
    ...(stage >= 5 ? ['test("numeric", () => assert.throws(() => postalCode(12345), TypeError));'] : []),
    ...(stage >= 6 ? ['test("null", () => assert.throws(() => postalCode(null), TypeError));',
      'test("object", () => assert.throws(() => postalCode({}), TypeError));'] : []),
  ];
  await put('test/parser.test.mjs', 'import test from "node:test"; import assert from "node:assert/strict"; import { postalCode } from "../src/parser.mjs";\n' + cases.join('\n') + '\n');
  if (stage >= 3) await put('README.md', '# ParcelKit\n\n`postalCode("１２３４５")` returns `"12345"`.\n\nRun `node --test test/parser.test.mjs`.\n');
  const tests = execute(process.execPath, ['--test', 'test/parser.test.mjs']);
  git('add', 'src', 'test', 'README.md', 'docs'); git('commit', '-m', `Synthetic stage ${stage}: ${done}`);
  await put('docs/review.md', `# Pending review\n\nStage ${stage}: ${next}\n`); git('add', 'docs/review.md');
  await put('README.md', (await get('README.md')) + `\nPending human review after stage ${stage}.\n`);
  const notesArgs = ['handoff', '--save', '--from', from, '--to', to, '--done', `${done}; ${cases.length} parser tests passed`,
    '--next', next, '--blocked', 'Carrier test sandbox unavailable; use offline fixtures only', ...(index ? ['--replace-note'] : [])];
  const oldNote = await get('.agentbridge/handoff.md').catch(() => undefined);
  bridge([...notesArgs, '--dry-run']);
  assert.equal(await get('.agentbridge/handoff.md').catch(() => undefined), oldNote);
  bridge(notesArgs);
  const preview = bridge(['sync', '--dry-run']);
  const discovery = bridge(['discover']); const progress = bridge(['progress']);
  for (const output of [preview, discovery, progress]) {
    assert.ok(!output.includes('SYNTHETIC_PRIVATE_CANARY'));
    assert.ok(!output.includes('service-account.json')); assert.ok(!output.includes('`.env`'));
  }
  const proposal = JSON.parse(bridge(['sync', '--dry-run', '--json']));
  if (index === 0) {
    bridge(['sync'], 2);
    assert.equal(await get('CLAUDE.md'), '# Team instructions\r\n\r\nKeep the public API stable.\r\n');
  }
  bridge(['sync', '--approve-overwrite', 'AGENTS.md,CLAUDE.md,GEMINI.md']); bridge(['status']);
  assert.ok((await get('CLAUDE.md')).startsWith('# Team instructions\r\n\r\nKeep the public API stable.\r\n'));
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
    const text = await get(file);
    const agent = { 'AGENTS.md': 'Codex', 'CLAUDE.md': 'Claude Code', 'GEMINI.md': 'Gemini CLI' }[file];
    assert.ok(text.includes(`<!-- Generated by AgentBridge 0.1.0 for ${agent}. -->`));
    assert.ok(text.includes(next)); assert.ok(text.includes('## Completed')); assert.ok(text.includes('## Blockers'));
    assert.equal(text.split('<!-- agentbridge:begin -->').length, 2);
    assert.equal(text.split('<!-- agentbridge:end -->').length, 2);
    assert.ok(Buffer.byteLength(text) < 24576);
    await writeFile(path.join(artifacts, `${stage}-${from}-to-${to}-${file}`), text);
  }
  await writeFile(path.join(artifacts, `${stage}-handoff.md`), await get('.agentbridge/handoff.md'));
  await writeFile(path.join(artifacts, `${stage}-preview.txt`), preview);
  await writeFile(path.join(artifacts, `${stage}-tests.txt`), tests);
  results.push({ from, to, completed: done, next, parserTestsPassed: cases.length,
    gitStagedAndUnstaged: progress.includes('staged modified') && progress.includes('unstaged modified'),
    formattedTargets: proposal.files.map(file => file.file), userInstructionPreserved: true });
}
const report = { simulated: true, actualAgentInvocations: 0, node: process.version, project, artifacts, results };
await writeFile(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
