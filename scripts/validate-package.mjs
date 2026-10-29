// Validate only an archive built here, never an arbitrary downloaded tarball.
import { mkdtemp, mkdir, readFile, writeFile, readdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { buildPackage, packageFiles } from './package.mjs';
import { isolatedEnv, npmCli, run } from './package-tools.mjs';

const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const root = fileURLToPath(new URL('../', import.meta.url));
const report = await buildPackage(root);
const base = await mkdtemp(path.join(tmpdir(), 'AgentBridge clean install ü-'));
let requests = 0;
const server = createServer((_req, res) => { requests++; res.writeHead(403); res.end('Network forbidden during package validation.'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const consumer = path.join(base, 'consumer'); await mkdir(consumer);
  const prefix = path.join(base, 'prefix');
  const artifact = path.join(consumer, report.filename); await copyFile(report.archive, artifact);
  const env = await isolatedEnv(path.join(base, 'home'));
  // Only Node, Git and OS commands are needed by consumers. No pnpm/tsc path.
  const gitPath = process.platform === 'win32' ? (await run('where.exe', ['git.exe'], consumer, env)).trim().split(/\r?\n/)[0]
    : (await run('/bin/sh', ['-c', 'command -v git'], consumer, env)).trim();
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  const system = process.platform === 'win32' ? [path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'];
  env.PATH = [path.dirname(process.execPath), path.dirname(gitPath), ...system].join(path.delimiter);
  env.NPM_CONFIG_REGISTRY = `http://127.0.0.1:${server.address().port}/`;
  const npm = await npmCli();
  const npmRun = args => run(process.execPath, [npm, ...args], consumer, env);
  await npmRun(['install', '--global', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', artifact]);
  const installed = path.join(prefix, process.platform === 'win32' ? 'node_modules/agentbridge' : 'lib/node_modules/agentbridge');
  const inventory = [];
  async function visit(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = relative + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Unexpected linked installed package content.');
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), name + '/');
      else inventory.push(name);
    }
  }
  await visit(installed);
  assert.deepEqual(inventory.sort(), packageFiles);
  for (const file of report.files) {
    assert.equal(createHash('sha256').update(await readFile(path.join(installed, file.path))).digest('hex'), file.sha256);
  }
  const pkg = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
  for (const field of ['scripts', 'devDependencies', 'dependencies', 'optionalDependencies', 'peerDependencies', 'packageManager']) assert.equal(pkg[field], undefined);
  assert.equal(pkg.private, true);
  // Exercise the real generated Windows cmd / POSIX executable shim.
  const shim = path.join(prefix, process.platform === 'win32' ? 'agentbridge.cmd' : 'bin/agentbridge');
  const shimRun = args => process.platform === 'win32'
    ? run(process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', `""${shim}" ${args.join(' ')}"`], consumer, env, 0, true)
    : run(shim, args, consumer, env);
  assert.equal((await shimRun(['--version'])).trim(), version);
  assert.ok((await shimRun(['--help'])).includes('doctor'));
  // npm exec (the mechanism behind npx), with a separate empty consumer cache.
  env.NPM_CONFIG_CACHE = path.join(base, 'exec-cache');
  assert.equal((await npmRun(['exec', '--yes', '--offline', '--ignore-scripts', `--package=${artifact}`, '--', 'agentbridge', '--version'])).trim(), version);
  const project = path.join(base, 'software project ü'); await mkdir(project);
  const cli = (args, expected = 0) => run(process.execPath, [path.join(installed, 'dist/cli.js'), ...args, '--project', project], consumer, env, expected);
  const git = args => run(gitPath, ['-c', 'core.hooksPath=.git/no-hooks', ...args], project, env);
  await git(['init', '--initial-branch=main']);
  await writeFile(path.join(project, 'app.js'), 'export const example = true;\n');
  await writeFile(path.join(project, '.env'), 'SYNTHETIC_PRIVATE_CANARY');
  await writeFile(path.join(project, '.gitignore'), '.env\n');
  await git(['add', '--', 'app.js']); await git(['add', '--force', '--', '.env']);
  await cli(['init']);
  await writeFile(path.join(project, '.agentbridge/context.md'), '# Synthetic project\n\nKeep changes offline.\n');
  const user = '# Team rule\r\nKeep the API stable.\r\n'; await writeFile(path.join(project, 'CLAUDE.md'), user);
  await cli(['handoff', '--save', '--from', 'codex', '--to', 'claude', '--done', 'Reviewed project setup', '--next', 'Add an offline fixture']);
  const discovery = await cli(['discover']); assert.ok(discovery.includes('app.js')); assert.ok(!discovery.includes('.env'));
  const preview = await cli(['sync', '--dry-run']); assert.ok(preview.includes('Add an offline fixture')); assert.ok(!preview.includes('SYNTHETIC_PRIVATE_CANARY'));
  await assert.rejects(readFile(path.join(project, 'AGENTS.md')), { code: 'ENOENT' });
  await cli(['sync'], 2); assert.equal(await readFile(path.join(project, 'CLAUDE.md'), 'utf8'), user);
  await cli(['sync', '--approve-overwrite', 'CLAUDE.md']); await cli(['status']);
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) assert.ok((await readFile(path.join(project, file), 'utf8')).includes('Add an offline fixture'));
  const healthy = JSON.parse(await cli(['doctor', '--json'])); assert.deepEqual(healthy.summary, { errors: 0, warnings: 0 });
  const original = await readFile(path.join(project, 'CLAUDE.md'), 'utf8'); assert.ok(original.startsWith(user));
  const edited = original.replace('Add an offline fixture', 'LOCAL EDIT'); await writeFile(path.join(project, 'CLAUDE.md'), edited);
  assert.ok((await cli(['sync', '--dry-run'])).includes('CLAUDE.md: conflict'));
  await cli(['sync'], 2); assert.equal(await readFile(path.join(project, 'CLAUDE.md'), 'utf8'), edited);
  const candidate = JSON.stringify({ to: 'gemini', next: ['Review the managed edit before continuing.'] });
  const sessionRun = async (args, input) => {
    // run() intentionally accepts no stdin; invoke the installed module through a
    // tiny Node wrapper with fixed data, bypassing shell interpolation entirely.
    const wrapper = path.join(base, 'session-consumer.mjs');
    await writeFile(wrapper, `import { spawnSync } from 'node:child_process';\nconst r = spawnSync(process.execPath, ${JSON.stringify([path.join(installed, 'dist/cli.js'), 'session', '--project', project, ...args])}, {input:${JSON.stringify(input)}, encoding:'utf8', windowsHide:true});\nprocess.stdout.write(r.stdout); process.stderr.write(r.stderr); process.exitCode=r.status ?? 2;\n`);
    return run(process.execPath, [wrapper], consumer, env);
  };
  const sessionPreview = JSON.parse(await sessionRun([], candidate));
  assert.equal(sessionPreview.applied, false);
  assert.equal(sessionPreview.files.find(f => f.file === 'CLAUDE.md').status, 'conflict');
  const sessionApplied = JSON.parse(await sessionRun(['--approve', sessionPreview.approval], candidate));
  assert.equal(sessionApplied.applied, true);
  const skillHome = path.join(base, 'skill-home'); await mkdir(skillHome);
  await run(process.execPath, [path.join(installed, 'dist/cli.js'), 'install-skill', '--skill-home', skillHome], consumer, env);
  assert.ok((await readFile(path.join(skillHome, '.agents/skills/agentbridge-handoff/SKILL.md'), 'utf8')).includes('agentbridge session --inspect'));
  assert.equal(requests, 0, 'Package validation attempted network access.');
  const result = { node: process.version, npm: report.npm, os: process.platform, archiveSha256: report.sha256,
    contentSha256: report.contentSha256, archiveModes: report.modes,
    packageFiles: inventory, repeatedPackIdentical: report.reproducible, installedShim: true, npmExec: true,
    freshCache: true, runtimeDependencies: 0, networkRequests: requests, workflow: 'init/discover/handoff/preview/approval/sync/status/doctor/conflict/session/skill passed' };
  await writeFile(path.join(root, '.cache/package-validation.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(base, { recursive: true, force: true });
}
