#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const exclude = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '_bmad-output']);

const items = fs.readdirSync(root, { withFileTypes: true });
const folders = items.filter(i => i.isDirectory() && !exclude.has(i.name)).map(d => d.name);

fs.mkdirSync(path.join(root, '_bmad-output', 'project-knowledge'), { recursive: true });

for (const f of folders) {
  const out = path.join('_bmad-output', 'project-knowledge', `deep-dive-${f.replace(/[^a-zA-Z0-9_-]/g,'_')}.md`);
  console.log('\n----- Running deep-dive for top-level:', f, '->', out, '-----\n');
  try {
    // keep heap modest per-run
    execSync(`node --max-old-space-size=1024 scripts/deep-dive.js --target ${f} --out ${out}`, {
      stdio: 'inherit',
      cwd: root,
      env: process.env,
    });
  } catch (err) {
    console.error('Error scanning', f, err && err.message ? err.message : err);
  }
}

console.log('\nDeep-dive per-top-level completed. Files are in _bmad-output/project-knowledge/');
