// Candidate evidence only: no signing, dispatch, tag, upload or publication.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prepareRelease, sha256 } from './attestation-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
const sourceCommit = execFileSync('git', ['rev-parse','HEAD'], { cwd: root, env, encoding: 'utf8', windowsHide: true }).trim();
const { version } = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const archivePath = path.join(root,`.cache/packages/agentbridge-${version}.tgz`);
const approval = { version, sourceCommit, archiveSha256: sha256(await readFile(archivePath)),
  manifestSha256: sha256(await readFile(archivePath+'.manifest.json')) };
// Deriving these inputs audits a candidate. It does not grant publication or
// replace the reviewed, separately supplied workflow-dispatch approval values.
const binding = await prepareRelease(root, approval);
const evidence = { candidateOnly: true, signaturesVerified: false, approval, binding };
await writeFile(path.join(root,'.cache/release-candidate.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
