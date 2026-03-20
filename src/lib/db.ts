// IndexedDB helper — docucards-db v3
const DB_NAME = 'docucards-db'
const DB_VERSION = 3

export type FSRSState = 'new' | 'learning' | 'review' | 'relearning'

export type Card = {
	id?: number
	deckId: number
	front: string
	back: string
	tags: string[]
	meta: { sourcePage?: number; chunkIndex?: number; excerpt?: string }
	stability: number
	difficulty: number
	elapsedDays: number
	scheduledDays: number
	reps: number
	lapses: number
	state: FSRSState
	lastReview?: number
	nextReview?: number
	createdAt: number
}

export type Deck = {
	id?: number
	name: string
	description?: string
	sourceFile?: string
	totalCards: number
	newCards: number
	dueCards: number
	createdAt: number
	updatedAt: number
}

export type ProcessingJob = {
	id?: number
	deckId: number
	fileName: string
	totalPages: number
	processedPages: number
	status: 'pending' | 'running' | 'paused' | 'done' | 'error'
	lastChunkIndex: number
	errorMsg?: string
	createdAt: number
	updatedAt: number
}

// BUG FIX: Fresh install (oldVersion=0) falls into all blocks correctly.
// Each block creates its store only if not already present — idempotent.
function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onupgradeneeded = (ev) => {
			const db = req.result
			const old = ev.oldVersion  // 0 on fresh install

			// v1: cards store
			if (old < 1) {
				if (!db.objectStoreNames.contains('cards')) {
					const cs = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true })
					cs.createIndex('deckId', 'deckId', { unique: false })
					cs.createIndex('nextReview', 'nextReview', { unique: false })
				}
			}
			// v2: decks store
			if (old < 2) {
				if (!db.objectStoreNames.contains('decks')) {
					db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true })
				}
			}
			// v3: jobs store + ensure prior stores exist for any upgrade path
			if (old < 3) {
				if (!db.objectStoreNames.contains('jobs')) {
					db.createObjectStore('jobs', { keyPath: 'id', autoIncrement: true })
				}
				// Defensive: old DB that somehow skipped v1/v2
				if (!db.objectStoreNames.contains('cards')) {
					const cs = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true })
					cs.createIndex('deckId', 'deckId', { unique: false })
					cs.createIndex('nextReview', 'nextReview', { unique: false })
				}
				if (!db.objectStoreNames.contains('decks')) {
					db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true })
				}
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

// ── Decks ──────────────────────────────────────────────────────────────────

export async function addDeck(deck: Omit<Deck, 'id'>): Promise<number> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('decks', 'readwrite')
		const req = tx.objectStore('decks').add(deck)
		req.onsuccess = () => resolve(req.result as number)
		req.onerror = () => reject(req.error)
	})
}

export async function updateDeck(deck: Deck): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('decks', 'readwrite')
		const req = tx.objectStore('decks').put(deck)
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
	})
}

export async function getAllDecks(): Promise<Deck[]> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const req = db.transaction('decks', 'readonly').objectStore('decks').getAll()
		req.onsuccess = () => resolve(req.result as Deck[])
		req.onerror = () => reject(req.error)
	})
}

export async function getDeck(id: number): Promise<Deck | undefined> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const req = db.transaction('decks', 'readonly').objectStore('decks').get(id)
		req.onsuccess = () => resolve(req.result as Deck | undefined)
		req.onerror = () => reject(req.error)
	})
}

// BUG FIX: deleteDeck uses a single transaction for card deletion to avoid
// opening multiple DB connections sequentially which can cause IDB locking
export async function deleteDeck(id: number): Promise<void> {
	const db = await openDB()

	// Delete all cards in one transaction
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction('cards', 'readwrite')
		const store = tx.objectStore('cards')
		const idx = store.index('deckId')
		const req = idx.openCursor(IDBKeyRange.only(id))
		req.onsuccess = () => {
			const cursor = req.result
			if (cursor) {
				cursor.delete()
				cursor.continue()
			}
		}
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})

	// Then delete the deck record
	return new Promise((resolve, reject) => {
		const tx = db.transaction('decks', 'readwrite')
		const req = tx.objectStore('decks').delete(id)
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
	})
}

// ── Cards ──────────────────────────────────────────────────────────────────

export function makeNewCard(partial: Partial<Card> & { deckId: number; front: string; back: string }): Card {
	return {
		deckId: partial.deckId,
		front: partial.front,
		back: partial.back,
		tags: partial.tags ?? [],
		meta: partial.meta ?? {},
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		state: 'new',
		nextReview: Date.now(),
		createdAt: Date.now(),
	}
}

export async function addCard(card: Omit<Card, 'id'>): Promise<number> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('cards', 'readwrite')
		const req = tx.objectStore('cards').add(card)
		req.onsuccess = () => resolve(req.result as number)
		req.onerror = () => reject(req.error)
	})
}

export async function putCard(card: Card): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('cards', 'readwrite')
		const req = tx.objectStore('cards').put(card)
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
	})
}

export async function getCardsByDeck(deckId: number): Promise<Card[]> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('cards', 'readonly')
		const idx = tx.objectStore('cards').index('deckId')
		const req = idx.getAll(deckId)
		req.onsuccess = () => resolve(req.result as Card[])
		req.onerror = () => reject(req.error)
	})
}

export async function getAllCards(): Promise<Card[]> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const req = db.transaction('cards', 'readonly').objectStore('cards').getAll()
		req.onsuccess = () => resolve(req.result as Card[])
		req.onerror = () => reject(req.error)
	})
}

export async function deleteCard(id: number): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('cards', 'readwrite')
		const req = tx.objectStore('cards').delete(id)
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
	})
}

export async function getDueCards(deckId: number): Promise<Card[]> {
	const cards = await getCardsByDeck(deckId)
	const now = Date.now()
	return cards.filter(c => !c.nextReview || c.nextReview <= now || c.state === 'new')
}

// ── Jobs ───────────────────────────────────────────────────────────────────

export async function upsertJob(job: ProcessingJob): Promise<number> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('jobs', 'readwrite')
		const req = job.id ? tx.objectStore('jobs').put(job) : tx.objectStore('jobs').add(job)
		req.onsuccess = () => resolve(req.result as number)
		req.onerror = () => reject(req.error)
	})
}

export async function getJobByDeck(deckId: number): Promise<ProcessingJob | undefined> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const req = db.transaction('jobs', 'readonly').objectStore('jobs').getAll()
		req.onsuccess = () => {
			const jobs = req.result as ProcessingJob[]
			resolve(jobs.find(j => j.deckId === deckId))
		}
		req.onerror = () => reject(req.error)
	})
}

export async function updateDeckCounts(deckId: number): Promise<void> {
	const deck = await getDeck(deckId)
	if (!deck) return
	const cards = await getCardsByDeck(deckId)
	const now = Date.now()
	deck.totalCards = cards.length
	deck.newCards = cards.filter(c => c.state === 'new').length
	deck.dueCards = cards.filter(c => c.nextReview != null && c.nextReview <= now && c.state !== 'new').length
	deck.updatedAt = now
	await updateDeck(deck)
}
