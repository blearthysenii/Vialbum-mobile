const databaseName = 'vialbum-journey-photos';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Your browser could not save the selected photos.'));
  });
}
export async function storeWebPhoto(key: string, uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('This photo is no longer available. Please select it again.');
  const blob = await response.blob();
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    transaction.objectStore('photos').put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('There is not enough browser storage to save this photo.'));
  }).finally(() => db.close());
}
export async function readWebPhoto(key: string): Promise<string | null> {
  const db = await database();
  return new Promise<string | null>((resolve, reject) => {
    const request = db.transaction('photos').objectStore('photos').get(key);
    request.onsuccess = () => resolve(request.result instanceof Blob ? URL.createObjectURL(request.result) : null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}
export async function deleteWebPhotos(keys?: string[]) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    if (keys) keys.forEach(key => store.delete(key)); else store.clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}
