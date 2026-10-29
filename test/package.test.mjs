import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, lstat, rm, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageFiles, stagePackage } from '../scripts/package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t) {
  const base = await mkdtemp(path.join(tmpdir(), 'AgentBridge packaging ü-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = path.join(base, 'source'); await mkdir(source);
  for (const file of [...packageFiles.filter(f => !['README.md'].includes(f)), 'docs/PACKAGE_README.md']) {
    await mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await copyFile(path.join(root, file), path.join(source, file));
  }
  return { base, source, stage: path.join(base, 'stage') };
}

test('package staging is exact, strips development metadata/hooks and excludes dirty-tree canaries', async t => {
  const { source, stage } = await fixture(t);
  for (const file of ['.env', 'dist/.env', 'dist/private-fixture.js', 'dist/cli.d.ts', '.npmrc']) await writeFile(path.join(source, file), 'SYNTHETIC_PRIVATE_CANARY');
  const pkg = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  pkg.scripts.prepare = 'MUST_NOT_EXECUTE';
  await writeFile(path.join(source, 'package.json'), JSON.stringify(pkg));
  const report = await stagePackage(source, stage);
  assert.equal(report.files.length, 13);
  assert.deepEqual(report.files.map(f => f.path), packageFiles);
  const manifest = JSON.parse(await readFile(path.join(stage, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts, undefined); assert.equal(manifest.devDependencies, undefined);
  assert.equal(manifest.private, true);
  if (process.platform !== 'win32') for (const file of packageFiles) assert.equal((await lstat(path.join(stage, file))).mode & 0o777, 0o644);
  assert.deepEqual((await readdir(path.join(stage, 'dist'))).sort(), packageFiles.filter(f => f.startsWith('dist/')).map(f => path.basename(f)).sort());
  for (const file of packageFiles) assert.ok(!(await readFile(path.join(stage, file), 'utf8')).includes('SYNTHETIC_PRIVATE_CANARY'));
});

test('packaging refuses dependency/publication changes and missing compiled inputs before staging', async t => {
  for (const change of ['dependencies', 'private', 'missing']) await t.test(change, async st => {
    const { source, stage } = await fixture(st);
    if (change === 'missing') await rm(path.join(source, 'dist/cli.js'));
    else {
      const pkg = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
      if (change === 'private') pkg.private = false; else pkg.dependencies = { unexpected: '1.0.0' };
      await writeFile(path.join(source, 'package.json'), JSON.stringify(pkg));
    }
    await assert.rejects(stagePackage(source, stage));
    await assert.rejects(readFile(path.join(stage, 'package.json')), { code: 'ENOENT' });
  });
});

test('packaging rejects linked directories and hard-linked inputs without touching external data', async t => {
  for (const type of ['directory', 'hard-link']) await t.test(type, async st => {
    const { base, source, stage } = await fixture(st);
    const outside = path.join(base, 'outside'); await mkdir(outside);
    if (type === 'directory') {
      await rm(path.join(source, 'dist'), { recursive: true });
      await writeFile(path.join(outside, 'cli.js'), 'SYNTHETIC_PRIVATE_CANARY');
      await symlink(outside, path.join(source, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
    } else await link(path.join(source, 'LICENSE'), path.join(outside, 'copy'));
    await assert.rejects(stagePackage(source, stage));
    await assert.rejects(readFile(path.join(stage, 'package.json')), { code: 'ENOENT' });
  });
});
