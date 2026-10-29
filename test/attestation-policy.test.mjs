import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, copyFile, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { packageFiles, stagePackage } from '../scripts/package.mjs';
import { inspectAssets, archiveFiles, prepareRelease, verifyStatements, validateApproval, validateDispatch, validateAbsence, sha256, TYPE } from '../scripts/attestation-policy.mjs';

function tarEntry(name, content, type = '0') {
  const header = Buffer.alloc(512);
  header.write('package/' + name,0); header.write('0000644\0',100);
  header.write('0000000\0',108);header.write('0000000\0',116);
  header.write(content.length.toString(8).padStart(11,'0')+'\0',124);
  header.write('00000000000\0',136);header.fill(32,148,156);header.write(type,156);header.write('ustar\0',257);header.write('00',263);
  header.write([...header].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
  return Buffer.concat([header,content,Buffer.alloc((512-content.length%512)%512)]);
}
async function fixture(t, version = '0.2.0') {
  const root=await mkdtemp(path.join(tmpdir(),'AgentBridge release ü-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const file of [...packageFiles.filter(f=>f!=='README.md'),'docs/PACKAGE_README.md']) {
    await mkdir(path.dirname(path.join(root,file)),{recursive:true});
    await copyFile(new URL('../'+file,import.meta.url),path.join(root,file));
  }
  const source=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));source.version=version;
  await writeFile(path.join(root,'package.json'),JSON.stringify(source));
  const staged=await stagePackage(root,path.join(root,'stage'));
  const contents=new Map(await Promise.all(packageFiles.map(async name=>[name,await readFile(path.join(root,'stage',name))])));
  const archive=gzipSync(Buffer.concat([...contents].map(([name,content])=>tarEntry(name,content)).concat(Buffer.alloc(1024))));
  const name=`agentbridge-${version}.tgz`;
  const manifest=Buffer.from(JSON.stringify({schemaVersion:1,name:'agentbridge',version,filename:name,sha256:sha256(archive),contentSha256:sha256(JSON.stringify(staged.files)),modes:packageFiles.map(path=>({path,mode:0o644})),reproducible:true,files:staged.files},null,2)+'\n');
  const checksum=Buffer.from(`${sha256(archive)}  ${name}\n`);
  const approval={version,sourceCommit:'a'.repeat(40),archiveSha256:sha256(archive),manifestSha256:sha256(manifest)};
  return {root,contents,archive,manifest,checksum,approval};
}

test('multiple release versions bind their actual archive, full inventory, manifest and all three assets',async t=>{
  for(const version of ['0.2.0','1.3.7'])await t.test(version,async st=>{
    const f=await fixture(st,version),binding=inspectAssets(f.approval,f.archive,f.manifest,f.checksum);
    assert.equal(binding.version,version);assert.equal(binding.manifest.files.length,packageFiles.length);
    assert.deepEqual(binding.manifest.files.map(f=>f.path),packageFiles);
    assert.equal(binding.assets.length,3);
    assert.ok(f.contents.get('dist/codex.js').toString().includes('agentbridge-handoff'));
    assert.equal(execFileSync(process.execPath,[path.join(f.root,'stage/dist/cli.js'),'--version'],{encoding:'utf8',windowsHide:true}).trim(),version);
  });
});

test('approval rejects shell/path/version injection, extra fields, missing fields and old digest reuse',async t=>{
  const f=await fixture(t);
  for(const value of ['../../0.2.0','0.2.0\nanything','0.2.0\n','v0.2.0','01.2.0','0.2.0-rc.1'])assert.throws(()=>validateApproval({...f.approval,version:value}));
  for(const key of ['sourceCommit','archiveSha256','manifestSha256'])assert.throws(()=>validateApproval({...f.approval,[key]:f.approval[key]+'\n'}));
  for(const [key,value] of [['sourceCommit','main'],['archiveSha256','bad'],['manifestSha256',null],['unknown','field']])assert.throws(()=>validateApproval({...f.approval,[key]:value}));
  assert.throws(()=>validateApproval({version:'0.2.0'}));
  assert.throws(()=>inspectAssets({...f.approval,archiveSha256:'b519cbe31517715d6b1b82999a0fb64fa0adca42d95f4dcf57c3fdfcc7eeb8c4'},f.archive,f.manifest,f.checksum));
});

test('dispatch binds source and signer to exact main and rejects fork, PR and moving refs',()=>{
  const approval={version:'0.2.0',sourceCommit:'a'.repeat(40),archiveSha256:'b'.repeat(64),manifestSha256:'c'.repeat(64)};
  const env={GITHUB_REPOSITORY:'doksanbes/agentbridge',GITHUB_REF:'refs/heads/main',GITHUB_SHA:approval.sourceCommit,GITHUB_EVENT_NAME:'workflow_dispatch'};
  validateDispatch(approval,env);
  for(const [key,value] of [['GITHUB_REPOSITORY','other/agentbridge'],['GITHUB_REF','refs/pull/8/merge'],['GITHUB_SHA','d'.repeat(40)],['GITHUB_EVENT_NAME','push']])assert.throws(()=>validateDispatch(approval,{...env,[key]:value}));
});

test('only a real not-found response proves tag/release absence; authorization and transport failures stop',()=>{
  validateAbsence({status:1,stdout:'HTTP/2.0 404 Not Found\r\n\r\n{}'});
  for(const response of [{status:0,stdout:'HTTP/2.0 200 OK'}, {status:1,stdout:'HTTP/2.0 401 Unauthorized\n404'},
    {status:1,stdout:'HTTP/2.0 403 Forbidden\n{"message":"404"}'}, {status:1,stdout:'timeout'},
    {status:null,stdout:'HTTP/2.0 404 Not Found',error:new Error('transport')}])assert.throws(()=>validateAbsence(response));
});

test('archive and manifest tampering, extra files, duplicate files, links and unsafe paths fail closed',async t=>{
  const f=await fixture(t);
  assert.throws(()=>inspectAssets(f.approval,Buffer.from('corrupt'),f.manifest,f.checksum));
  assert.throws(()=>inspectAssets(f.approval,f.archive,Buffer.from('{}'),f.checksum));
  assert.throws(()=>inspectAssets(f.approval,f.archive,f.manifest,Buffer.from('wrong checksum')));
  const missing=JSON.parse(f.manifest);missing.files.pop();const bytes=Buffer.from(JSON.stringify(missing));
  assert.throws(()=>inspectAssets({...f.approval,manifestSha256:sha256(bytes)},f.archive,bytes,f.checksum));
  const base=[...f.contents].map(([name,content])=>tarEntry(name,content));
  for(const entry of [tarEntry('.env',Buffer.from('SYNTHETIC_PRIVATE_CANARY')),tarEntry('../outside',Buffer.from('x')),base[0],tarEntry('README.md',Buffer.from('x'),'2'),tarEntry('README.md',Buffer.from('x'),'1'),tarEntry('README.md',Buffer.from('x'),'x')]) {
    assert.throws(()=>archiveFiles(gzipSync(Buffer.concat([...base,entry,Buffer.alloc(1024)]))));
  }
  const corrupt=gunzipSync(f.archive);corrupt[0]^=1;assert.throws(()=>archiveFiles(gzipSync(corrupt)));
  assert.throws(()=>archiveFiles(gzipSync(Buffer.concat([gunzipSync(f.archive),base[0],Buffer.alloc(1024)]))));
});

test('verified statement policy rejects wrong commits, versions, manifests, inventories and subject ambiguity',async t=>{
  const f=await fixture(t),expected=inspectAssets(f.approval,f.archive,f.manifest,f.checksum);
  const statement={_type:'https://in-toto.io/Statement/v1',predicateType:TYPE,predicate:expected,subject:expected.assets.map(a=>({name:'source/.cache/packages/'+a.name,digest:{sha256:a.sha256}}))};
  const wrap=s=>[{verificationResult:{statement:s}}];verifyStatements(wrap(statement),expected);
  assert.throws(()=>verifyStatements([],expected));assert.throws(()=>verifyStatements([statement],expected));
  for(const mutate of [s=>s.predicate.commit='0'.repeat(40),s=>s.predicate.repository='https://github.com/other/repo',s=>s.predicate.version='0.1.0',s=>s.predicate.manifest.files.pop(),s=>s.subject.pop(),s=>s.subject[1]=s.subject[0],s=>s.subject[0].digest.sha256='0'.repeat(64),s=>s.subject[0].name='../'+expected.archive.name,s=>s.predicateType=TYPE.replace('/v2','/v1')]) {
    const copy=structuredClone(statement);mutate(copy);assert.throws(()=>verifyStatements(wrap(copy),expected));
  }
});

test('clean source preflight rejects wrong source, dirty trees, linked assets and hard links',async t=>{
  const f=await fixture(t),git=args=>execFileSync('git',['-c','core.hooksPath=.git/no-hooks','-c','core.autocrlf=false',...args],{cwd:f.root,encoding:'utf8',windowsHide:true});
  await writeFile(path.join(f.root,'.gitignore'),'.cache/\nstage/\n');git(['init','--initial-branch=main']);git(['add','.']);git(['-c','user.name=Synthetic fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic release input']);
  f.approval.sourceCommit=git(['rev-parse','HEAD']).trim();
  await mkdir(path.join(f.root,'.cache/packages'),{recursive:true});const name=path.join(f.root,'.cache/packages/agentbridge-0.2.0.tgz');
  await writeFile(name,f.archive);await writeFile(name+'.manifest.json',f.manifest);await writeFile(name+'.sha256',f.checksum);
  await prepareRelease(f.root,f.approval);
  await assert.rejects(prepareRelease(f.root,{...f.approval,sourceCommit:'0'.repeat(40)}));
  await writeFile(path.join(f.root,'unexpected.txt'),'unreviewed');await assert.rejects(prepareRelease(f.root,f.approval));await rm(path.join(f.root,'unexpected.txt'));
  await link(name,path.join(f.root,'.cache/copy'));await assert.rejects(prepareRelease(f.root,f.approval));await rm(path.join(f.root,'.cache/copy'));
  await rm(name+'.manifest.json');await symlink(name,name+'.manifest.json',process.platform==='win32'?'file':undefined).catch(e=>{if(process.platform==='win32'&&e.code==='EPERM')return;throw e;});
  await assert.rejects(prepareRelease(f.root,f.approval));
});

test('manual main-only workflow keeps exact least-privilege permissions, pinned actions and no publication',async()=>{
  const text=await readFile(new URL('../.github/workflows/attested-build.yml',import.meta.url),'utf8');
  assert.ok(text.includes('workflow_dispatch:')&&text.includes("github.ref == 'refs/heads/main'"));
  assert.ok(!/pull_request|contents: write|packages: write|artifact-metadata: write|upload-artifact|gh release|npm publish/.test(text));
  for(const line of text.split('\n').filter(l=>l.includes('uses:')))assert.match(line,/@[a-f0-9]{40}/);
  assert.deepEqual([...text.matchAll(/uses: (\S+)/g)].map(m=>m[1]),[
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1',
    'actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6',
    'actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6']);
  assert.deepEqual([...text.matchAll(/permissions:\n((?: +[a-z-]+: \w+\n)+)/g)].map(m=>m[1].trim().split('\n').map(s=>s.trim())),[
    ['contents: read'],['contents: read','id-token: write','attestations: write']]);
  assert.ok(!text.includes('agentbridge-0.1.0')&&!text.includes('1aa6cd22'));
  assert.ok(text.includes('subject-checksums: subjects.sha256')&&text.includes('--signer-digest "$GITHUB_SHA"'));
  assert.ok(!/run:.*\$\{\{.*inputs\./.test(text),'Inputs may only enter as environment data.');
});
