import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { runMigrations } from './migration'

let localDB: Database.Database | null = null

export function getLocalDBPath(): string {
  return join(app.getPath('userData'), 'lcchat.db')
}

function applyPragmas(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
}

export function initLocalDB(): Database.Database {
  if (localDB) {
    return localDB
  }

  localDB = new Database(getLocalDBPath())
  applyPragmas(localDB)
  runMigrations(localDB)
  return localDB
}

export function getLocalDB(): Database.Database {
  return localDB ?? initLocalDB()
}

export function closeLocalDB(): void {
  if (!localDB) {
    return
  }

  localDB.close()
  localDB = null
}
