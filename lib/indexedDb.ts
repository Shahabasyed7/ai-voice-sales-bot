import { CallRecord } from './types';

const DB_NAME = 'leadflow_ai_sales_db';
const DB_VERSION = 1;
const STORE_NAME = 'calls';

/**
 * Open or upgrade the browser IndexedDB database
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save a call record with its audio Blob to IndexedDB
 */
export async function saveCallToIndexedDB(call: CallRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Prepare record for storage: preserve audioBlob natively, omit transient object URL
    const recordToSave = {
      ...call,
      audioRecordingUrl: undefined // Transient URL will be reconstructed from audioBlob on load
    };

    const request = store.put(recordToSave);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve all call records from IndexedDB sorted newest first.
 * Automatically generates live Object URLs for audio blobs so playback works seamlessly.
 */
export async function getCallsFromIndexedDB(): Promise<CallRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result as CallRecord[]) || [];

      // Sort newest first
      records.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      // Create transient object URLs for audio playback
      const hydrated = records.map((call) => {
        let audioUrl = call.audioRecordingUrl;
        if (call.audioBlob && call.audioBlob instanceof Blob) {
          try {
            audioUrl = URL.createObjectURL(call.audioBlob);
          } catch (e) {
            console.warn('Failed to create object URL for audio blob:', e);
          }
        }
        return {
          ...call,
          audioRecordingUrl: audioUrl
        };
      });

      resolve(hydrated);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all call records from IndexedDB (optional helper)
 */
export async function clearAllCallsFromIndexedDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
