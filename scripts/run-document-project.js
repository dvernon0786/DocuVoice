#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function listTopLevel(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .map(d => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }))
    .filter(x => x.name !== 'node_modules' && x.name !== '_bmad-output');
}

function countFiles(dir) {
  let count = 0;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      if (it.name === 'node_modules' || it.name === '_bmad-output') continue;
      const p = path.join(dir, it.name);
      if (it.isDirectory()) count += countFiles(p);
      else count += 1;
    }
  } catch {}
  return count;
}

async function main() {
  const root = process.cwd();
  const pkgText = safeRead(path.join(root, 'package.json'));
  let pkg = {};
  if (pkgText) {
    try { pkg = JSON.parse(pkgText); } catch {}
  }

  const readme = safeRead(path.join(root, 'README.md')) || '';
  const top = listTopLevel(root);
  const folders = top.filter(t => t.type === 'dir').map(d => d.name);
  const files = top.filter(t => t.type === 'file').map(d => d.name);

  const scan = {
    name: pkg.name || path.basename(root),
    description: pkg.description || readme.split('\n')[0] || '',
    node_version: pkg.engines && pkg.engines.node ? pkg.engines.node : null,
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    top_level_folders: folders,
    top_level_files: files,
    total_files: countFiles(root),
    generated_at: new Date().toISOString(),
  };

  const outDir = path.join(root, '_bmad-output', 'project-knowledge');
  fs.mkdirSync(outDir, { recursive: true });

  const indexMd = [];
  indexMd.push(`# Project Overview: ${scan.name}\n`);
  if (scan.description) indexMd.push(`${scan.description}\n`);
  indexMd.push(`**Scanned:** ${scan.generated_at}\n`);
  indexMd.push('## Tech Stack\n');
  if (Object.keys(scan.dependencies).length) {
    indexMd.push('**Dependencies:**\n');
    for (const [k, v] of Object.entries(scan.dependencies)) indexMd.push(`- ${k}@${v}`);
    indexMd.push('\n');
  }
  if (Object.keys(scan.devDependencies).length) {
    indexMd.push('**Dev Dependencies:**\n');
    for (const [k, v] of Object.entries(scan.devDependencies)) indexMd.push(`- ${k}@${v}`);
    indexMd.push('\n');
  }
  indexMd.push('## Top-level folders\n');
  for (const f of scan.top_level_folders) indexMd.push(`- ${f}`);
  indexMd.push('\n## Top-level files\n');
  for (const f of scan.top_level_files) indexMd.push(`- ${f}`);
  indexMd.push(`\n**Total files (approx):** ${scan.total_files}\n`);

  fs.writeFileSync(path.join(outDir, 'index.md'), indexMd.join('\n'));
  fs.writeFileSync(path.join(outDir, 'project-scan-report.json'), JSON.stringify(scan, null, 2));

  console.log('Document project: generated', Object.keys(scan).length, 'fields');
  console.log('Outputs:');
  console.log(' -', path.join('_bmad-output', 'project-knowledge', 'index.md'));
  console.log(' -', path.join('_bmad-output', 'project-knowledge', 'project-scan-report.json'));
}

main().catch(err => { console.error(err); process.exit(1); });
