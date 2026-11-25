const invalid = /^[A-Za-z0-9_-]{1,30}$/;
const chessHost = 'https://api.chess.com';
const monthPattern = /\/games\/(\d{4})\/(0[1-9]|1[0-2])$/;

async function json(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Move by Move (public chess game import)' },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function lookupChessGame({ type, id, account, fetchJson = json }) {
  if (!['live', 'daily'].includes(type) || !/^\d{1,16}$/.test(id)) return null;
  const metadata = await fetchJson('https://www.chess.com/callback/' + type + '/game/' + id).catch(() => null);
  const tags = metadata?.game?.pgnHeaders ?? metadata?.pgnHeaders ?? {};
  const matchDate = /^(\d{4})\.(0[1-9]|1[0-2])\./.exec(tags.UTCDate || tags.Date || '');
  const names = [...new Set([account, tags.White, tags.Black].filter(value => typeof value === 'string' && invalid.test(value))
    .map(name => name.toLowerCase()))].slice(0, 3);

  const readMonth = async url => {
    const list = await fetchJson(url).catch(() => null);
    return list?.games?.find(game => game.rules === 'chess' && typeof game.pgn === 'string' &&
      ['/game/' + type + '/' + id, '/analysis/game/' + type + '/' + id].includes(safePath(game.url)))?.pgn ?? null;
  };

  const queries = [];
  for (const name of names) {
    const base = chessHost + '/pub/player/' + encodeURIComponent(name) + '/games/';
    if (matchDate) {
      const target = base + matchDate[1] + '/' + matchDate[2];
      const result = await readMonth(target);
      if (result) return result;
    }
    const index = await fetchJson(base + 'archives').catch(() => null);
    for (const url of (index?.archives ?? []).slice(-8).reverse()) {
      if (typeof url !== 'string' || !url.startsWith(base) || !monthPattern.test(url)) continue;
      if (matchDate && url.endsWith('/' + matchDate[1] + '/' + matchDate[2])) continue;
      queries.push(url);
    }
    // Use the participant and exact date when available, with a bounded
    // sequential search in the user's recent public archive as a fallback.
    if (account && !matchDate) break;
  }
  for (const url of queries.slice(0, 8)) {
    const result = await readMonth(url);
    if (result) return result;
  }
  return null;
}

function safePath(url) {
  try { return new URL(url).pathname; } catch { return ''; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const { type, id, account } = req.query;
  if (!['live', 'daily'].includes(type) || typeof id !== 'string' || !/^\d{1,16}$/.test(id)) {
    return res.status(400).json({ error: 'Link do Chess.com inválido.' });
  }
  try {
    const pgn = await lookupChessGame({ type, id, account });
    if (pgn) return res.status(200).json({ pgn });
    return res.status(404).json({ error: 'Não encontrei a partida no arquivo público. Informe um dos jogadores ou importe o PGN.' });
  } catch {
    return res.status(502).json({ error: 'O Chess.com está indisponível. Você também pode importar o PGN.' });
  }
}
