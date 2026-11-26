import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = join(root, 'node_modules', 'chess.js', 'package.json');
const metadata = JSON.parse(readFileSync(packagePath, 'utf8'));
if (metadata.version !== '1.4.0') {
  throw new Error('Versão inesperada de chess.js: ' + metadata.version + '. Esperado 1.4.0.');
}

const sourcePath = join(root, 'node_modules', 'chess.js', 'dist', 'esm', 'chess.js');
const targetPath = join(root, 'dist', 'vendor', 'chess.js');
if (statSync(sourcePath).size < 1000) throw new Error('O arquivo de chess.js parece incompleto.');
mkdirSync(dirname(targetPath), { recursive: true });
copyFileSync(sourcePath, targetPath);
process.stdout.write('chess.js 1.4.0 copiado para dist/vendor/chess.js.\n');
