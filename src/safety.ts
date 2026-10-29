import { lstat, open, realpath, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const MAX_TEXT = 24 * 1024;
export const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
export const normalize = (text: string): string => text.replace(/\r\n?/g, '\n').trim() + '\n';

export function relativePath(input: string): string {
  const value = input.replaceAll('\\', '/');
  if (!value || value.startsWith('/') || /^[a-z]:/i.test(value) ||
      value.split('/').some(p => !p || p === '.' || p === '..' || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p) || /[. ]$/.test(p)) ||
      /[\x00-\x1f\x7f`<>:"|?*]/.test(value)) {
    throw new Error('Unsafe project-relative path.');
  }
  return value;
}

// Conservative filename policy, including tracked secrets. No contents are needed.
export function sensitive(input: string): boolean {
  let value: string;
  try { value = relativePath(input).toLowerCase(); } catch { return true; }
  return value.split('/').some(p =>
    p.startsWith('.') && !['.github', '.agentbridge', '.agentbridgeignore'].includes(p) ||
    /^(node_modules|vendor|dist|build|coverage|secrets?|credentials?|private|backups?|sessions?|transcripts?|chats?)$/.test(p) ||
    /(^|[._-])(secrets?|credentials?|tokens?|passwords?|private|sessions?|transcripts?)([._-]|$)/.test(p) ||
    /^(auth\.json|service[-_]?accounts?(?:[-_]?key)?\.json|kubeconfig)$/.test(p) ||
    /\.(pem|key|p8|p12|pfx|jks|keystore|sqlite|db|log|tfstate|tfvars)(?:\.backup)?$/i.test(p) ||
    /^(id_rsa|id_ed25519|.*\.env(?:\..*)?|env(?:\..*)?|.*\.local\..*)$/.test(p));
}

export function assertSafeText(text: string): void {
  if (Buffer.byteLength(text) > MAX_TEXT) throw new Error(`Context exceeds ${MAX_TEXT} bytes; keep handoffs concise.`);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new Error('Control characters are not allowed in context.');
  if (/-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b|(?:api[_-]?key|password|access[_-]?token|secret)\s*[:=]\s*["']?[^\s"'<>]{8,}/i.test(text)) {
    throw new Error('Possible credential detected; remove it before saving or generating context.');
  }
  // Generated agent files must not trigger either agent's implicit @file expansion.
  if (/(^|\s)@\S+/m.test(text)) {
    throw new Error('File imports (@path) are not supported; write reviewed context inline.');
  }
}

export function exclusionMatcher(text: string): (file: string) => boolean {
  const patterns = text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const regexes = patterns.map(pattern => {
    if (pattern.startsWith('!') || pattern.includes('\\') || pattern.includes('..') || /[\[\]{}]/.test(pattern)) {
      throw new Error('Unsupported .agentbridgeignore pattern; use *, **, ?, and directory/ patterns.');
    }
    const anchored = pattern.startsWith('/');
    let p = pattern.replace(/^\//, '');
    const directory = p.endsWith('/');
    p = p.replace(/\/$/, '');
    let expression = '';
    for (let i = 0; i < p.length; i++) {
      const c = p[i]!;
      if (c === '*' && p[i + 1] === '*') {
        i++;
        if (p[i + 1] === '/') { expression += '(?:.*/)?'; i++; }
        else expression += '.*';
      } else if (c === '*') expression += '[^/]*';
      else if (c === '?') expression += '[^/]';
      else expression += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp((anchored || p.includes('/') ? '^' : '(^|/)') + expression + (directory ? '(/|$)' : '$'), 'i');
  });
  return file => regexes.some(r => r.test(file));
}

export async function projectRoot(input: string): Promise<string> {
  const root = await realpath(path.resolve(input));
  if (!(await lstat(root)).isDirectory()) throw new Error('Project path must be a directory.');
  return root;
}

// Reject symlinks/junctions in every existing path component and hard-linked files.
export async function safePath(root: string, relative: string): Promise<string> {
  const parts = relativePath(relative).split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]!);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : (!stat.isFile() && !stat.isDirectory())) ||
          (stat.isFile() && stat.nlink > 1)) throw new Error('Unsafe linked or special project path.');
      const resolved = await realpath(current);
      const rel = path.relative(root, resolved);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path escapes project.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
  }
  return path.join(root, ...parts);
}

export async function readText(root: string, relative: string): Promise<string | undefined> {
  const file = await safePath(root, relative);
  let handle;
  try {
    handle = await open(file, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink > 1 || stat.size > MAX_TEXT) throw new Error('Unsafe or oversized context file.');
    const bytes = await handle.readFile();
    if (bytes.length > MAX_TEXT) throw new Error('Context grew beyond the size limit while reading.');
    // Preserve BOM bytes in backups and hashes; normalization removes it only in generated text.
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error('Context files must be valid UTF-8.'); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  } finally { await handle?.close(); }
}

export async function writeText(root: string, relative: string, content: string, previous?: string): Promise<void> {
  const file = await safePath(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await safePath(root, relative);
  if (await readText(root, relative) !== previous) throw new Error('File changed during operation; retry after review.');
  if (previous === undefined) {
    const handle = await open(file, 'wx', 0o600);
    try { await handle.writeFile(content); } finally { await handle.close(); }
    return;
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temp, 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    await safePath(root, relative);
    if (await readText(root, relative) !== previous) throw new Error('File changed during operation; retry after review.');
    await rename(temp, file);
  } finally { await unlink(temp).catch(() => {}); }
}
