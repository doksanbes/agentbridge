import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sensitive, relativePath, exclusionMatcher, assertSafeText, normalize, safePath, readText, writeText, MAX_TEXT } from '../dist/safety.js';
import { renderInstructions, initialContext } from '../dist/context.js';

async function rootFixture(t) {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'agentbridge-roots ü-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'physical', 'project');
  await mkdir(root, { recursive: true });
  const alias = path.join(base, 'alias');
  await symlink(path.join(base, 'physical'), alias, process.platform === 'win32' ? 'junction' : 'dir');
  return { base, root, aliasedRoot: path.join(alias, 'project') };
}

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
  const resolvedRoot = await realpath(root);
  t.diagnostic(JSON.stringify({ temporaryRootAlreadyCanonical: root === resolvedRoot,
    windowsShortNameSpelling: /~\d+(?:[\\/]|$)/.test(root), macOSVarAlias: root.startsWith('/var/') && resolvedRoot.startsWith('/private/var/') }));
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

test('canonical roots and ancestor aliases resolve existing and missing files to the same project', async t => {
  const { base, root, aliasedRoot } = await rootFixture(t);
  const canonical = await realpath(root);
  assert.notEqual(aliasedRoot, canonical, 'The fixture must exercise a real root alias.');
  // Creation can pass with the old code; the next existing-file check exposed the bug.
  await writeText(aliasedRoot, 'a.txt', 'old');
  assert.equal(await safePath(aliasedRoot, 'a.txt'), path.join(canonical, 'a.txt'));
  assert.equal(await readText(aliasedRoot, 'a.txt'), 'old');
  await writeText(aliasedRoot, 'a.txt', 'new', 'old');
  assert.equal(await readText(root, 'a.txt'), 'new');
  assert.equal(await safePath(aliasedRoot, 'nested/new.txt'), path.join(canonical, 'nested', 'new.txt'));
  await writeText(aliasedRoot, 'nested/new.txt', 'nested');
  assert.equal(await readText(root, 'nested/new.txt'), 'nested');
  // The caller may also explicitly select a root that is itself a link.
  const directAlias = path.join(base, 'selected-project');
  await symlink(root, directAlias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(await safePath(directAlias, 'a.txt'), path.join(canonical, 'a.txt'));
  await assert.rejects(writeText(aliasedRoot, 'a.txt', 'overwrite', 'stale'), /changed during operation/);
  assert.equal(await readText(root, 'a.txt'), 'new');
});

test('aliased roots still reject traversal, descendant links, hard links and unsafe writes', async t => {
  const { base, root, aliasedRoot } = await rootFixture(t);
  const outside = path.join(base, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'protected.txt'), 'outside unchanged');
  await writeFile(path.join(root, 'inside.txt'), 'inside unchanged');
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  await symlink(outside, path.join(root, 'outside-link'), linkType);
  await symlink(root, path.join(root, 'inside-link'), linkType);
  await link(path.join(outside, 'protected.txt'), path.join(root, 'hardlink.txt'));
  for (const selectedRoot of [root, aliasedRoot]) {
    for (const malicious of ['../outside/protected.txt', 'a/../../outside/protected.txt', '..\\outside\\protected.txt',
      path.join(outside, 'protected.txt'), 'C:\\outside\\protected.txt', '\\\\server\\share', 'file:stream']) {
      await assert.rejects(safePath(selectedRoot, malicious), /Unsafe project-relative path/);
      await assert.rejects(writeText(selectedRoot, malicious, 'bad'));
    }
    for (const name of ['outside-link', 'inside-link']) {
      await assert.rejects(safePath(selectedRoot, name), /Unsafe linked/);
      await assert.rejects(readText(selectedRoot, `${name}/protected.txt`), /Unsafe linked/);
      await assert.rejects(writeText(selectedRoot, `${name}/new.txt`, 'bad'), /Unsafe linked/);
    }
    await assert.rejects(readText(selectedRoot, 'hardlink.txt'), /Unsafe linked/);
    await assert.rejects(writeText(selectedRoot, 'hardlink.txt', 'bad', 'outside unchanged'), /Unsafe linked/);
    await assert.rejects(writeText(selectedRoot, 'inside.txt/child.txt', 'bad'), /Unsafe linked/);
  }
  assert.equal(await readFile(path.join(outside, 'protected.txt'), 'utf8'), 'outside unchanged');
  assert.equal(await readFile(path.join(root, 'inside.txt'), 'utf8'), 'inside unchanged');
  await assert.rejects(readFile(path.join(outside, 'new.txt')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(root, 'new.txt')), { code: 'ENOENT' });
});

test('root resolution follows filesystem case semantics without lowercasing distinct directories', async t => {
  const { base } = await rootFixture(t);
  const upper = path.join(base, 'CaseProject');
  const lower = path.join(base, 'caseproject');
  await mkdir(upper);
  let distinct = true;
  try { await mkdir(lower); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    distinct = false; // Case-insensitive filesystem: both spellings select the same root.
  }
  await writeText(upper, 'a.txt', 'upper');
  if (distinct) {
    await writeText(lower, 'a.txt', 'lower');
    assert.equal(await readText(upper, 'a.txt'), 'upper');
    assert.equal(await readText(lower, 'a.txt'), 'lower');
  } else {
    assert.equal(await readText(lower, 'a.txt'), 'upper');
    await writeText(lower, 'a.txt', 'shared', 'upper');
    assert.equal(await readText(upper, 'a.txt'), 'shared');
  }
});

test('root must resolve to an existing directory before any child write', async t => {
  const { base } = await rootFixture(t);
  const missing = path.join(base, 'missing-project');
  await assert.rejects(writeText(missing, 'a.txt', 'bad'), { code: 'ENOENT' });
  await assert.rejects(realpath(missing), { code: 'ENOENT' });
  const file = path.join(base, 'not-a-directory');
  await writeFile(file, 'untouched');
  await assert.rejects(writeText(file, 'a.txt', 'bad'), /Project path must be a directory/);
  assert.equal(await readFile(file, 'utf8'), 'untouched');
});
