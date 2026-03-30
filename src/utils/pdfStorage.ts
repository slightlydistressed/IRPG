/**
 * IndexedDB storage for the last uploaded PDF file.
 *
 * Stores a single "uploaded" record so the app can restore the user's PDF
 * after a page reload without requiring another upload.  The bundled irpg.pdf
 * is never stored here – it is always fetched from the network/SW cache.
 */

const DB_NAME = 'irpg-pdf-db';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const RECORD_KEY = 'uploaded';

interface PdfRecord {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Persist a user-uploaded PDF file in IndexedDB. */
export async function savePdfToIdb(file: File): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const record: PdfRecord = {
      id: RECORD_KEY,
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    };
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieve the previously saved uploaded PDF.
 * Returns `null` if nothing has been stored yet.
 */
export async function loadPdfFromIdb(): Promise<File | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    tx.oncomplete = () => {
      db.close();
      const record = req.result as PdfRecord | undefined;
      if (!record) {
        resolve(null);
        return;
      }
      resolve(
        new File([record.blob], record.name, {
          type: record.type || 'application/pdf',
          lastModified: record.lastModified,
        }),
      );
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Remove the stored uploaded PDF so the app reverts to the bundled file. */
export async function deletePdfFromIdb(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
