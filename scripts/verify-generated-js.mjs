import { readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

async function walk(dir) {
  const files = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await walk(path)); else if (path.endsWith('.js')) files.push(path);
  }
  return files;
}
const files = await walk('dist');
if (!files.length) throw new Error('No generated production JavaScript files found');
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`JavaScript syntax failure in ${file}\n${result.stderr || result.stdout}`);
}
console.log(`Generated JavaScript syntax PASS: ${files.length} files checked.`);
