const databases = new Map()

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

class FakeTransaction {
  constructor(database, storeName) {
    this.database = database
    this.storeName = storeName
    this.pending = 0
    this.completionScheduled = false
    this.completed = false
    this.oncomplete = null
    this.onerror = null
    this.onabort = null
  }

  enqueue(operation) {
    this.pending += 1
    queueMicrotask(() => {
      try {
        operation()
      } finally {
        this.pending -= 1
        this.scheduleCompletion()
      }
    })
  }

  scheduleCompletion() {
    if (this.pending !== 0 || this.completionScheduled || this.completed) return
    this.completionScheduled = true
    setTimeout(() => {
      this.completionScheduled = false
      if (this.pending !== 0 || this.completed) return
      this.completed = true
      this.oncomplete?.()
    }, 0)
  }

  objectStore() {
    const records = this.database.stores.get(this.storeName)
    if (!records) throw new Error(`Unknown object store: ${this.storeName}`)

    return {
      get: key => {
        const request = { result: undefined, error: null, onsuccess: null, onerror: null }
        this.enqueue(() => {
          request.result = clone(records.get(key))
          request.onsuccess?.()
        })
        return request
      },
      put: value => {
        const request = { result: undefined, error: null, onsuccess: null, onerror: null }
        this.enqueue(() => {
          records.set(value.accountId, clone(value))
          request.result = value.accountId
          request.onsuccess?.()
        })
        return request
      },
      delete: key => {
        const request = { result: undefined, error: null, onsuccess: null, onerror: null }
        this.enqueue(() => {
          records.delete(key)
          request.onsuccess?.()
        })
        return request
      },
    }
  }
}

class FakeDatabase {
  constructor(name) {
    this.name = name
    this.stores = databases.get(name) ?? new Map()
    databases.set(name, this.stores)
    this.objectStoreNames = {
      contains: storeName => this.stores.has(storeName),
    }
  }

  createObjectStore(storeName) {
    if (!this.stores.has(storeName)) this.stores.set(storeName, new Map())
    return this.stores.get(storeName)
  }

  transaction(storeName) {
    return new FakeTransaction(this, storeName)
  }
}

class FakeIndexedDB {
  open(name) {
    const request = {
      result: undefined,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
    }

    setTimeout(() => {
      const isNew = !databases.has(name)
      const database = new FakeDatabase(name)
      request.result = database
      if (isNew) request.onupgradeneeded?.()
      request.onsuccess?.()
    }, 0)

    return request
  }
}

export function installFakeIndexedDB() {
  globalThis.indexedDB = new FakeIndexedDB()
}

export function readFakeIndexedDBRecord(databaseName, storeName, key) {
  return clone(databases.get(databaseName)?.get(storeName)?.get(key))
}

export function writeFakeIndexedDBRecord(databaseName, storeName, key, value) {
  const records = databases.get(databaseName)?.get(storeName)
  if (!records) throw new Error(`Unknown fake IndexedDB store: ${storeName}`)
  records.set(key, clone(value))
}
