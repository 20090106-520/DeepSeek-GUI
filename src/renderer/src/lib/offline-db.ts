const DB_NAME = 'deepseek-gui-offline'
const DB_VERSION = 1
const THREAD_STORE = 'threads'
const MESSAGE_STORE = 'messages'

type OfflineThread = {
  id: string
  title: string
  updatedAt: string
  data: string
}

type OfflineMessage = {
  id: string
  threadId: string
  data: string
  cachedAt: number
}

class OfflineDB {
  private db: IDBDatabase | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(THREAD_STORE)) {
          db.createObjectStore(THREAD_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
          const store = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' })
          store.createIndex('threadId', 'threadId', { unique: false })
        }
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onerror = () => {
        reject(new Error('Failed to open offline database'))
      }
    })
  }

  async saveThread(threadId: string, data: string, title: string): Promise<void> {
    const db = await this.init()
    const tx = db.transaction(THREAD_STORE, 'readwrite')
    const store = tx.objectStore(THREAD_STORE)
    const entry: OfflineThread = {
      id: threadId,
      title,
      updatedAt: new Date().toISOString(),
      data
    }
    store.put(entry)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async loadThread(threadId: string): Promise<string | null> {
    const db = await this.init()
    const tx = db.transaction(THREAD_STORE, 'readonly')
    const store = tx.objectStore(THREAD_STORE)
    const request = store.get(threadId)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as OfflineThread | undefined
        resolve(result?.data ?? null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveMessage(messageId: string, threadId: string, data: string): Promise<void> {
    const db = await this.init()
    const tx = db.transaction(MESSAGE_STORE, 'readwrite')
    const store = tx.objectStore(MESSAGE_STORE)
    const entry: OfflineMessage = {
      id: messageId,
      threadId,
      data,
      cachedAt: Date.now()
    }
    store.put(entry)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async loadMessages(threadId: string): Promise<string[]> {
    const db = await this.init()
    const tx = db.transaction(MESSAGE_STORE, 'readonly')
    const store = tx.objectStore(MESSAGE_STORE)
    const index = store.index('threadId')
    const request = index.getAll(threadId)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = (request.result as OfflineMessage[]).map((m) => m.data)
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteThread(threadId: string): Promise<void> {
    const db = await this.init()
    const tx = db.transaction([THREAD_STORE, MESSAGE_STORE], 'readwrite')
    tx.objectStore(THREAD_STORE).delete(threadId)
    const messageStore = tx.objectStore(MESSAGE_STORE)
    const index = messageStore.index('threadId')
    const request = index.openCursor(threadId)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async clearAll(): Promise<void> {
    const db = await this.init()
    const tx = db.transaction([THREAD_STORE, MESSAGE_STORE], 'readwrite')
    tx.objectStore(THREAD_STORE).clear()
    tx.objectStore(MESSAGE_STORE).clear()
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getStats(): Promise<{ threadCount: number; messageCount: number }> {
    const db = await this.init()
    const tx = db.transaction([THREAD_STORE, MESSAGE_STORE], 'readonly')
    const threadCount = tx.objectStore(THREAD_STORE).count()
    const messageCount = tx.objectStore(MESSAGE_STORE).count()
    return new Promise((resolve, reject) => {
      let threads = 0
      let messages = 0
      threadCount.onsuccess = () => {
        threads = threadCount.result
        if (messages > 0 || threadCount.result >= 0) {
          if (messageCount.result !== undefined) {
            messages = messageCount.result
            resolve({ threadCount: threads, messageCount: messages })
          }
        }
      }
      messageCount.onsuccess = () => {
        messages = messageCount.result
        if (threadCount.result !== undefined) {
          threads = threadCount.result
          resolve({ threadCount: threads, messageCount: messages })
        }
      }
      tx.onerror = () => reject(tx.error)
    })
  }
}

let globalOfflineDB: OfflineDB | null = null

export function getOfflineDB(): OfflineDB {
  if (!globalOfflineDB) {
    globalOfflineDB = new OfflineDB()
  }
  return globalOfflineDB
}

export { OfflineDB }