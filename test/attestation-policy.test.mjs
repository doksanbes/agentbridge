import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyStatements, SOURCE, DIGEST, REPOSITORY, TYPE, NAME } from '../scripts/attestation-policy.mjs';

const valid = () => ({ predicateType: TYPE, subject: [{ name: NAME, digest: { sha256: DIGEST } }],
  predicate: { repository: REPOSITORY, commit: SOURCE, archive: { name: NAME, sha256: DIGEST } } });
test('signed statement policy rejects wrong source, repository and subject', () => {
  verifyStatements([{ verificationResult: { statement: valid() } }]);
  assert.throws(() => verifyStatements([]));
  assert.throws(() => verifyStatements([valid()])); // Raw, unverified statements are not verifier output.
  for (const field of ['commit', 'repository']) { const s = valid(); s.predicate[field] = 'unexpected'; assert.throws(() => verifyStatements([{ verificationResult: { statement: s } }])); }
  const s = valid(); s.subject[0].digest.sha256 = '0'.repeat(64); assert.throws(() => verifyStatements([{ verificationResult: { statement: s } }]));
});
test('attestation workflow is manual/main only and cannot publish releases', async () => {
  const text = await readFile(new URL('../.github/workflows/attested-build.yml', import.meta.url), 'utf8');
  assert.ok(text.includes('workflow_dispatch:')); assert.ok(text.includes("github.ref == 'refs/heads/main'"));
  assert.ok(text.includes(`ref: ${SOURCE}`));
  assert.ok(!/pull_request|contents: write|packages: write|upload-artifact|gh release|npm publish/.test(text));
  for (const line of text.split('\n').filter(l => l.includes('uses:'))) assert.match(line, /@[a-f0-9]{40}/);
});
