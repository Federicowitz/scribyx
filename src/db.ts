const DB_NAME = 'NarrativeDB';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';

export const db = {
  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e: any) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_DOCS)) {
          database.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveDocument(id: string, data: any): Promise<void> {
    const database = await this.init();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_DOCS, 'readwrite');
      tx.objectStore(STORE_DOCS).put({ id, ...data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadDocument(id: string): Promise<any | null> {
    const database = await this.init();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_DOCS, 'readonly');
      const request = tx.objectStore(STORE_DOCS).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(tx.error);
    });
  }
};