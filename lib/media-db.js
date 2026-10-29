const DB_NAME = "tinparatan";
const STORE = "media";
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(db, mode, run) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = run(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  });
}

export async function putMedia(id, blob, meta = {}) {
  const db = await openDb();
  const record = {
    blob,
    type: blob.type || meta.type || "application/octet-stream",
    name: meta.name || "",
    updatedAt: Date.now(),
  };
  await transactionDone(db, "readwrite", (store) => store.put(record, id));
  revokeMedia(id);
  return id;
}

export async function getMedia(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMedia(id) {
  const db = await openDb();
  await transactionDone(db, "readwrite", (store) => store.delete(id));
  revokeMedia(id);
}

export async function listMedia() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAllKeys();
    request.onsuccess = async () => {
      try {
        const keys = request.result || [];
        const records = [];
        for (const key of keys) {
          const record = await getMedia(key);
          if (record?.blob) records.push({ id: key, ...record });
        }
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearMedia() {
  const db = await openDb();
  await transactionDone(db, "readwrite", (store) => store.clear());
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

const urls = new Map();

export async function mediaUrl(id) {
  if (!id) return "";
  if (urls.has(id)) return urls.get(id);
  const record = await getMedia(id);
  if (!record?.blob) return "";
  const url = URL.createObjectURL(record.blob);
  urls.set(id, url);
  return url;
}

export function revokeMedia(id) {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}
