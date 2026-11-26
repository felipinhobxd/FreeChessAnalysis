const invalid = /^[A-Za-z0-9_-]{1,30}$/;
const chessHost = 'https://api.chess.com';
const monthPattern = /\/games\/(\d{4})\/(0[1-9]|1[0-2])$/;

export const CHESSCOM_LOOKUP_TIMEOUT_MS = 8000;
const UPSTREAM_TIMEOUT_MS = 2500;
const ARCHIVE_MONTH_LIMIT = 8;
const ARCHIVE_LOOKUP_CONCURRENCY = 4;
export const CHESSCOM_IMPORT_CONCURRENCY = 6;
const RATE_LIMIT_MESSAGE = 'O serviço limitou as consultas. Tente daqui a pouco.';

class ChessComRateLimit extends Error {
  constructor(retryAfter) {
    super(RATE_LIMIT_MESSAGE);
    const delay = /^\d+$/.test(retryAfter ?? '')
      ? Number(retryAfter)
      : (Date.parse(retryAfter) - Date.now()) / 1000;
    this.seconds = Number.isFinite(delay) ? Math.min(300, Math.max(1, Math.ceil(delay))) : 30;
  }
}

async function json(url, { signal } = {}) {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)])
    : AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Move by Move (public chess game import)' },
    signal: requestSignal,
  });
  if (response.status === 429) throw new ChessComRateLimit(response.headers.get('Retry-After'));
  if (!response.ok) return null;
  return response.json();
}

async function mapConcurrent(items, limit, mapper, signal) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      signal.throwIfAborted();
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function lookupChessGame({
  type,
  id,
  account,
  fetchJson = json,
  timeoutMs = CHESSCOM_LOOKUP_TIMEOUT_MS,
  signal: parentSignal,
} = {}) {
  if (!['live', 'daily'].includes(type) || !/^\d{1,16}$/.test(id || '')) return null;

  const controller = new AbortController();
  const signal = parentSignal
    ? AbortSignal.any([parentSignal, controller.signal])
    : controller.signal;
  const duration = Number.isFinite(timeoutMs) ? Math.max(1, timeoutMs) : CHESSCOM_LOOKUP_TIMEOUT_MS;
  let timer;
  let rejectDeadline;
  const deadline = new Promise((resolve, reject) => { rejectDeadline = reject; });
  const aborted = new Promise((resolve, reject) => {
    const rejectAbort = () => reject(signal.reason || new DOMException('Consulta cancelada.', 'AbortError'));
    if (signal.aborted) rejectAbort();
    else signal.addEventListener('abort', rejectAbort, { once: true });
  });

  const work = (async () => {
    const read = async url => {
      signal.throwIfAborted();
      try {
        return await fetchJson(url, { signal });
      } catch (error) {
        if (signal.aborted) throw signal.reason || error;
        if (error instanceof ChessComRateLimit) throw error;
        return null;
      }
    };

    const metadata = await read('https://www.chess.com/callback/' + type + '/game/' + id);
    const tags = metadata?.game?.pgnHeaders ?? metadata?.pgnHeaders ?? {};
    const matchDate = /^(\d{4})\.(0[1-9]|1[0-2])\./.exec(tags.UTCDate || tags.Date || '');
    const names = [...new Set([account, tags.White, tags.Black]
      .filter(value => typeof value === 'string' && invalid.test(value))
      .map(name => name.toLowerCase()))].slice(0, 3);

    const readMonth = async url => {
      const list = await read(url);
      return list?.games?.find(game => game.rules === 'chess' && typeof game.pgn === 'string' &&
        ['/game/' + type + '/' + id, '/analysis/game/' + type + '/' + id].includes(safePath(game.url)))?.pgn ?? null;
    };

    if (matchDate && names.length) {
      const exactMonths = names.map(name =>
        chessHost + '/pub/player/' + encodeURIComponent(name) + '/games/' + matchDate[1] + '/' + matchDate[2]
      );
      const exactResults = await mapConcurrent(exactMonths, 3, readMonth, signal);
      const exactMatch = exactResults.find(Boolean);
      if (exactMatch) return exactMatch;
    }

    const queries = [];
    const archiveNames = account && !matchDate ? names.slice(0, 1) : names;
    const archiveLists = await mapConcurrent(archiveNames, 3, async name => {
      const base = chessHost + '/pub/player/' + encodeURIComponent(name) + '/games/';
      return { base, index: await read(base + 'archives') };
    }, signal);

    for (const { base, index } of archiveLists) {
      for (const url of (index?.archives ?? []).slice(-8).reverse()) {
        if (typeof url !== 'string' || !url.startsWith(base) || !monthPattern.test(url)) continue;
        if (matchDate && url.endsWith('/' + matchDate[1] + '/' + matchDate[2])) continue;
        if (!queries.includes(url)) queries.push(url);
      }
      // With an explicit account and no date, only search that account's archive.
      if (account && !matchDate) break;
    }

    const candidates = queries.slice(0, ARCHIVE_MONTH_LIMIT);
    const results = await mapConcurrent(candidates, ARCHIVE_LOOKUP_CONCURRENCY, readMonth, signal);
    return results.find(Boolean) ?? null;
  })();

  timer = setTimeout(() => {
    const error = new DOMException('A busca ao Chess.com excedeu o prazo total.', 'TimeoutError');
    controller.abort(error);
    rejectDeadline(error);
  }, duration);

  try {
    return await Promise.race([work, deadline, aborted]);
  } finally {
    clearTimeout(timer);
    if (!controller.signal.aborted) controller.abort(new DOMException('Consulta concluída.', 'AbortError'));
  }
}

function safePath(url) {
  try { return new URL(url).pathname; } catch { return ''; }
}

export function createImportHandler(lookup = lookupChessGame) {
  let active = 0;
  let cooldownUntil = 0;

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => {
      if (res.destroyed) return;
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    const limited = seconds => {
      res.setHeader('Retry-After', String(seconds));
      send(429, { error: RATE_LIMIT_MESSAGE });
    };

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(405, { error: 'Método não permitido.' });
    }
    const params = new URL(req.url, 'http://127.0.0.1').searchParams;
    const [type] = params.getAll('type');
    const [id] = params.getAll('id');
    const account = params.get('account');
    if (params.getAll('type').length !== 1 || params.getAll('id').length !== 1 ||
        !['live', 'daily'].includes(type) || !/^\d{1,16}$/.test(id)) {
      return send(400, { error: 'Link do Chess.com inválido.' });
    }

    const retryIn = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (retryIn > 0) return limited(retryIn);
    if (active >= CHESSCOM_IMPORT_CONCURRENCY) return limited(3);

    const controller = new AbortController();
    const onAborted = () => controller.abort(new DOMException('Requisição cancelada.', 'AbortError'));
    res.once('close', onAborted);
    active++;
    try {
      const pgn = await lookup({ type, id, account, signal: controller.signal });
      return pgn
        ? send(200, { pgn })
        : send(404, { error: 'Não encontrei a partida no arquivo público. Informe um dos jogadores ou importe o PGN.' });
    } catch (error) {
      if (error instanceof ChessComRateLimit) {
        cooldownUntil = Math.max(cooldownUntil, Date.now() + error.seconds * 1000);
        if (!res.destroyed) return limited(Math.ceil((cooldownUntil - Date.now()) / 1000));
        return;
      }
      if (error?.name === 'TimeoutError') {
        return send(504, { error: 'A consulta ao Chess.com demorou demais. Tente novamente ou importe o PGN diretamente.' });
      }
      if (error?.name === 'AbortError') return send(499, { error: 'Consulta cancelada.' });
      return send(502, { error: 'O Chess.com está indisponível. Você também pode importar o PGN.' });
    } finally {
      active--;
      res.off('close', onAborted);
    }
  };
}

export default createImportHandler();
