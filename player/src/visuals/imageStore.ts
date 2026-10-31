// The listener's background picture, kept in IndexedDB so it survives a reload. Every call settles quietly: when storage is
// unavailable the picture simply lasts for this visit.

const DATABASE = 'polyphon-visuals';
const STORE = 'files';
const KEY = 'background';

/** The stored picture, or null when there is none (or storage cannot be read) */
export async function loadImage(): Promise<Blob | null> {
  try {
    const value = await request<unknown>('readonly', (store) => store.get(KEY));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

/** Keep a picture; resolves false when it could not be stored */
export async function saveImage(blob: Blob): Promise<boolean> {
  try {
    await request('readwrite', (store) => store.put(blob, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearImage(): Promise<void> {
  try {
    await request('readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing stored, or storage is blocked: either way there is nothing to remove
  }
}

/** Decode a picture into something a canvas can draw, at most `max` pixels on its longer side (big photos cost every frame) */
export async function decodeImage(blob: Blob, max = 2560): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const g = canvas.getContext('2d');
    if (!g) throw new Error('This browser cannot draw the picture');
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error('The picture store is blocked by another tab'));
  });
}

async function request<T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const r = make(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(r.result as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
