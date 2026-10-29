import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, readlink, rm, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkNodeVersion } from '../dist/doctor.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
async function fixture(t, git = false) {
  const base = await mkdtemp(path.join(tmpdir(), 'AgentBridge doctor ü-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'project');
  await mkdir(root);
  if (git) {
    const result = spawnSync('git', ['init', '--initial-branch=main'], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
  }
  return { base, root };
}
function run(root, args, expected = 0, env = process.env) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8', env, windowsHide: true, timeout: 30_000 });
  assert.equal(result.status, expected, result.stderr + result.stdout);
  return result.stdout;
}
function doctor(root, expected = 0, env = process.env) {
  const report = JSON.parse(run(root, ['doctor', '--json'], expected, env));
  assert.equal(report.version, 1);
  assert.equal(report.summary.errors, report.checks.filter(c => c.severity === 'error').length);
  assert.equal(report.summary.warnings, report.checks.filter(c => c.severity === 'warning').length);
  assert.ok(!JSON.stringify(report).includes(root));
  return report;
}
const has = (report, code) => report.checks.some(c => c.code === code);
async function put(root, name, text) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), text);
}
async function snapshot(root) {
  const files = {};
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) files[name] = { link: await readlink(full) };
      else if (entry.isDirectory()) { files[name] = { directory: true }; await visit(full, name + '/'); }
      else files[name] = (await readFile(full)).toString('base64');
    }
  }
  await visit(root);
  return files;
}
async function unchanged(root, operation) {
  const before = await snapshot(root);
  const result = operation();
  assert.deepEqual(await snapshot(root), before, 'doctor must preserve all files and directory entries, including Git metadata');
  return result;
}

test('doctor distinguishes unsupported, tested and untested Node lines', () => {
  for (const version of ['20.19.0', '22.17.9']) assert.equal(checkNodeVersion(version).severity, 'error');
  for (const version of ['22.18.0', '22.99.0', '24.0.0']) assert.equal(checkNodeVersion(version).severity, 'ok');
  for (const version of ['23.0.0', '25.0.0']) assert.equal(checkNodeVersion(version).severity, 'warning');
});

test('doctor explains unavailable project roots without creating or disclosing them', async t => {
  const { root } = await fixture(t);
  const missing = path.join(root, 'missing ü');
  assert.ok(has(await unchanged(root, () => doctor(missing, 2)), 'project-unavailable'));
  await put(root, 'regular-file', 'Not a directory');
  assert.ok(has(await unchanged(root, () => doctor(path.join(root, 'regular-file'), 2)), 'project-unavailable'));
});

test('doctor guides an uninitialized project and rejects write options without side effects', async t => {
  const { root } = await fixture(t);
  const report = await unchanged(root, () => doctor(root));
  assert.ok(has(report, 'context-missing'));
  assert.ok(has(report, 'no-repository'));
  const text = await unchanged(root, () => run(root, ['doctor']));
  assert.match(text, /Run init/);
  assert.match(text, /No files changed/);
  assert.match(text, /loading.*were not checked/);
  for (const options of [['--save'], ['--approve-overwrite', 'CLAUDE.md'], ['--dry-run']]) {
    await unchanged(root, () => run(root, ['doctor', ...options], 2));
  }
});

test('doctor reports healthy sync without touching files, Git metadata or private canaries', async t => {
  const { root } = await fixture(t, true);
  run(root, ['init']);
  run(root, ['handoff', '--save', '--from', 'codex', '--to', 'claude', '--next', 'Add an offline fixture']);
  run(root, ['sync']);
  await put(root, '.env', 'SYNTHETIC_PRIVATE_CANARY');
  await put(root, 'private/chat.jsonl', 'SYNTHETIC_PRIVATE_CANARY');
  const report = await unchanged(root, () => doctor(root));
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 0);
  assert.ok(has(report, 'git-ready'));
  assert.ok(has(report, 'handoff-present'));
  assert.equal(report.checks.filter(c => c.code === 'output-unchanged').length, 3);
  assert.ok(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE_CANARY'));
});

test('doctor reports absent notes, new files, unmanaged instructions, updates and conflicts', async t => {
  const { root } = await fixture(t);
  run(root, ['init']);
  await put(root, 'CLAUDE.md', '# Team rule\r\nKeep the API stable.\r\n');
  let report = await unchanged(root, () => doctor(root));
  assert.ok(has(report, 'handoff-missing'));
  assert.equal(report.checks.filter(c => c.code === 'output-create').length, 2);
  assert.ok(has(report, 'output-unmanaged'));
  run(root, ['sync', '--approve-overwrite', 'CLAUDE.md']);
  await put(root, '.agentbridge/context.md', '# Reviewed new goal\n');
  report = await unchanged(root, () => doctor(root));
  assert.equal(report.checks.filter(c => c.code === 'output-update').length, 3);
  const generated = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
  await put(root, 'CLAUDE.md', generated.replace('Describe the next outcome', 'Local managed edit'));
  report = await unchanged(root, () => doctor(root));
  const conflict = report.checks.find(c => c.code === 'output-conflict');
  assert.match(conflict.message, /CLAUDE.md/);
  assert.match(conflict.hint, /--approve-overwrite CLAUDE.md/);
  assert.ok(!JSON.stringify(report).includes('Local managed edit'));
});

test('doctor refuses invalid content/state/markers without exposing bytes or making repairs', async t => {
  const cases = [
    ['.agentbridge/context.md', '', 'sync-preflight-blocked'],
    ['.agentbridge/context.md', 'password' + '=' + 'SYNTHETIC_PRIVATE_CANARY', 'sync-preflight-blocked'],
    ['.agentbridge/context.md', Buffer.from([0xff]), 'context-blocked'],
    ['.agentbridge/context.md', 'x'.repeat(25 * 1024), 'context-blocked'],
    ['.agentbridge/state.json', 'SYNTHETIC_PRIVATE_CANARY', 'sync-preflight-blocked'],
    ['CLAUDE.md', '<!-- agentbridge:begin -->\nSYNTHETIC_PRIVATE_CANARY', 'sync-preflight-blocked'],
  ];
  for (const [file, content, code] of cases) await t.test(file + ':' + code, async st => {
    const { root } = await fixture(st);
    run(root, ['init']);
    await put(root, file, content);
    const report = await unchanged(root, () => doctor(root, 2));
    assert.ok(has(report, code));
    assert.ok(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE_CANARY'));
  });
});

test('doctor respects ignored context, ignored notes and custom output exclusions', async t => {
  for (const file of ['.agentbridge/context.md', '.agentbridge/handoff.md', 'GEMINI.md']) await t.test(file, async st => {
    const { root } = await fixture(st, true);
    run(root, ['init']);
    await put(root, '.agentbridge/handoff.md', 'SYNTHETIC_PRIVATE_CANARY');
    if (file === 'GEMINI.md') await put(root, '.agentbridgeignore', 'GEMINI.md\n');
    else await put(root, '.gitignore', file + '\n');
    const report = await unchanged(root, () => doctor(root, 2));
    assert.ok(has(report, file.endsWith('context.md') ? 'context-blocked' : 'sync-preflight-blocked'));
    assert.ok(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE_CANARY'));
  });
});

test('doctor does not read nested project context when a Git root is required', async t => {
  const { root } = await fixture(t, true);
  const nested = path.join(root, 'src');
  await put(nested, '.agentbridge/context.md', Buffer.from([0xff]));
  const report = await unchanged(root, () => doctor(nested, 2));
  assert.ok(has(report, 'project-not-root'));
  assert.ok(!report.checks.some(c => c.code.startsWith('context-')));
});

test('missing Git allows plain context but cannot bypass Git/ignore boundaries', async t => {
  const { root, base } = await fixture(t);
  run(root, ['init']);
  const noGit = { ...process.env };
  for (const key of Object.keys(noGit)) if (key.toLowerCase() === 'path') delete noGit[key];
  const emptyPath = path.join(base, 'empty-path'); await mkdir(emptyPath);
  noGit.PATH = emptyPath;
  let report = await unchanged(root, () => doctor(root, 0, noGit));
  assert.ok(has(report, 'missing-git'));
  assert.ok(has(report, 'context-valid'));
  await put(root, '.gitignore', '.agentbridge/context.md\n');
  report = await unchanged(root, () => doctor(root, 2, noGit));
  assert.ok(has(report, 'context-blocked'));
});

test('doctor accepts canonical and aliased roots but refuses descendant junctions', async t => {
  const { root, base } = await fixture(t, true);
  run(root, ['init']);
  const alias = path.join(base, 'alias');
  await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const canonical = await unchanged(base, () => doctor(root));
  const aliased = await unchanged(base, () => doctor(alias));
  assert.deepEqual(aliased, canonical);
  const outside = path.join(base, 'outside'); await mkdir(outside);
  await put(outside, 'context.md', 'SYNTHETIC_PRIVATE_CANARY');
  await rm(path.join(root, '.agentbridge'), { recursive: true });
  await symlink(outside, path.join(root, '.agentbridge'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.ok(has(await unchanged(base, () => doctor(root, 2)), 'context-blocked'));
});

test('doctor rejects hard-linked context and outputs without altering either endpoint', async t => {
  for (const file of ['.agentbridge/context.md', 'AGENTS.md']) await t.test(file, async st => {
    const { root, base } = await fixture(st);
    run(root, ['init']);
    const outside = path.join(base, 'outside.md'); await writeFile(outside, '# SYNTHETIC_PRIVATE_CANARY\n');
    await rm(path.join(root, file), { force: true });
    await link(outside, path.join(root, file));
    const report = await unchanged(base, () => doctor(root, 2));
    assert.ok(has(report, file.startsWith('.agentbridge') ? 'context-blocked' : 'sync-preflight-blocked'));
    assert.ok(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE_CANARY'));
  });
});

test('doctor reports locks without opening/removing them and rejects unsafe lock paths', async t => {
  const { root, base } = await fixture(t);
  run(root, ['init']);
  await put(root, '.agentbridge/lock', 'SYNTHETIC_PRIVATE_CANARY');
  const report = await unchanged(root, () => doctor(root));
  assert.ok(has(report, 'sync-lock-present'));
  assert.ok(!JSON.stringify(report).includes('SYNTHETIC_PRIVATE_CANARY'));
  await link(path.join(root, '.agentbridge/lock'), path.join(base, 'lock-copy'));
  assert.ok(has(await unchanged(base, () => doctor(root, 2)), 'sync-lock-unsafe'));
});
