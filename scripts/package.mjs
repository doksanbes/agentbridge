import { lstat, mkdir, mkdtemp, readFile, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { npmCli, isolatedEnv, run } from './package-tools.mjs';

export const runtimeFiles = ['cli', 'codex', 'context', 'doctor', 'git', 'handoff', 'managed', 'safety', 'session', 'sync'].map(name => `dist/${name}.js`);
export const packageFiles = [...runtimeFiles, 'package.json', 'README.md', 'LICENSE', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md'].sort();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Read only explicit regular inputs; a dirty dist directory cannot expand the archive.
async function inputFile(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const info = await lstat(current);
    assert.ok(!info.isSymbolicLink(), 'Linked package input refused.');
  }
  const info = await lstat(current);
  assert.ok(info.isFile() && info.nlink === 1 && info.size < 256 * 1024, 'Unsafe package input.');
  return readFile(current);
}

export async function stagePackage(root, stage) {
  const source = JSON.parse(await inputFile(root, 'package.json'));
  assert.equal(source.private, true, 'Publication guard must remain enabled.');
  for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies', 'bundleDependencies']) {
    assert.equal(Object.keys(source[key] ?? {}).length, 0, 'Review new runtime dependencies before packaging.');
  }
  assert.equal(source.name, 'agentbridge');
  assert.match(source.version, /^\d+\.\d+\.\d+$/);
  assert.equal(source.type, 'module'); assert.equal(source.license, 'MIT');
  assert.deepEqual(source.bin, { agentbridge: 'dist/cli.js' });
  assert.deepEqual([...source.files].sort(), packageFiles.filter(f => f !== 'package.json'));
  const manifest = { name: source.name, version: source.version, description: source.description, private: true,
    type: source.type, license: source.license, repository: source.repository, engines: source.engines,
    bin: source.bin, files: source.files };
  const contents = new Map([['package.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')]]);
  for (const file of packageFiles.filter(f => f !== 'package.json')) {
    const bytes = await inputFile(root, file === 'README.md' ? 'docs/PACKAGE_README.md' : file);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!text.includes('\r') && !text.includes('\0'), 'Package inputs must be LF UTF-8.');
    if (file.startsWith('dist/')) {
      assert.ok(!/\b(?:import|require)\s*\(/.test(text), 'Dynamic runtime imports need packaging review.');
      for (const match of text.matchAll(/^\s*(?:import|export)\s+(?:[^'";\n]*?\s+from\s*)?['"]([^'"\n]+)['"]/gm)) {
        assert.ok(match[1].startsWith('node:') || runtimeFiles.includes('dist/' + match[1].replace(/^\.\//, '')), 'Unexpected runtime import.');
      }
    }
    contents.set(file, bytes);
  }
  assert.ok(contents.get('dist/cli.js').toString().startsWith('#!/usr/bin/env node\n'));
  // A new directory is mandatory; never overwrite a maintainer's existing folder.
  await mkdir(stage);
  const files = [];
  for (const file of packageFiles) {
    await mkdir(path.dirname(path.join(stage, file)), { recursive: true });
    const bytes = contents.get(file);
    await writeFile(path.join(stage, file), bytes, { flag: 'wx', mode: 0o644 });
    // npm's bin installation creates executable shims and fixes the target mode.
    // Normalize archive inputs instead of inheriting host execute bits/umask.
    await chmod(path.join(stage, file), 0o644);
    files.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { name: source.name, version: source.version, files };
}

export async function buildPackage(root) {
  const output = path.join(root, '.cache/packages'); await mkdir(output, { recursive: true });
  const work = await mkdtemp(path.join(output, 'build-'));
  const stage = path.join(work, 'package');
  const staged = await stagePackage(root, stage);
  const npm = await npmCli();
  const env = await isolatedEnv(path.join(work, 'home'));
  const npmVersion = (await run(process.execPath, [npm, '--version'], work, env)).trim();
  const reports = [];
  for (const name of ['first', 'second']) {
    const destination = path.join(work, name); await mkdir(destination);
    const [result] = JSON.parse(await run(process.execPath, [npm, 'pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', destination], stage, env));
    assert.deepEqual(result.files.map(f => f.path).sort(), packageFiles);
    assert.equal(result.entryCount, packageFiles.length);
    const archive = path.join(destination, `${staged.name}-${staged.version}.tgz`);
    assert.equal(result.filename, path.basename(archive));
    const bytes = await readFile(archive);
    reports.push({ bytes, sha256: sha256(bytes), modes: result.files.map(f => ({ path: f.path, mode: f.mode })) });
  }
  assert.equal(reports[0].sha256, reports[1].sha256, 'Repeated archive builds differ.');
  const filename = `${staged.name}-${staged.version}.tgz`;
  const archive = path.join(output, filename);
  await writeFile(archive, reports[0].bytes);
  await writeFile(archive + '.sha256', `${reports[0].sha256}  ${filename}\n`);
  const report = { filename, archive, sha256: reports[0].sha256, contentSha256: sha256(JSON.stringify(staged.files)),
    modes: reports[0].modes, reproducible: true, node: process.version, npm: npmVersion, os: process.platform, files: staged.files };
  // Canonical public sidecar; host/toolchain details remain in local/CI reports.
  const publicManifest = { schemaVersion: 1, name: staged.name, version: staged.version,
    filename, sha256: report.sha256, contentSha256: report.contentSha256,
    modes: report.modes, reproducible: true, files: staged.files };
  await writeFile(archive + '.manifest.json', JSON.stringify(publicManifest, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildPackage(fileURLToPath(new URL('../', import.meta.url)));
  console.log(JSON.stringify(report, null, 2));
}
