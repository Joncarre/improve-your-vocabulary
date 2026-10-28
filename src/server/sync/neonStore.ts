import { neon } from '@neondatabase/serverless'
import { createSqlStore, type SqlRunner } from './sqlStore.js'
import type { RecordStore } from './store.js'

/** Neon over HTTP: one request per statement, or one for a whole transaction. */
function neonRunner(databaseUrl: string): SqlRunner {
  const sql = neon(databaseUrl)
  return {
    async query(text, params) {
      return (await sql.query(text, params ?? [])) as Record<string, unknown>[]
    },
    async transaction(statements) {
      const results = await sql.transaction((txn) => statements.map((statement) => txn.query(statement.text, statement.params ?? [])))
      return results as Record<string, unknown>[][]
    },
  }
}

export function createNeonStore(databaseUrl: string, table = 'records'): RecordStore {
  return createSqlStore(neonRunner(databaseUrl), table)
}
