import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { digest, projectRoot } from '../dist/safety.js';
import { ProjectGit } from '../dist/git.js';
import { planSync, applySync } from '../dist/sync.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const targets = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
const approve = ['--approve-overwrite', targets.join(',')];

async function fixture(t, git = true) {
  const root = await mkdtemp(path.join(tmpdir(), 'AgentBridge space ü-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (git) {
    gitRun(root, 'init', '--initial-branch=main');
    gitRun(root, 'config', 'user.email', 'synthetic@example.invalid');
    gitRun(root, 'config', 'user.name', 'Synthetic Test');
    gitRun(root, 'config', 'commit.gpgsign', 'false');
    gitRun(root, 'config', 'core.autocrlf', 'false');
    gitRun(root, 'config', 'core.hooksPath', path.join(root, '.git', 'agentbridge-no-hooks'));
  }
  return root;
}
function gitRun(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}
function run(root, args, expected = 0, env = process.env) {
  const format = ['sync', 'status'].includes(args[0]) ? ['--json'] : [];
  const result = spawnSync(process.execPath, [cli, ...args, ...format, '--project', root], { encoding: 'utf8', env, windowsHide: true });
  assert.equal(result.status, expected, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout + result.stderr;
}
async function put(root, name, content) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), content);
}
const get = (root, name) => readFile(path.join(root, name), 'utf8');
async function snapshot(root) {
  const result = {};
  async function visit(dir, prefix = '') {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (item.name === '.git') continue;
      const name = prefix + item.name;
      if (item.isDirectory()) await visit(path.join(dir, item.name), name + '/');
      else result[name] = digest(await get(root, name));
    }
  }
  await visit(root);
  return result;
}

test('initialization dry-run performs no writes, re-init preserves editable context', async t => {
  const root = await fixture(t, false);
  run(root, ['init', '--dry-run']);
  assert.deepEqual(await readdir(root), []);
  run(root, ['init']);
  await put(root, '.agentbridge/context.md', '# User rules\n\nUse TypeScript.\n');
  run(root, ['init']);
  assert.equal(await get(root, '.agentbridge/context.md'), '# User rules\n\nUse TypeScript.\n');
});

test('complete offline flow: initialize, notes, sync, status and idempotence', async t => {
  const root = await fixture(t);
  await put(root, 'src/index.ts', 'export const answer = 42;');
  gitRun(root, 'add', '.'); gitRun(root, 'commit', '-m', 'Synthetic initial commit');
  run(root, ['init']);
  await put(root, '.agentbridge/context.md', '# Example\r\n\r\nRun `node --test`.\r\n');
  run(root, ['handoff', '--save', '--done', 'Implemented parser', '--next', 'Check Windows paths']);
  const before = await snapshot(root);
  const preview = JSON.parse(run(root, ['sync', '--dry-run']));
  assert.equal(preview.files.length, 3);
  assert.ok(preview.files.every(f => f.status === 'create'));
  assert.deepEqual(await snapshot(root), before);
  run(root, ['sync']); run(root, ['status']); run(root, ['sync', '--check']);
  const synced = await snapshot(root);
  run(root, ['sync']);
  assert.deepEqual(await snapshot(root), synced);
  for (const target of targets) {
    const content = await get(root, target);
    assert.ok(content.includes('Run `node --test`.'));
    assert.ok(content.includes('Implemented parser'));
    assert.ok(content.includes('Check Windows paths'));
    assert.ok(!content.includes('\r'));
  }
});

test('pre-existing conflicting instructions block the entire sync until explicitly approved', async t => {
  const root = await fixture(t);
  await put(root, 'AGENTS.md', '# Rules\r\nUse Python exclusively.\r\n');
  await put(root, 'CLAUDE.md', '# Rules\nUse Rust exclusively.\n');
  run(root, ['init']);
  const before = await snapshot(root);
  const preview = JSON.parse(run(root, ['sync', '--dry-run']));
  assert.equal(preview.files[0].status, 'unmanaged');
  run(root, ['sync'], 2);
  run(root, ['sync', '--approve-overwrite', 'AGENTS.md'], 2);
  assert.deepEqual(await snapshot(root), before);
  run(root, ['sync', ...approve]);
  const original = '# Rules\r\nUse Python exclusively.\r\n';
  assert.equal(await get(root, `.agentbridge/backups/${digest(original)}/AGENTS.md`), original);
});

test('all updates need fresh explicit approval, and edits are reported as conflicts', async t => {
  const root = await fixture(t);
  run(root, ['init']); run(root, ['sync']);
  await put(root, '.agentbridge/context.md', '# Changed\nUse Rust.\n');
  run(root, ['status'], 1);
  let preview = JSON.parse(run(root, ['sync', '--dry-run']));
  assert.ok(preview.files.every(f => f.status === 'update'));
  run(root, ['sync'], 2);
  await put(root, 'GEMINI.md', 'Use Python.\n');
  preview = JSON.parse(run(root, ['sync', '--dry-run']));
  assert.equal(preview.files[2].status, 'conflict');
  run(root, ['sync', ...approve]); run(root, ['status']);
});

test('check and status do not write lock, backups, state or instructions', async t => {
  const root = await fixture(t);
  run(root, ['init']);
  const before = await snapshot(root);
  run(root, ['status'], 1); run(root, ['sync', '--check'], 1);
  assert.deepEqual(await snapshot(root), before);
});

test('discovery and progress exclude ignored, sensitive, untracked and private agent paths', async t => {
  const root = await fixture(t);
  const canary = 'PRIVATE_CANARY_7cda_do_not_ingest';
  for (const file of ['package.json', 'src/main.ts', 'ignored/hidden.ts', '.env', 'credentials.json',
    'server.key', 'service-account.json', 'auth.json', '.claude/sessions/chat.jsonl', '.codex/sessions/chat.jsonl', '.gemini/history.json', 'custom/proprietary.md']) {
    await put(root, file, canary);
  }
  gitRun(root, 'add', '-f', '.'); gitRun(root, 'commit', '-m', canary);
  await put(root, '.gitignore', 'ignored/\n');
  await put(root, '.agentbridgeignore', 'custom/\n');
  await put(root, 'untracked.txt', canary);
  await put(root, '.env', canary + 'updated');
  const discovery = run(root, ['discover']);
  const progress = run(root, ['progress']);
  for (const output of [discovery, progress]) {
    assert.ok(!output.includes(canary));
    for (const name of ['hidden.ts', '.env', 'credentials.json', 'server.key', 'service-account.json', 'auth.json', 'chat.jsonl', 'history.json', 'proprietary.md', 'untracked.txt']) {
      assert.ok(!output.includes(name), name);
    }
    assert.ok(output.includes('src/main.ts'));
  }
  assert.ok(JSON.parse(discovery).markers.includes('package.json'));
});

test('unborn Git repository, tracked deletions and Unicode paths produce useful progress', async t => {
  const root = await fixture(t);
  await put(root, 'src/hello world ü.ts', 'one');
  gitRun(root, 'add', '.');
  assert.ok(run(root, ['progress']).includes('hello world ü.ts'));
  gitRun(root, 'commit', '-m', 'first');
  await rm(path.join(root, 'src/hello world ü.ts'));
  assert.ok(run(root, ['progress']).includes('` D`'));
});

test('a rename from a sensitive source is omitted from current status', async t => {
  const root = await fixture(t);
  await put(root, 'secret.txt', 'same content');
  gitRun(root, 'add', '.'); gitRun(root, 'commit', '-m', 'initial');
  gitRun(root, 'mv', 'secret.txt', 'public.txt');
  const progress = run(root, ['progress']);
  assert.ok(!progress.includes('secret.txt'));
  assert.ok(!progress.includes('public.txt'));
});

test('ignored canonical input and outputs fail closed even with overwrite approval', async t => {
  const root = await fixture(t);
  run(root, ['init']);
  await put(root, '.gitignore', 'CLAUDE.md\n');
  await put(root, 'CLAUDE.md', 'private instructions');
  const output = run(root, ['sync', ...approve], 2);
  assert.ok(!output.includes('private instructions'));
  await put(root, '.gitignore', '.agentbridge/\n');
  run(root, ['sync', '--dry-run'], 2);
});

test('non-Git folder and missing Git degrade gracefully without scanning files', async t => {
  const root = await fixture(t, false);
  await put(root, 'package.json', 'private contents');
  run(root, ['init']); run(root, ['sync']);
  assert.deepEqual(JSON.parse(run(root, ['discover'])).trackedFiles, []);
  assert.ok(run(root, ['progress']).includes('no-repository'));
  const env = { ...process.env, PATH: '', Path: '' };
  assert.ok(run(root, ['progress'], 0, env).includes('missing-git'));
  run(root, ['status'], 0, env);
  await put(root, '.gitignore', '.agentbridge/\n');
  run(root, ['sync', '--dry-run'], 2);
});

test('selecting a nested folder does not silently use parent repository context', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'child'));
  assert.ok(run(path.join(root, 'child'), ['progress']).includes('not-root'));
  run(path.join(root, 'child'), ['init'], 2);
});

test('manual notes require intent, replacements require approval and dry-run never writes', async t => {
  const root = await fixture(t, false);
  run(root, ['init']);
  run(root, ['handoff', '--next', 'Review'], 2);
  run(root, ['handoff', '--save'], 2);
  const before = await snapshot(root);
  run(root, ['handoff', '--save', '--next', 'Review', '--dry-run']);
  assert.deepEqual(await snapshot(root), before);
  run(root, ['handoff', '--save', '--next', 'Review']);
  run(root, ['handoff', '--save', '--next', 'Test'], 2);
  run(root, ['handoff', '--save', '--next', 'Test', '--replace-note']);
  assert.ok(run(root, ['handoff']).includes('Test'));
});

test('credential-like context, manual notes and imports are rejected without echoing credentials', async t => {
  const root = await fixture(t);
  run(root, ['init']);
  const token = 'sk-' + 'x'.repeat(30);
  const output = run(root, ['handoff', '--save', '--done', token], 2);
  assert.ok(!output.includes(token));
  for (const content of [token, '@README', 'Read @./private.md', '']) {
    await put(root, '.agentbridge/context.md', content);
    const error = run(root, ['sync', '--dry-run'], 2);
    assert.ok(!error.includes(token));
  }
});

test('corrupt state, excluded outputs, held locks and linked output paths are rejected', async t => {
  const root = await fixture(t);
  run(root, ['init']);
  await put(root, '.agentbridge/state.json', '{broken');
  run(root, ['sync'], 2);
  await rm(path.join(root, '.agentbridge/state.json'));
  await put(root, '.agentbridgeignore', '/GEMINI.md\n');
  run(root, ['sync', '--dry-run'], 2);
  await rm(path.join(root, '.agentbridgeignore'));
  await put(root, '.agentbridge/lock', '');
  run(root, ['sync'], 2);
  await rm(path.join(root, '.agentbridge/lock'));
  await mkdir(path.join(root, 'elsewhere'));
  await symlink(path.join(root, 'elsewhere'), path.join(root, 'AGENTS.md'), 'junction');
  run(root, ['sync', ...approve], 2);
});

test('a canonical change after planning aborts without touching any output', async t => {
  const root = await fixture(t);
  run(root, ['init']);
  const git = new ProjectGit(await projectRoot(root)); await git.initialize();
  const plan = await planSync(git);
  await put(root, '.agentbridge/context.md', '# New content\n');
  const before = await snapshot(root);
  await assert.rejects(applySync(git, plan, []), /changed after preview/);
  assert.deepEqual(await snapshot(root), before);
});

test('unknown flags, wildcard approvals and irrelevant options fail without writes', async t => {
  const root = await fixture(t, false);
  for (const args of [['init', '--force'], ['sync', '--approve-overwrite', '*'], ['init', '--save'], ['no-such-command']]) run(root, args, 2);
  assert.deepEqual(await readdir(root), []);
});

test('plain-folder custom exclusions and empty manual notes cannot bypass policy', async t => {
  const root = await fixture(t, false);
  run(root, ['init']);
  run(root, ['handoff', '--save', '--next', '  '], 2);
  await put(root, '.agentbridgeignore', '/GEMINI.md\n');
  run(root, ['sync', '--dry-run'], 2);
});

test('UTF-8 BOM and CRLF are preserved in exact backups', async t => {
  const root = await fixture(t);
  run(root, ['init']);
  const original = '\ufeff# Existing instructions\r\nUse Python.\r\n';
  await put(root, 'AGENTS.md', original);
  run(root, ['sync', '--approve-overwrite', 'AGENTS.md']);
  const backup = await readFile(path.join(root, `.agentbridge/backups/${digest(original)}/AGENTS.md`));
  assert.deepEqual(backup, Buffer.from(original));
});

test('Git worktrees and inherited repository overrides remain scoped to selected project', async t => {
  const root = await fixture(t);
  await put(root, 'src/demo.ts', 'export const demo = true;');
  gitRun(root, 'add', '.'); gitRun(root, 'commit', '-m', 'initial');
  const worktree = path.join(root, 'separate worktree');
  gitRun(root, 'worktree', 'add', '--detach', worktree, 'HEAD');
  run(worktree, ['init']); run(worktree, ['sync']); run(worktree, ['status']);
  assert.ok(JSON.parse(run(worktree, ['discover'])).trackedFiles.includes('src/demo.ts'));
  const env = { ...process.env, GIT_DIR: path.join(root, 'not-a-repository') };
  assert.ok(run(worktree, ['progress'], 0, env).includes('ready'));
});

test('tampered baseline never authorizes an existing instruction replacement', async t => {
  const root = await fixture(t, false);
  run(root, ['init']); run(root, ['sync']);
  const changed = '# Local override\nUse Python.\n';
  await put(root, 'AGENTS.md', changed);
  const state = JSON.parse(await get(root, '.agentbridge/state.json'));
  state.outputs['AGENTS.md'] = digest(changed);
  await put(root, '.agentbridge/state.json', JSON.stringify(state));
  run(root, ['sync'], 2);
  assert.equal(await get(root, 'AGENTS.md'), changed);
});

test('missing Git cannot bypass ignored context by selecting a repository child', async t => {
  const root = await fixture(t);
  const child = path.join(root, 'child');
  await mkdir(child);
  const env = { ...process.env, PATH: '', Path: '' };
  run(child, ['init'], 2, env);
  assert.deepEqual(await readdir(child), []);
});
