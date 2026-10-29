import { spawnSync } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { exclusionMatcher, readText, safePath, sensitive } from './safety.js';

export type GitState = 'ready' | 'missing-git' | 'no-repository' | 'not-root';
export interface Progress {
  git: GitState;
  commits: { hash: string; files: string[] }[];
  changes: { status: string; file: string }[];
  omitted: number;
}

export class ProjectGit {
  readonly root: string;
  state: GitState = 'no-repository';
  private exclude: (file: string) => boolean = () => false;
  constructor(root: string) { this.root = root; }

  private async boundaryPresent(): Promise<boolean> {
    let directory = this.root;
    while (true) {
      const boundaries = await Promise.all(['.git', '.gitignore'].map(name =>
        lstat(path.join(directory, name)).then(() => true, () => false)));
      if (boundaries.some(Boolean)) return true;
      // Without Git, parent boundaries cannot otherwise be evaluated.
      if (this.state !== 'missing-git' || path.dirname(directory) === directory) return false;
      directory = path.dirname(directory);
    }
  }

  run(args: string[], input?: string): { code: number; text: string } {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
    env.GIT_TERMINAL_PROMPT = '0';
    const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false',
      '-c', 'core.untrackedCache=false', '-c', 'core.quotePath=false', ...args], {
      cwd: this.root, env, encoding: 'utf8', timeout: 10_000, maxBuffer: 2 * 1024 * 1024,
      ...(input === undefined ? {} : { input }), windowsHide: true, shell: false,
    });
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') return { code: 127, text: '' };
      throw new Error('Git inspection exceeded its resource limit or failed to start.');
    }
    return { code: result.status ?? 1, text: result.stdout ?? '' };
  }

  async initialize(): Promise<void> {
    const top = this.run(['rev-parse', '--show-toplevel']);
    if (top.code === 127) this.state = 'missing-git';
    else if (top.code !== 0) {
      // An existing Git entry with a failed probe can mean an unsafe/corrupt repo.
      const present = await lstat(`${this.root}/.git`).then(() => true, () => false);
      if (present) throw new Error('Git repository cannot be safely inspected. Check ownership and repository health.');
      this.state = 'no-repository';
    } else this.state = await realpath(top.text.trim()) === this.root ? 'ready' : 'not-root';
    if (this.state === 'ready' && !(await this.ignored(['.agentbridgeignore'])).has('.agentbridgeignore')) {
      this.exclude = exclusionMatcher(await readText(this.root, '.agentbridgeignore') ?? '');
    } else if (this.state === 'no-repository' || this.state === 'missing-git') {
      if (!(await this.boundaryPresent())) this.exclude = exclusionMatcher(await readText(this.root, '.agentbridgeignore') ?? '');
    }
  }

  private checked(args: string[], input?: string): string {
    const result = this.run(args, input);
    if (result.code !== 0) throw new Error('Git metadata inspection failed; refusing partial results.');
    return result.text;
  }

  async ignored(files: string[]): Promise<Set<string>> {
    if (this.state !== 'ready' || !files.length) return new Set();
    const result = this.run(['check-ignore', '--no-index', '-z', '--stdin'], files.join('\0') + '\0');
    if (![0, 1].includes(result.code)) throw new Error('Git ignore check failed; refusing to read project files.');
    return new Set(result.text.split('\0').filter(Boolean));
  }

  async assertControl(relative: string): Promise<void> {
    if (this.state !== 'ready') {
      if (await this.boundaryPresent() || this.state === 'not-root') {
        throw new Error('Cannot evaluate ignore rules here. Install Git and select the repository root before reading or writing context.');
      }
    }
    if (this.exclude(relative) || (await this.ignored([relative])).has(relative)) {
      throw new Error('An AgentBridge input or output is excluded; refusing to read or write it.');
    }
    await safePath(this.root, relative);
  }

  async allowed(files: string[]): Promise<string[]> {
    const candidates = [...new Set(files)].filter(f => !sensitive(f) && !this.exclude(f));
    const ignored = await this.ignored(candidates);
    const allowed: string[] = [];
    for (const file of candidates) {
      if (ignored.has(file) || file.startsWith('.agentbridge/')) continue;
      try { await safePath(this.root, file); allowed.push(file); } catch { /* omit links/special files */ }
    }
    return allowed.sort();
  }

  async discover(): Promise<{ git: GitState; trackedFiles: string[]; markers: string[]; omitted: number }> {
    if (this.state !== 'ready') return { git: this.state, trackedFiles: [], markers: [], omitted: 0 };
    const all = this.checked(['ls-files', '--cached', '-z', '--', '.']).split('\0').filter(Boolean);
    const allowed = await this.allowed(all);
    const markers = ['package.json', 'tsconfig.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'Makefile', 'CMakeLists.txt']
      .filter(name => allowed.includes(name));
    return { git: this.state, trackedFiles: allowed.slice(0, 200), markers, omitted: all.length - Math.min(200, allowed.length) };
  }

  async progress(count = 5): Promise<Progress> {
    const result: Progress = { git: this.state, commits: [], changes: [], omitted: 0 };
    if (this.state !== 'ready') return result;
    const entries = this.checked(['status', '--porcelain=v1', '-z', '--untracked-files=no', '--ignore-submodules=all']).split('\0');
    const changes: { status: string; file: string }[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (!entry) continue;
      const status = entry.slice(0, 2);
      const file = entry.slice(3);
      if (/[RC]/.test(status)) {
        const old = entries[++i];
        const both = await this.allowed(old ? [file, old] : []);
        if (!old || both.length !== new Set([file, old]).size) { result.omitted++; continue; }
      }
      changes.push({ status, file });
    }
    const allowed = new Set(await this.allowed(changes.map(c => c.file)));
    result.changes = changes.filter(c => allowed.has(c.file)).slice(0, 100);
    result.omitted += changes.length - result.changes.length;
    const head = this.run(['rev-parse', '--verify', 'HEAD']);
    if (head.code !== 0) return result; // Empty repository still has useful staged status.
    const hashes = this.checked(['log', `-${count}`, '--format=%H']).trim().split('\n').filter(Boolean);
    for (const hash of hashes) {
      if (!/^[a-f0-9]{40,64}$/.test(hash)) throw new Error('Unexpected Git object ID.');
      const files = this.checked(['diff-tree', '--root', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', hash, '--'])
        .split('\0').filter(Boolean);
      const safe = await this.allowed(files);
      result.omitted += files.length - Math.min(100, safe.length);
      result.commits.push({ hash, files: safe.slice(0, 100) });
    }
    return result;
  }
}

export function renderProgress(progress: Progress): string {
  const lines = ['## Git facts', '', `Git inspection: ${progress.git}.`];
  if (progress.git === 'ready') {
    lines.push('', 'Tracked working-tree changes (XY status; no file contents):');
    const changeLabel = (status: string): string => {
      const words: Record<string, string> = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied', U: 'unmerged', T: 'type changed' };
      if (status === '??') return 'untracked';
      return [status[0] !== ' ' ? `staged ${words[status[0]!] ?? 'change'}` : '',
        status[1] !== ' ' ? `unstaged ${words[status[1]!] ?? 'change'}` : ''].filter(Boolean).join('; ');
    };
    lines.push(...(progress.changes.length ? progress.changes.map(c => `- \`${c.status}\` \`${c.file}\` (${changeLabel(c.status)})`) : ['- None.']));
    lines.push('', 'Recent commit IDs and filtered paths (no messages or authors):');
    lines.push(...(progress.commits.length ? progress.commits.map(c => `- ${c.hash.slice(0, 12)}: ${c.files.map(f => `\`${f}\``).join(', ') || '(no eligible paths)'}`) : ['- None.']));
    lines.push('', `Omitted path entries: ${progress.omitted}. Untracked files are not inspected.`);
  } else lines.push('No project file contents or inventory were collected. Use the Git root and install Git for progress facts.');
  return lines.join('\n') + '\n';
}
