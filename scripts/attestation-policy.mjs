// Reviewed release orchestration only. Never included in the runtime package.
import { lstat, open, realpath, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { packageFiles } from './package.mjs';

export const REPOSITORY = 'https://github.com/doksanbes/agentbridge';
export const TYPE = REPOSITORY + '/attestations/approved-source/v2';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const hashPattern = /^[a-f0-9]{64}$/;
const approvalKeys = ['version', 'sourceCommit', 'archiveSha256', 'manifestSha256'];

export function validateApproval(value) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Approval must be an object.');
  assert.deepEqual(Object.keys(value).sort(), [...approvalKeys].sort(), 'Unexpected approval fields.');
  for (const key of approvalKeys) {
    assert.equal(typeof value[key], 'string');
    assert.equal(value[key], value[key].trim(), 'Approval values must not contain boundary whitespace.');
  }
  assert.ok(value.version.length <= 32);
  assert.match(value.version ?? '', versionPattern, 'Expected a plain numeric release version.');
  assert.match(value.sourceCommit ?? '', /^[a-f0-9]{40}$/, 'Expected an exact source commit.');
  for (const key of ['archiveSha256', 'manifestSha256']) assert.match(value[key] ?? '', hashPattern, 'Expected a SHA-256.');
  return value;
}

export function validateDispatch(approval, env) {
  validateApproval(approval);
  assert.equal(env.GITHUB_REPOSITORY, 'doksanbes/agentbridge');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(approval.sourceCommit, env.GITHUB_SHA, 'Dispatch must name the exact current workflow/source commit.');
}

// Parse npm's regular-file ustar subset without extracting or executing it.
// Reject links, extensions, duplicates, bad checksums and hidden trailing entries.
export function archiveFiles(bytes) {
  const tar = gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 });
  const files = new Map();
  const field = (header, start, size) => header.subarray(start, start + size).toString('utf8').replace(/\0.*$/s, '');
  const octal = text => { assert.match(text.trim(), /^[0-7]+$/); return Number.parseInt(text.trim(), 8); };
  let ended = false;
  for (let offset = 0; offset < tar.length;) {
    assert.ok(offset + 512 <= tar.length, 'Truncated tar header.');
    const header = tar.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) {
      assert.ok(tar.length - offset >= 1024 && tar.subarray(offset).every(b => b === 0), 'Unexpected tar trailer.');
      ended = true; break;
    }
    const checksum = [...header].reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    assert.equal(octal(field(header, 148, 8)), checksum, 'Invalid tar checksum.');
    assert.equal(field(header, 257, 6), 'ustar');
    assert.ok([0, 48].includes(header[156]), 'Only regular archive files are permitted.');
    assert.equal(field(header, 157, 100), '', 'Archive link target refused.');
    assert.equal(field(header, 345, 155), '', 'Archive path prefixes refused.');
    const name = field(header, 0, 100);
    assert.ok(name.startsWith('package/'), 'Wrong package prefix.');
    const relative = name.slice(8);
    assert.ok(packageFiles.includes(relative) && !files.has(relative), 'Unexpected or duplicate package entry.');
    const size = octal(field(header, 124, 12));
    assert.ok(size <= 256 * 1024 && offset + 512 + size <= tar.length, 'Invalid tar entry size.');
    assert.equal(octal(field(header, 100, 8)), 0o644, 'Unexpected file mode.');
    const content = tar.subarray(offset + 512, offset + 512 + size);
    files.set(relative, { path: relative, bytes: size, sha256: sha256(content), content });
    const next = offset + 512 + Math.ceil(size / 512) * 512;
    assert.ok(next <= tar.length && tar.subarray(offset + 512 + size, next).every(b => b === 0), 'Invalid entry padding.');
    offset = next;
  }
  assert.ok(ended, 'Missing tar trailer.');
  assert.deepEqual([...files.keys()].sort(), packageFiles, 'Package inventory differs from the reviewed allowlist.');
  return files;
}

export function inspectAssets(approval, archive, manifestBytes, checksumBytes) {
  validateApproval(approval);
  const name = `agentbridge-${approval.version}.tgz`;
  assert.equal(sha256(archive), approval.archiveSha256, 'Archive differs from approval.');
  assert.equal(sha256(manifestBytes), approval.manifestSha256, 'Manifest differs from approval.');
  assert.equal(checksumBytes.toString('utf8'), `${approval.archiveSha256}  ${name}\n`, 'Wrong checksum sidecar.');
  const entries = archiveFiles(archive);
  const files = [...entries.values()].map(({ content: _content, ...entry }) => entry).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const modes = packageFiles.map(file => ({ path: file, mode: 0o644 }));
  assert.deepEqual(manifest, { schemaVersion: 1, name: 'agentbridge', version: approval.version,
    filename: name, sha256: approval.archiveSha256, contentSha256: sha256(JSON.stringify(files)),
    modes, reproducible: true, files }, 'Manifest does not describe the actual archive.');
  const pkg = JSON.parse(entries.get('package.json').content.toString('utf8'));
  assert.equal(pkg.name, 'agentbridge'); assert.equal(pkg.version, approval.version);
  assert.equal(pkg.private, true); assert.equal(pkg.license, 'MIT'); assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.repository, { type: 'git', url: REPOSITORY + '.git' });
  assert.deepEqual(pkg.bin, { agentbridge: 'dist/cli.js' });
  assert.deepEqual([...pkg.files].sort(), packageFiles.filter(f => f !== 'package.json'));
  assert.deepEqual(Object.keys(pkg).sort(), ['name','version','description','private','type','license','repository','engines','bin','files'].sort());
  const assets = [ { name, sha256: approval.archiveSha256 },
    { name: name + '.sha256', sha256: sha256(checksumBytes) },
    { name: name + '.manifest.json', sha256: approval.manifestSha256 } ];
  return { repository: REPOSITORY, commit: approval.sourceCommit, version: approval.version,
    archive: assets[0], manifest: { ...assets[2], contentSha256: manifest.contentSha256, files }, assets };
}

async function regular(root, relative, limit = 4 * 1024 * 1024) {
  let current = await realpath(root);
  assert.ok(!path.isAbsolute(relative) && relative.split('/').every(p => p && p !== '..' && p !== '.'), 'Unsafe asset path.');
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert.ok(!(await lstat(current)).isSymbolicLink(), 'Linked release input refused.');
  }
  const handle = await open(current, 'r');
  try {
    const info = await handle.stat();
    assert.ok(info.isFile() && info.nlink === 1 && info.size <= limit, 'Unsafe release input.');
    const bytes = await handle.readFile(); assert.ok(bytes.length <= limit); return bytes;
  } finally { await handle.close(); }
}

const git = (root, args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
  cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))), windowsHide: true,
}).trim();

export async function prepareRelease(root, approval) {
  validateApproval(approval);
  assert.equal(git(root, ['rev-parse', 'HEAD']), approval.sourceCommit);
  assert.equal(git(root, ['status', '--porcelain']), '', 'Source tree must be clean.');
  const pkg = JSON.parse(await regular(root, 'package.json'));
  assert.equal(pkg.version, approval.version, 'Source version differs from approval.');
  const name = `.cache/packages/agentbridge-${approval.version}.tgz`;
  return inspectAssets(approval, await regular(root,name), await regular(root,name+'.manifest.json'), await regular(root,name+'.sha256'));
}

export function verifyStatements(results, expected) {
  assert.ok(Array.isArray(results) && results.length, 'Expected successful gh verifier output, not a raw statement.');
  for (const result of results) {
    const statement = result.verificationResult?.statement;
    assert.equal(statement?._type, 'https://in-toto.io/Statement/v1');
    assert.equal(statement.predicateType, TYPE);
    assert.deepEqual(statement.predicate, expected, 'Source/manifest binding differs from locally audited assets.');
    assert.equal(statement.subject.length, expected.assets.length);
    const subjects = statement.subject.map(s => {
      const basename = path.posix.basename(s.name);
      assert.ok(s.name === basename || s.name === 'source/.cache/packages/' + basename, 'Unexpected subject path.');
      assert.deepEqual(Object.keys(s.digest), ['sha256']);
      return { name: basename, sha256: s.digest.sha256 };
    }).sort((a,b) => a.name < b.name ? -1 : 1);
    assert.deepEqual(subjects, [...expected.assets].sort((a,b) => a.name < b.name ? -1 : 1));
  }
}

// Only an authenticated HTTP 404 proves absence; other failures stop the gate.
export function validateAbsence(r) {
  assert.ok(!r.error && r.status === 1 && /^HTTP\/[^\s]+ 404\b/m.test(r.stdout), 'Release/tag exists or absence could not be verified.');
}
function absent(endpoint) {
  const r = spawnSync('gh', ['api', '--include', endpoint], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  validateAbsence(r);
}

async function main() {
  const [command, root, approvalFile, ...rest] = process.argv.slice(2);
  if (command === 'gate') {
    const approval = validateApproval({ version: process.env.RELEASE_VERSION, sourceCommit: process.env.RELEASE_SOURCE,
      archiveSha256: process.env.RELEASE_ARCHIVE_SHA256, manifestSha256: process.env.RELEASE_MANIFEST_SHA256 });
    validateDispatch(approval, process.env);
    assert.equal(git(root,['rev-parse','HEAD']), approval.sourceCommit);
    assert.equal(JSON.parse(await regular(root,'package.json')).version, approval.version);
    absent(`repos/doksanbes/agentbridge/git/ref/tags/v${approval.version}`);
    absent(`repos/doksanbes/agentbridge/releases/tags/v${approval.version}`);
    await writeFile(approvalFile, JSON.stringify(approval,null,2)+'\n', { flag: 'wx' });
  } else if (command === 'prepare') {
    const approval = JSON.parse(await readFile(approvalFile,'utf8'));
    const binding = await prepareRelease(root, approval);
    await writeFile(rest[0], JSON.stringify(binding,null,2)+'\n', { flag: 'wx' });
    await writeFile(rest[1], binding.assets.map(a=>`${a.sha256}  source/.cache/packages/${a.name}\n`).join(''), { flag: 'wx' });
    console.log(JSON.stringify({ approval, files: binding.manifest.files, assets: binding.assets },null,2));
  } else if (command === 'verify') {
    // This semantic policy is not a cryptographic verifier: gh must succeed first.
    const binding = await prepareRelease(root, JSON.parse(await readFile(approvalFile,'utf8')));
    verifyStatements(JSON.parse(await readFile(rest[0],'utf8')), binding);
  } else throw new Error('Use gate, prepare, or verify.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
