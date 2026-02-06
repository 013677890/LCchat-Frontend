import type Database from 'better-sqlite3'
import { TABLE_SCHEMAS } from './schema'

export function runMigrations(db: Database.Database): void {
  for (const sql of TABLE_SCHEMAS) {
    db.prepare(sql).run()
  }
}
