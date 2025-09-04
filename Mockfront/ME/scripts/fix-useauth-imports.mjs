import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const HOOK_ABS = path.join(root, 'app', 'hooks', 'useAuth.ts'); // cible

function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    // ignore node_modules et .next
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else if (/\.(t|j)sx?$/.test(ent.name)) out.push(p);
  }
  return out;
}

function toPosix(p) { return p.split(path.sep).join('/'); }

const files = listFiles(path.join(root, 'app'));
let changed = 0;

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');

  // repère les imports existants vers hooks/useAuth (avec n'importe quel relatif)
  const re = /from\s+['"](?:(?:\.\.\/)+|\.\/)?hooks\/useAuth['"]/g;

  if (!re.test(src)) continue; // rien à faire

  // chemin relatif correct depuis ce fichier vers app/hooks/useAuth.ts
  const rel = path.relative(path.dirname(file), HOOK_ABS); // ex: ../hooks/useAuth.ts
  let relNoExt = rel.replace(/\.tsx?$/i, '');             // enlever extension
  if (!relNoExt.startsWith('.')) relNoExt = './' + relNoExt; // s'assurer d'un relatif

  const next = src.replace(re, `from '${toPosix(relNoExt)}'`);

  if (next !== src) {
    fs.writeFileSync(file, next, 'utf8');
    console.log('✓', toPosix(path.relative(root, file)), '→', toPosix(relNoExt));
    changed++;
  }
}

console.log(`Done. Updated ${changed} file(s).`);
