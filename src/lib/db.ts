// Minimal IndexedDB helper for storing cards
const DB_NAME = 'docucards-db'
const DB_VERSION = 1
const STORE = 'cards'
const DECK_STORE = 'decks'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(DECK_STORE)) {
        db.createObjectStore(DECK_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addCard(card: any) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.add(card)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putCard(card: any) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(card)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllCards() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export type Card = {
  id?: number
  deckId?: number
  front: string
  back: string
  tags?: string[]
  meta?: { sourcePage?: number; chunkIndex?: number }
  state?: 'new' | 'learning' | 'review'
  interval?: number
  due?: number
}

export async function getDueCards(deckId: number) {
  const all = (await getAllCards()) as Card[]
  const now = Date.now()
  const filtered = all.filter(c => (c.deckId ?? 0) === deckId)
  // Determine state: if no due -> new
  const due = filtered.filter(c => {
    if (!c.due) return true
    return c.due <= now
  })
  // sort: new first, then by due asc
  due.sort((a, b) => {
    const sa = a.state === 'new' ? 0 : 1
    const sb = b.state === 'new' ? 0 : 1
    if (sa !== sb) return sa - sb
    return (a.due ?? 0) - (b.due ?? 0)
  })
  return due
}

export async function updateDeckCounts(deckId: number) {
  // lightweight: no-op for now, could write aggregates to another store
  return true
}

export async function deleteCard(id: number) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

export async function addDeck(deck: any) {
  const db = await openDB()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(DECK_STORE, 'readwrite')
    const store = tx.objectStore(DECK_STORE)
    const req = store.add(deck)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export function makeNewCard(partial: any): Card {
  return {
    ...partial,
    front: partial.front || '',
    back: partial.back || '',
    tags: partial.tags || [],
    meta: partial.meta || {},
    state: 'new',
    interval: 0,
    due: Date.now()
  }
}
