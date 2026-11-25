import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { lookupChessGame } from './api/import-pgn.js';

const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const deployment = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8'));
const port = Number(process.argv[2]) || 8787;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const path = decodeURI(url.pathname);
    if (path === '/api/import-pgn' && request.method === 'GET') {
      const pgn = await lookupChessGame(Object.fromEntries(url.searchParams));
      response.writeHead(pgn ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' })
        .end(JSON.stringify(pgn ? { pgn } : { error: 'Não encontrei a partida. Informe um dos jogadores ou importe o PGN.' }));
      return;
    }
    if (path === '/analysis/') {
      response.writeHead(308, { Location: '/analysis' }).end();
      return;
    }
    const route = ['/', '/analysis'].includes(path) ? '/index.html' : path === '/notices' ? '/notices.html' : path;
    const file = resolve(root, '.' + route);
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error('missing');
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-cache');
    for (const { key, value } of deployment.headers[0].headers) response.setHeader(key, value);
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Arquivo não encontrado.');
  }
}).listen(port, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + port + '/analysis';
  process.stdout.write(url + '\n');
  if (process.argv.includes('--open') && process.platform === 'win32') {
    import('node:child_process').then(({ spawn }) => {
      const launcher = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
      launcher.on('error', () => {});
      launcher.unref();
    });
  }
});
