// Release orchestration only; never included in the runtime archive.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

export const SOURCE = '1aa6cd22ae92dfba99df50f898234f460ccf96d3';
export const DIGEST = 'b519cbe31517715d6b1b82999a0fb64fa0adca42d95f4dcf57c3fdfcc7eeb8c4';
export const REPOSITORY = 'https://github.com/doksanbes/agentbridge';
export const TYPE = REPOSITORY + '/attestations/approved-source/v1';
export const NAME = 'agentbridge-0.1.0.tgz';

export function verifyStatements(results) {
  assert.ok(Array.isArray(results), 'Expected gh verified result array.');
  const statements = results.map(result => result.verificationResult?.statement);
  assert.ok(statements.length, 'No verified approved-source statement.');
  for (const statement of statements) {
    assert.equal(statement?.predicateType, TYPE);
    assert.ok(statement.subject.some(s => s.name === NAME || s.name.endsWith('/' + NAME)) &&
      statement.subject.some(s => s.digest.sha256 === DIGEST && (s.name === NAME || s.name.endsWith('/' + NAME))), 'Wrong subject.');
    assert.equal(statement.predicate.repository, REPOSITORY);
    assert.equal(statement.predicate.commit, SOURCE);
    assert.equal(statement.predicate.archive.sha256, DIGEST);
    assert.equal(statement.predicate.archive.name, NAME);
  }
}

if (process.argv[2] === 'prepare') {
  const root = path.resolve(process.argv[3]);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(sha, SOURCE);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '');
  const archive = await readFile(path.join(root, '.cache/packages', NAME));
  assert.equal(createHash('sha256').update(archive).digest('hex'), DIGEST);
  const manifest = JSON.parse(await readFile(path.join(root, '.cache/packages', NAME + '.manifest.json')));
  assert.equal(manifest.files.length, 13); assert.equal(manifest.sha256, DIGEST);
  await writeFile(process.argv[4], JSON.stringify({ repository: REPOSITORY, commit: SOURCE,
    archive: { name: NAME, sha256: DIGEST }, contentSha256: manifest.contentSha256 }, null, 2));
} else if (process.argv[2] === 'verify') {
  // Input must be successful gh attestation verify --format json output,
  // not an unverified Sigstore bundle. The workflow enforces that ordering.
  verifyStatements(JSON.parse(await readFile(process.argv[3], 'utf8')));
}
