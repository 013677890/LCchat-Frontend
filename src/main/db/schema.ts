export const TABLE_SCHEMAS: string[] = [
  `CREATE TABLE IF NOT EXISTS meta_kv (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    user_uuid TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS friends (
    user_uuid TEXT NOT NULL,
    peer_uuid TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, peer_uuid)
  )`,
  `CREATE TABLE IF NOT EXISTS friend_applies (
    user_uuid TEXT NOT NULL,
    apply_id INTEGER NOT NULL,
    direction TEXT NOT NULL,
    status INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, apply_id, direction)
  )`,
  `CREATE TABLE IF NOT EXISTS blacklist (
    user_uuid TEXT NOT NULL,
    peer_uuid TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, peer_uuid)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    user_uuid TEXT NOT NULL,
    conv_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, conv_id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    user_uuid TEXT NOT NULL,
    conv_id TEXT NOT NULL,
    msg_id TEXT NOT NULL,
    client_msg_id TEXT,
    seq INTEGER,
    send_time INTEGER,
    payload_json TEXT NOT NULL,
    status INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, conv_id, msg_id)
  )`,
  `CREATE TABLE IF NOT EXISTS message_drafts (
    user_uuid TEXT NOT NULL,
    conv_id TEXT NOT NULL,
    draft_text TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, conv_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    user_uuid TEXT NOT NULL,
    domain TEXT NOT NULL,
    last_version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_uuid, domain)
  )`
]
