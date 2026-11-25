import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sources = ['serve.mjs'];
for (const dir of ['dist', 'tools', 'tests']) {
  for (const file of readdirSync(dir)) {
    if (/\.m?js$/.test(file)) sources.push(dir + '/' + file);
  }
}
for (const source of sources) {
  const result = spawnSync(process.execPath, ['--check', source], {stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Syntax OK in ' + sources.length + ' files.');
