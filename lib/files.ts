"use client"

// Uploaded files stay on the owner's device (IndexedDB holds Blobs; localStorage can't).
// ponytail: plaintext on-device; encrypt (WebCrypto AES-GCM) and move to
// encrypted object storage when accounts + server sync land (PRD §11).

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("hermit-files", 1)
    req.onupgradeneeded = () => req.result.createObjectStore("files")
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction("files", mode).objectStore("files"))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const putFile = (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id))
export const getFile = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id))
export const deleteFile = (id: string) => run("readwrite", (s) => s.delete(id))
export const clearFiles = () => run("readwrite", (s) => s.clear())

export async function sha256(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
