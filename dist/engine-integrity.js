export const STOCKFISH_INTEGRITY = Object.freeze({
  'stockfish-19.js': '623ee70a10d6dc202375127b49e2e1822635f9ab07693ae7be28e50a787f6218',
  'stockfish-19.wasm': 'a599d78d72e0722d8895be84aca8b492d12e8bba3cdfcbcbc4a64017888c6667',
  'stockfish-19-single.js': '8071dee87312f74805a859de933e1a1ef465579ab1a51fbd597388cdce9d444d',
  'stockfish-19-single.wasm': '991bede2f253ebb08ff01fcc48270f4b9c8e66b12d5bd5f8d6f52eb3e3b3a740',
  'stockfish-19-lite-single.js': 'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a',
  'stockfish-19-lite-single.wasm': 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de',
});

export async function verifyAsset(response, expectedHash) {
  if (!response?.ok) throw new Error('Arquivo externo do Stockfish indisponível.');
  if (!/^[a-f0-9]{64}$/.test(expectedHash || '')) {
    throw new Error('Hash de integridade do Stockfish ausente ou inválido.');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador não oferece verificação criptográfica segura.');
  }
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actualHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actualHash !== expectedHash) {
    throw new Error('A verificação SHA-256 do Stockfish falhou. O arquivo não será executado.');
  }
  return bytes;
}
