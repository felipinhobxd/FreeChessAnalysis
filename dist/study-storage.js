const database = 'move-by-move-study-v1';
let opening;
function openStore() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('games', { keyPath: 'id' });
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); opening = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  }).catch(error => { opening = null; throw error; });
  return opening;
}

async function transaction(mode, operation) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', mode);
    const request = operation(tx.objectStore('games'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Não foi possível abrir o arquivo local.'));
  });
}

export const listStudies = () => transaction('readonly', store => store.getAll());
export const getStudy = id => transaction('readonly', store => store.get(id));
export const putStudy = record => transaction('readwrite', store => {
  const current = store.get(record.id);
  current.onsuccess = () => {
    if (!current.result || record.date >= current.result.date) store.put(record);
  };
  return current;
});
export async function gameFingerprint(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
