import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sensitive, relativePath, exclusionMatcher, assertSafeText, normalize, safePath, readText, writeText, MAX_TEXT } from '../dist/safety.js';
import { renderInstructions, initialContext } from '../dist/context.js';

test('cross-platform path validation and sensitive-file exclusions', () => {
  assert.equal(relativePath('src\\hello world.ts'), 'src/hello world.ts');
  for (const name of ['C:\\keys\\key.pem', '//server/share', '../outside', 'a/../b', 'a\nsecret', 'a`file', 'a//b',
    'src/file:stream', 'NUL.md', 'src/a.', 'dir/a ']) {
    assert.throws(() => relativePath(name));
  }
  for (const name of ['.env', '.env.example', 'config/.env.prod', '.ssh/id_rsa', 'server.key', 'secret.json',
    'credentials.json', 'tokens/access_token.txt', '.claude/history.jsonl', '.codex/sessions/log.jsonl',
    'node_modules/a.js', 'src/password.txt', 'foo.env', 'config.local.json', 'private/customer.txt',
    'service-account.json', 'serviceAccountKey.json', 'auth.json', 'kubeconfig', 'prod.tfstate', 'AuthKey.p8']) {
    assert.equal(sensitive(name), true, name);
  }
  for (const name of ['src/main.ts', 'docs/user-guide.md', '.github/workflows/ci.yml', 'package.json']) {
    assert.equal(sensitive(name), false, name);
  }
});

test('additive exclusions support anchored, directory, globstar and basename patterns', () => {
  const excluded = exclusionMatcher('# comment\ninternal/\n**/customer-*.json\n/design/*.md\n*.snap\n**/draft?.md');
  for (const name of ['internal/x/a', 'src/internal/x', 'customer-one.json', 'src/customer-a.json',
    'design/a.md', 'test/a.snap', 'draft1.md', 'docs/draft2.md']) assert.equal(excluded(name), true, name);
  for (const name of ['src/design/a.md', 'design/sub/a.md', 'src/main.ts']) assert.equal(excluded(name), false, name);
  for (const pattern of ['!private/', '../foo', '*.[' , 'src\\secret']) assert.throws(() => exclusionMatcher(pattern));
});

test('credential and import guard refuses propagation without echoing input', () => {
  for (const content of ['sk-' + 'a'.repeat(30), 'password=abcdefgh123', '-----BEGIN PRIVATE KEY-----',
    '@./private.md', 'See @docs/private.md', '@C:\\secrets.txt', '@~/notes.md', 'x\u001b[2J']) {
    assert.throws(() => assertSafeText(content));
  }
  assert.throws(() => assertSafeText('a'.repeat(MAX_TEXT + 1)));
  assert.doesNotThrow(() => assertSafeText('Use TypeScript. Contact developer@example.org.'));
});

test('generation is stable, normalized and uses ordinary inline Markdown for every agent', () => {
  const source = normalize('# Demo\r\n\r\nRun `pnpm test`.\r\n');
  for (const target of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
    const first = renderInstructions(target, source, '## Next\n\n- Verify tests.\n');
    assert.equal(first, renderInstructions(target, source, '## Next\n\n- Verify tests.\n'));
    assert.ok(first.includes('Run `pnpm test`.'));
    assert.ok(first.includes('Verify tests.'));
    assert.ok(!first.includes('\r'));
    assert.ok(Buffer.byteLength(first) < 32768);
  }
  assert.ok(initialContext().includes('Decisions and constraints'));
});

test('filesystem safety rejects linked paths, stale writes, oversized and invalid UTF-8 inputs', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'agentbridge-safe-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeText(root, 'a.txt', 'old');
  await assert.rejects(writeText(root, 'a.txt', 'new'));
  await assert.rejects(writeText(root, 'a.txt', 'new', 'stale'));
  await writeText(root, 'a.txt', 'new', 'old');
  assert.equal(await readFile(path.join(root, 'a.txt'), 'utf8'), 'new');
  await writeFile(path.join(root, 'oversized'), 'x'.repeat(MAX_TEXT + 1));
  await assert.rejects(readText(root, 'oversized'));
  await writeFile(path.join(root, 'binary'), Buffer.from([0xff, 0xfe]));
  await assert.rejects(readText(root, 'binary'));
  await writeFile(path.join(root, 'bom.md'), '\ufeff# Context\r\n');
  assert.equal(await readText(root, 'bom.md'), '\ufeff# Context\r\n');
  await link(path.join(root, 'a.txt'), path.join(root, 'hardlink'));
  await assert.rejects(readText(root, 'hardlink'));
  await mkdir(path.join(root, 'real'));
  // Junctions work on Windows without Developer Mode.
  await symlink(path.join(root, 'real'), path.join(root, 'linked'), 'junction');
  await assert.rejects(safePath(root, 'linked/context.md'));
});
