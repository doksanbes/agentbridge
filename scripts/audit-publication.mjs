// Read-only publication preflight. The manifest is the only approved upload set.
import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await readFile(path.join(root, 'publication-files.txt'), 'utf8');
const files = manifest.trim().split(/\r?\n/);
assert.equal(new Set(files).size, files.length, 'Duplicate publication path.');
assert.deepEqual(files, [...files].sort(), 'Publication manifest must be sorted.');
const excluded = new Set(['.git', '.cache', 'node_modules', 'dist', 'coverage', '.agentbridge']);
const roots = new Set(['.github', 'src', 'test', 'scripts', 'docs', 'examples']);
for (const file of files) {
  assert.ok(/^[A-Za-z0-9_.\/-]+$/.test(file) && !file.split('/').some(part => part === '..' || part === '.' || excluded.has(part)), 'Unsafe publication path.');
  assert.ok(!/(^|\/)\.env(?:\.|$)|\.(?:exe|dll|zip|tgz|pem|key|p8|p12|pfx|db|sqlite|log)$/i.test(file), 'Private or binary publication input.');
  let current = root;
  for (const part of file.split('/')) {
    current = path.join(current, part);
    const info = await lstat(current);
    assert.ok(!info.isSymbolicLink(), 'Linked publication path.');
  }
  const info = await lstat(current);
  assert.ok(info.isFile() && info.nlink === 1, 'Publication input must be a regular, unlinked file.');
}

// Unlisted files are reported without opening their contents. Do not scan caches,
// dependencies, private local context, or unknown directories for user data.
const present = [];
async function inventory(directory, prefix = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue;
    const relative = prefix + item.name;
    if (item.isDirectory()) {
      if (!prefix && !roots.has(item.name)) present.push(relative + '/');
      else await inventory(path.join(directory, item.name), relative + '/');
    } else present.push(relative);
  }
}
await inventory(root);
assert.deepEqual(present.sort(), files, 'Workspace contains unlisted source files; review the manifest before staging.');

const rules = {
  privateHomePath: /(?:\b[A-Z]:[\\/]+Users[\\/]+[^\s"'`]+|\/Users\/[^\s"'`]+|\/home\/[^\s"'`]+)/i,
  privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  providerToken: /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/,
  credentialAssignment: /\b(?:password|api_key|access_token|secret)\s*[:=]\s*[A-Za-z0-9_\/-]{8,}/i,
};
const findings = [], synthetic = [], entries = [];
const samplePassword = ['password', 'abcdefgh123'].join('=');
const sampleKeyHeader = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
const sampleFakePassword = ['password', 'FAKE_SENSITIVE_EXAMPLE'].join('=');
for (const file of files) {
  const bytes = await readFile(path.join(root, file));
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert.ok(!text.includes('\0'), 'Binary data in publication set.');
  entries.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
  for (const [index, line] of text.split(/\r?\n/).entries()) for (const [rule, regex] of Object.entries(rules)) {
    if (!regex.test(line)) continue;
    const fixture = file === 'test/safety.test.mjs' && line.includes(`'${samplePassword}', '${sampleKeyHeader}'`) && ['privateKey', 'credentialAssignment'].includes(rule) ||
      file === 'test/usability.test.mjs' && line.includes(`'${sampleFakePassword}'`) && rule === 'credentialAssignment';
    (fixture ? synthetic : findings).push({ path: file, line: index + 1, rule });
  }
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.private, true, 'npm publication must remain disabled.');
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'Review any new runtime dependency before publication.');
assert.equal(pkg.license, 'MIT');
assert.equal(pkg.repository.url, 'https://github.com/doksanbes/agentbridge.git');
const report = { pass: findings.length === 0, fileCount: files.length, manifestSha256: hash(Buffer.from(manifest)),
  unreviewedFindings: findings, reviewedSyntheticFixtures: synthetic, files: entries };
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
