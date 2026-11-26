import { validStudy } from './study-tools.js';

const endpoint = 'https://iqlfryqkbmadmirkxlvv.supabase.co/rest/v1/rpc/fca_sync_archive';
const key = 'sb_publishable_aibr2XZrnl8UOewm8sc3Jg_7BUDQTxG';
export const syncCodeKey = 'move-by-move/cloud-code/v1';
export const validCode = code => /^[a-f0-9]{64}$/.test(code);
export const CLOUD_ARCHIVE_ENTRY_LIMIT = 40;
export const CLOUD_ARCHIVE_BYTE_LIMIT = 1_450_000;

export function prepareSyncArchive(entries) {
  const candidates = (Array.isArray(entries) ? entries : [])
    .filter(validStudy)
    .sort((a, b) => b.date - a.date || a.id.localeCompare(b.id));
  const selected = [];
  const encoder = new TextEncoder();
  let byteLength = 2;

  for (const entry of candidates) {
    if (selected.length >= CLOUD_ARCHIVE_ENTRY_LIMIT) break;
    const entryBytes = encoder.encode(JSON.stringify(entry)).byteLength;
    const nextLength = byteLength + (selected.length ? 1 : 0) + entryBytes;
    if (nextLength > CLOUD_ARCHIVE_BYTE_LIMIT) {
      if (!selected.length) {
        throw new Error('A revisão mais recente é grande demais para a sincronização. Ela continua salva neste navegador.');
      }
      break;
    }
    selected.push(entry);
    byteLength = nextLength;
  }

  return { entries: selected, omitted: candidates.length - selected.length };
}

export function newSyncCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function syncArchive(code, entries = null) {
  if (!validCode(code)) throw new Error('Código de sincronização inválido.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ p_code: code, p_entries: entries }),
  });
  if (response.status === 429) throw new Error('O serviço limitou as consultas. Tente daqui a pouco.');
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (payload?.message === 'Archive limit exceeded') throw new Error('O arquivo ainda excede o limite da nuvem. Suas partidas continuam neste navegador.');
    if (payload?.message === 'Sync storage limit reached') throw new Error('A capacidade global de sincronização está cheia. Arquivos sem uso por 180 dias são removidos quando necessário; tente novamente mais tarde.');
    if (payload?.message === 'Archive entry too large') throw new Error('Uma revisão é grande demais para a nuvem. Ela continua salva neste navegador.');
    throw new Error('Falha ao sincronizar. Suas partidas continuam neste navegador.');
  }
  return response.json();
}
