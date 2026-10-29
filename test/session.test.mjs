import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectSession, reviewedSession, sessionProject } from '../dist/session.js';
import { installCodexSkill, CODEX_SKILL, SKILL_PATH } from '../dist/codex.js';
import { digest, projectRoot } from '../dist/safety.js';
import { CONTEXT, HANDOFF, TARGETS } from '../dist/context.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const input = JSON.stringify({ to: 'claude', purpose: 'Normalize postal codes offline.',
  done: ['Implemented empty-input validation; synthetic test runner reported two passing tests.'],
  next: ['Add a Unicode fixture; verify the test command before running it.'],
  blocked: ['Carrier sandbox unavailable; use offline fixtures.'] });
async function fixture(t, git = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'AgentBridge session ü space-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (git) runGit(root, ['init', '--initial-branch=main']);
  return root;
}
function runGit(root, args) {
  const result = spawnSync('git', ['-c', 'core.hooksPath=.git/no-hooks', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
}
const get = (root, name) => readFile(path.join(root, name), 'utf8');
const put = (root, name, text) => writeFile(path.join(root, name), text);

test('session finds the canonical Git root from a nested working directory, preserving explicit boundaries', async t => {
  const root = await fixture(t, true);
  const nested = path.join(root, 'src', 'nested ü'); await mkdir(nested, { recursive: true });
  const detected = await sessionProject(nested);
  assert.equal(detected.root, await projectRoot(root));
  await assert.rejects(sessionProject(nested, true), /ignore rules/);
  const alias = path.join(await fixture(t), 'root alias');
  await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await sessionProject(alias)).root, detected.root);
  if (process.platform === 'win32') assert.equal((await sessionProject(root.toUpperCase())).root, detected.root);
});

test('preview requires content-bound approval; save prepares all three targets without manual initialization', async t => {
  const root = await fixture(t); const git = await sessionProject(root);
  const preview = await reviewedSession(git, input);
  assert.equal(preview.applied, false); assert.match(preview.summary, /Next steps/);
  assert.deepEqual(await readdir(root), []);
  await assert.rejects(reviewedSession(git, input, 'yes'), /does not match/);
  assert.deepEqual(await readdir(root), []);
  const applied = await reviewedSession(git, input, preview.approval);
  assert.equal(applied.applied, true);
  for (const name of [CONTEXT, HANDOFF, ...TARGETS]) assert.ok((await get(root, name)).length);
  assert.match(await get(root, 'CLAUDE.md'), /Unicode fixture/);
  assert.match(applied.continuation, /fresh session/);
});

test('changed instructions and managed conflicts invalidate approval and preserve exact user bytes', async t => {
  const root = await fixture(t); const git = await sessionProject(root);
  const user = '\ufeff# Team rule\r\nKeep the public API stable.\r\n';
  await put(root, 'CLAUDE.md', user);
  const preview = await reviewedSession(git, input);
  assert.equal(preview.files.find(f => f.file === 'CLAUDE.md').status, 'unmanaged');
  await put(root, 'CLAUDE.md', user + 'New constraint.\r\n');
  await assert.rejects(reviewedSession(git, input, preview.approval), /does not match/);
  await assert.rejects(get(root, CONTEXT), { code: 'ENOENT' });
  const fresh = await reviewedSession(git, input);
  await reviewedSession(git, input, fresh.approval);
  const original = await get(root, 'CLAUDE.md'); assert.ok(original.startsWith(user + 'New constraint.\r\n'));
  const edited = original.replace('Unicode fixture', 'MANUAL MANAGED EDIT');
  await put(root, 'CLAUDE.md', edited);
  const conflict = await reviewedSession(git, input);
  assert.equal(conflict.files.find(f => f.file === 'CLAUDE.md').status, 'conflict');
  assert.equal(await get(root, 'CLAUDE.md'), edited);
  await reviewedSession(git, input, conflict.approval);
  assert.equal(await get(root, `.agentbridge/backups/${digest(edited)}/CLAUDE.md`), edited);
});

test('repeated handoffs preserve canonical context, back up old notes and require a new approval', async t => {
  const root = await fixture(t); const git = await sessionProject(root);
  const first = await reviewedSession(git, input); await reviewedSession(git, input, first.approval);
  const context = await get(root, CONTEXT), old = await get(root, HANDOFF);
  const second = JSON.stringify({ to: 'gemini', next: ['Review Unicode fixture; test result is unknown.'] });
  await assert.rejects(reviewedSession(git, second, first.approval), /does not match/);
  assert.equal(await get(root, HANDOFF), old);
  const preview = await reviewedSession(git, second);
  await reviewedSession(git, second, preview.approval);
  assert.equal(await get(root, CONTEXT), context);
  assert.equal(await get(root, `.agentbridge/backups/${digest(old)}/${HANDOFF}`), old);
  assert.match(await get(root, 'GEMINI.md'), /To: Gemini CLI/);
});

test('missing information, invalid inputs and directories fail without writing or echoing candidate text', async t => {
  const root = await fixture(t); const git = await sessionProject(root);
  for (const value of ['{bad', '[]', '{}', '{"to":"claude","next":[]}', '{"to":"claude","next":["Do work"]}',
    '{"to":"claude","purpose":"p","next":[" "]}', '{"to":"codex","purpose":"p","next":["Do work"]}',
    '{"to":"gemini","purpose":"p","next":["Do work"],"extra":true}']) {
    await assert.rejects(reviewedSession(git, value));
  }
  assert.deepEqual(await readdir(root), []);
  await assert.rejects(sessionProject(path.join(root, 'missing')), /existing project/);
  await put(root, 'file', 'not a directory');
  await assert.rejects(sessionProject(path.join(root, 'file')), /existing project/);
});

test('Git inspection excludes tracked secrets, ignored and untracked contents and detects stale Git facts', async t => {
  const root = await fixture(t, true); const git = await sessionProject(root);
  await put(root, '.env', 'SYNTHETIC_PRIVATE_CANARY');
  await put(root, '.gitignore', '.env\nignored.txt\n');
  await put(root, 'ignored.txt', 'SYNTHETIC_PRIVATE_CANARY');
  await put(root, 'untracked.txt', 'SYNTHETIC_PRIVATE_CANARY');
  await put(root, 'app.js', 'export const valid = true;\n');
  runGit(root, ['add', '-f', '--', '.env', 'app.js']);
  const report = JSON.stringify(await inspectSession(git));
  assert.ok(!report.includes('.env')); assert.ok(!report.includes('SYNTHETIC_PRIVATE_CANARY'));
  const preview = await reviewedSession(git, input);
  await put(root, 'app.js', 'export const valid = false;\n');
  await assert.rejects(reviewedSession(git, input, preview.approval), /does not match/);
});

test('secret-like notes, old notes and existing instructions are rejected without propagating credentials', async t => {
  const root = await fixture(t); const git = await sessionProject(root);
  const fake = ['password', 'SYNTHETIC_NOT_A_CREDENTIAL'].join('=');
  await assert.rejects(reviewedSession(git, JSON.stringify({ to: 'claude', purpose: 'p', next: [fake] })), /credential/);
  await put(root, 'CLAUDE.md', fake);
  await assert.rejects(reviewedSession(git, input), /credential/);
  await rm(path.join(root, 'CLAUDE.md'));
  await mkdir(path.join(root, '.agentbridge'));
  await put(root, HANDOFF, fake);
  await assert.rejects(reviewedSession(git, input), /credential/);
  assert.equal(await get(root, HANDOFF), fake);
  await assert.rejects(get(root, 'AGENTS.md'), { code: 'ENOENT' });
});

test('excluded control files, linked paths, hard links and malformed markers fail before any save', async t => {
  for (const type of ['ignored', 'junction', 'hard-link', 'markers']) await t.test(type, async st => {
    const root = await fixture(st, type === 'ignored'); const outside = await fixture(st);
    if (type === 'ignored') await put(root, '.gitignore', 'CLAUDE.md\n');
    if (type === 'junction') await symlink(outside, path.join(root, '.agentbridge'), process.platform === 'win32' ? 'junction' : 'dir');
    if (type === 'hard-link') { await put(outside, 'user.md', 'Keep this'); await link(path.join(outside, 'user.md'), path.join(root, 'CLAUDE.md')); }
    if (type === 'markers') await put(root, 'CLAUDE.md', '<!-- agentbridge:begin -->\nBroken');
    const git = await sessionProject(root).catch(e => e);
    if (git instanceof Error) assert.equal(type, 'junction');
    else await assert.rejects(reviewedSession(git, input));
    await assert.rejects(get(root, HANDOFF), { code: 'ENOENT' });
    assert.deepEqual((await readdir(outside)).filter(f => f !== 'user.md'), []);
  });
});

test('CLI stdin preview and exact approval integrate without a draft file; oversized/invalid UTF-8 rejected', async t => {
  const root = await fixture(t);
  function run(args, data, status = 0) {
    const result = spawnSync(process.execPath, [cli, 'session', ...args], { cwd: root, input: data, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, status, result.stderr); return result;
  }
  assert.equal(JSON.parse(run(['--inspect']).stdout).context, null);
  const preview = JSON.parse(run([], input).stdout);
  run(['--approve', ''], input, 2);
  run([], Buffer.from([0xff, 0xfe]), 2);
  run([], 'x'.repeat(25 * 1024), 2);
  assert.deepEqual(await readdir(root), []);
  const applied = JSON.parse(run(['--approve', preview.approval], input).stdout);
  assert.equal(applied.applied, true);
});

test('one-time skill installation is idempotent, supports dry runs, refuses replacement and linked destinations', async t => {
  const home = await fixture(t);
  await installCodexSkill(home, true); assert.deepEqual(await readdir(home), []);
  await installCodexSkill(home); assert.equal(await get(home, SKILL_PATH), CODEX_SKILL);
  await installCodexSkill(home); await put(home, SKILL_PATH, '# User skill\n');
  await assert.rejects(installCodexSkill(home), /never overwrites/);
  assert.equal(await get(home, SKILL_PATH), '# User skill\n');
  const linked = await fixture(t), outside = await fixture(t);
  await symlink(outside, path.join(linked, '.agents'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installCodexSkill(linked)); assert.deepEqual(await readdir(outside), []);
});

test('default skill installer respects isolated CODEX_HOME and refuses to replace personal content', async t => {
  const home = await fixture(t);
  const env = { ...process.env, CODEX_HOME: home };
  const run = (...args) => spawnSync(process.execPath, [cli, 'install-skill', ...args], { env, encoding: 'utf8', windowsHide: true });
  assert.equal(run('--dry-run').status, 0); assert.deepEqual(await readdir(home), []);
  assert.equal(run().status, 0); assert.equal(await get(home, 'skills/agentbridge-handoff/SKILL.md'), CODEX_SKILL);
  assert.equal(run().status, 0);
  await put(home, 'skills/agentbridge-handoff/SKILL.md', 'User-maintained skill');
  assert.equal(run().status, 2); assert.equal(await get(home, 'skills/agentbridge-handoff/SKILL.md'), 'User-maintained skill');
});
