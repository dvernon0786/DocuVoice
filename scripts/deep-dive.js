#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
// simple arg parsing to avoid external deps
const rawArgs = process.argv.slice(2);
let target = '.';
let outFile = path.join(root, '_bmad-output', 'project-knowledge', 'deep-dive-root.md');
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--target' || a === '-t') target = rawArgs[i+1] || target;
  if (a === '--out' || a === '-o') outFile = rawArgs[i+1] || outFile;
}

const excludeDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '_bmad-output']);
const excludeExt = new Set(['.min.js', '.map']);

function isExcluded(filePath) {
  if (!filePath) return true;
  const parts = filePath.split(path.sep);
  if (parts.some(p => excludeDirs.has(p))) return true;
  for (const ex of excludeExt) if (filePath.endsWith(ex)) return true;
  return false;
}

function walk(dir, cb) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (isExcluded(p)) continue;
    if (it.isDirectory()) walk(p, cb);
    else cb(p);
  }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function extractInfo(content) {
  const lines = content.split(/\r?\n/);
  const loc = lines.length;
  const firstCommentMatch = content.match(/(?:\/\*\*[\s\S]*?\*\/)|(?:\/\/[^\n]*)(?:\n|$)/);
  const firstComment = firstCommentMatch ? firstCommentMatch[0].trim() : '';

  const importRe = /import\s+[^;]*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/gm;
  let m; const imports = [];
  while ((m = importRe.exec(content))) {
    const imp = m[1] || m[2]; if (imp) imports.push(imp);
  }

  const exportRe = /export\s+(?:default\s+)?(?:function|class|const|let|var|async)?\s*([A-Za-z0-9_\$]+)/gm;
  const exports = [];
  while ((m = exportRe.exec(content))) { if (m[1]) exports.push(m[1]); }

  const moduleExportsRe = /module\.exports\s*=\s*([A-Za-z0-9_\$]+)/g;
  while ((m = moduleExportsRe.exec(content))) { if (m[1]) exports.push(m[1]); }

  const funcRe = /function\s+([A-Za-z0-9_\$]+)\s*\(/g;
  const classes = [];
  while ((m = /class\s+([A-Za-z0-9_\$]+)/g.exec(content))) { if (m[1]) classes.push(m[1]); }

  const todos = [];
  const todoRe = /(?:TODO|FIXME)[:]?\s*(.*)/gi;
  while ((m = todoRe.exec(content))) { if (m[1]) todos.push(m[1].trim()); }

  return { loc, firstComment, imports, exports, classes, todos };
}

function resolveRelativeImport(fromFile, imp) {
  if (!imp.startsWith('.')) return null;
  const base = path.dirname(fromFile);
  const candidate = path.resolve(base, imp);
  // try common extensions
  const exts = ['', '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.md'];
  for (const e of exts) {
    const p = candidate + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.relative(root, p);
  }
  // if it's a directory with index
  for (const e of ['index.js', 'index.ts', 'index.mjs']) {
    const p = path.join(candidate, e);
    if (fs.existsSync(p)) return path.relative(root, p);
  }
  return null;
}

function makeHeading(title, level=2) { return '#'.repeat(level) + ' ' + title + '\n\n'; }

// Begin
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const out = fs.createWriteStream(outFile, { encoding: 'utf8' });
out.write('# Deep-Dive: Repository Scan\n\n');
out.write(`Scanned at: ${new Date().toISOString()}\n\n`);

let count = 0;
console.log('Scanning files (this may take a while)...');
out.write(makeHeading('Files', 2));
walk(path.resolve(root, target), (filePath) => {
  const rel = path.relative(root, filePath);
  const content = readFileSafe(filePath);
  if (content === null) return;
  const info = extractInfo(content);

  out.write(`## ${rel}\n\n`);
  const purpose = info.firstComment ? info.firstComment.replace(/\n/g, ' ').slice(0, 400) : 'No leading comment.';
  out.write(`**Purpose (first comment / summary):** ${purpose}\n\n`);
  out.write(`- **Lines of code:** ${info.loc}\n`);
  out.write(`- **Exports:** ${info.exports.length ? info.exports.join(', ') : 'None detected'}\n`);
  out.write(`- **Classes:** ${info.classes.length ? info.classes.join(', ') : 'None detected'}\n`);
  out.write(`- **Imports (raw):** ${info.imports.length ? info.imports.join(', ') : 'None'}\n`);

  // attempt to resolve a few relative imports (limited to first 8)
  const from = path.resolve(root, rel);
  const resolved = [];
  for (const imp of info.imports.slice(0, 8)) {
    const r = resolveRelativeImport(from, imp);
    if (r) resolved.push(r);
  }
  out.write(`- **Imports (resolved relative, up to 8):** ${resolved.length ? resolved.join(', ') : 'None'}\n`);
  out.write(`- **TODOs/FIXMEs:** ${info.todos.length ? info.todos.join(' | ') : 'None'}\n\n`);
  out.write('---\n\n');

  count++;
  if (count % 200 === 0) console.log('Files processed:', count);
});

out.write('\n\n');
out.write(`Total files analyzed: ${count}\n`);

out.end(() => { console.log('Deep-dive written to', outFile); });
