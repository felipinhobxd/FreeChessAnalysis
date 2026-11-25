const endpoint = 'https://iqlfryqkbmadmirkxlvv.supabase.co/rest/v1/rpc/fca_sync_archive';
const key = 'sb_publishable_aibr2XZrnl8UOewm8sc3Jg_7BUDQTxG';
export const syncCodeKey = 'move-by-move/cloud-code/v1';
export const validCode = code => /^[a-f0-9]{64}$/.test(code);

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
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (payload?.message === 'Archive limit exceeded') throw new Error('O arquivo atingiu o limite da nuvem. Suas partidas continuam neste navegador.');
    throw new Error('Falha ao sincronizar. Suas partidas continuam neste navegador.');
  }
  return response.json();
}
