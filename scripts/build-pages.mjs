import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = join(root, 'site');

execFileSync('npx', ['tsc'], { cwd: root, stdio: 'inherit' });

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(join(root, 'dist'), siteDir, { recursive: true });
await cp(join(root, 'src', 'styles.css'), join(siteDir, 'styles.css'));

const html = (await readFile(join(root, 'index.html'), 'utf8'))
  .replace('./src/styles.css', './styles.css')
  .replace('./dist/main.js', './main.js');

await writeFile(join(siteDir, 'index.html'), html);

console.log(`Pages bundle ready in ${siteDir}`);
