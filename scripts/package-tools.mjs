// Developer-only npm orchestration. Never imported by the product CLI.
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function npmCli() {
  const candidates = [process.env.AGENTBRIDGE_NPM_CLI,
    path.basename(process.env.npm_execpath ?? '') === 'npm-cli.js' ? process.env.npm_execpath : undefined,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  for (const candidate of candidates.filter(Boolean)) {
    try { await access(candidate); return path.resolve(candidate); } catch { /* try next standard location */ }
  }
  throw new Error('npm CLI not found. Install a standard Node.js + npm distribution, or set AGENTBRIDGE_NPM_CLI to its npm-cli.js.');
}

export async function isolatedEnv(home) {
  await mkdir(home, { recursive: true });
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(npm_config_|pnpm_|corepack_|git_)/i.test(key) || /TOKEN|API_KEY|SECRET|AUTHORIZATION|PROXY/i.test(key) || /^(NODE_OPTIONS|NODE_PATH)$/i.test(key)) delete env[key];
  Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'appdata'), LOCALAPPDATA: path.join(home, 'local'),
    XDG_CONFIG_HOME: path.join(home, 'config'), NPM_CONFIG_CACHE: path.join(home, 'npm-cache'),
    NPM_CONFIG_USERCONFIG: path.join(home, 'user.npmrc'), NPM_CONFIG_GLOBALCONFIG: path.join(home, 'global.npmrc'),
    NPM_CONFIG_UPDATE_NOTIFIER: 'false', NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_OFFLINE: 'true', NPM_CONFIG_IGNORE_SCRIPTS: 'true' });
  await writeFile(env.NPM_CONFIG_USERCONFIG, '', { mode: 0o600 });
  await writeFile(env.NPM_CONFIG_GLOBALCONFIG, '', { mode: 0o600 });
  return env;
}

export function run(binary, args, cwd, env, expected = 0, verbatim = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, env, windowsHide: true, shell: false, windowsVerbatimArguments: verbatim, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0;
    const timer = setTimeout(() => { child.kill(); reject(new Error('Package validation subprocess timed out.')); }, 60_000);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) child.kill(); else stdout += chunk; });
    child.stderr.on('data', chunk => { if (stderr.length < 16_384) stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== expected || bytes > 4 * 1024 * 1024) reject(new Error(`Package command ${path.basename(binary)} failed (${code}, expected ${expected}): ${stderr}\n${stdout}`));
      else resolve(stdout);
    });
  });
}
