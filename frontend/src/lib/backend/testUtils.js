// Test utility helpers for Appwrite backend testing

export const mockQuery = {
  equal: (attr, val) => `equal("${attr}", ${typeof val === 'string' ? `"${val}"` : val})`,
  orderAsc: (attr) => `orderAsc("${attr}")`,
  orderDesc: (attr) => `orderDesc("${attr}")`,
  limit: (n) => `limit(${n})`,
  cursorAfter: (id) => `cursorAfter("${id}")`,
  greaterThan: (attr, val) => `greaterThan("${attr}", ${typeof val === 'string' ? `"${val}"` : val})`,
}

export const mockRole = {
  user: (id) => `user:${id}`,
}

export const mockPermission = {
  read: (role) => `read("${role}")`,
  update: (role) => `update("${role}")`,
  delete: (role) => `delete("${role}")`,
}

export const mockSDK = {
  Query: mockQuery,
  Role: mockRole,
  Permission: mockPermission,
}

export function createMockDatabases() {
  const documents = new Map()
  const docKey = (db, col, id) => `${db}:${col}:${id}`

  return {
    async getDocument(dbId, table, docId) {
      const key = docKey(dbId, table, docId)
      const doc = documents.get(key)
      if (!doc) {
        const err = new Error('Document not found')
        err.code = 404
        throw err
      }
      return JSON.parse(JSON.stringify(doc))
    },

    async createDocument(dbId, table, docId, data, permissions = []) {
      const key = docKey(dbId, table, docId)
      if (documents.has(key)) {
        const err = new Error('Document already exists')
        err.code = 409
        throw err
      }
      const doc = { ...data, $id: docId, $permissions: permissions }
      documents.set(key, JSON.parse(JSON.stringify(doc)))
      return doc
    },

    async updateDocument(dbId, table, docId, data) {
      const key = docKey(dbId, table, docId)
      const existing = documents.get(key)
      if (!existing) {
        const err = new Error('Document not found')
        err.code = 404
        throw err
      }
      const updated = { ...existing, ...data }
      documents.set(key, JSON.parse(JSON.stringify(updated)))
      return updated
    },

    async deleteDocument(dbId, table, docId) {
      const key = docKey(dbId, table, docId)
      if (!documents.has(key)) {
        const err = new Error('Document not found')
        err.code = 404
        throw err
      }
      documents.delete(key)
    },

    async listDocuments(dbId, table, queries = []) {
      const prefix = `${dbId}:${table}:`
      let docs = []
      for (const [k, v] of documents.entries()) {
        if (k.startsWith(prefix)) {
          docs.push(JSON.parse(JSON.stringify(v)))
        }
      }

      const userQuery = queries.find(q => typeof q === 'string' && q.startsWith('equal("userId"'))
      if (userQuery) {
        const match = userQuery.match(/equal\("userId",\s*"([^"]+)"\)/)
        if (match) {
          const targetUid = match[1]
          docs = docs.filter(d => d.userId === targetUid)
        }
      }

      const cursorQuery = queries.find(q => typeof q === 'string' && q.startsWith('cursorAfter('))
      if (cursorQuery) {
        const match = cursorQuery.match(/cursorAfter\("([^"]+)"\)/)
        if (match) {
          const afterId = match[1]
          const idx = docs.findIndex(d => d.$id === afterId)
          if (idx !== -1) {
            docs = docs.slice(idx + 1)
          }
        }
      }

      const limit = 100
      const pageDocs = docs.slice(0, limit)
      return { total: docs.length, documents: pageDocs }
    },

    _reset() {
      documents.clear()
    },

    _documents: documents,
  }
}
