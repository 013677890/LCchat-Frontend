import type Database from 'better-sqlite3'
import { TABLE_SCHEMAS } from './schema'

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  alterSql: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  if (columns.some((column) => column.name === columnName)) {
    return
  }

  db.prepare(alterSql).run()
}

export function runMigrations(db: Database.Database): void {
  for (const sql of TABLE_SCHEMAS) {
    db.prepare(sql).run()
  }

  ensureColumn(db, 'sync_state', 'cursor', `ALTER TABLE sync_state ADD COLUMN cursor TEXT NOT NULL DEFAULT ''`)
}
