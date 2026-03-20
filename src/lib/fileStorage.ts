// Simple IndexedDB file storage (store ArrayBuffer) for persisting selected files across reloads
export function saveFile(key: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    // Read file into ArrayBuffer first, then open a transaction and put synchronously
    file.arrayBuffer().then((arr) => {
      const req = indexedDB.open('docucards-files', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('files', 'readwrite')
        const store = tx.objectStore('files')
        try {
          store.put({ name: file.name, type: file.type, data: arr }, key)
        } catch (e) {
          db.close()
          reject(e)
          return
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    }).catch(err => reject(err))
  })
}

export function loadFile(key: string): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('docucards-files', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('files', 'readonly')
      const store = tx.objectStore('files')
      const g = store.get(key)
      g.onsuccess = () => {
        const val = g.result
        if (!val) { db.close(); resolve(null); return }
        try {
          const blob = new Blob([val.data])
          const f = new File([blob], val.name, { type: val.type })
          db.close()
          resolve(f)
        } catch (e) {
          db.close()
          resolve(null)
        }
      }
      g.onerror = () => { db.close(); reject(g.error) }
    }
    req.onerror = () => reject(req.error)
  })
}

export function removeFile(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('docucards-files', 1)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('files', 'readwrite')
      const store = tx.objectStore('files')
      store.delete(key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
    req.onerror = () => reject(req.error)
  })
}
