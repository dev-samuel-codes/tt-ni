import fs from 'node:fs'
import mysql from 'mysql2/promise'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function buildSslConfig() {
  if (process.env.TIDB_SSL_DISABLED === '1') return undefined
  const caPath = process.env.TIDB_SSL_CA
  if (!caPath) return {}
  return { ca: fs.readFileSync(caPath, 'utf8') }
}

export const pool = mysql.createPool({
  host: requiredEnv('TIDB_HOST'),
  port: Number(process.env.TIDB_PORT ?? 4000),
  user: requiredEnv('TIDB_USER'),
  password: requiredEnv('TIDB_PASSWORD'),
  database: requiredEnv('TIDB_DATABASE'),
  ssl: buildSslConfig(),
  waitForConnections: true,
  connectionLimit: Number(process.env.TIDB_CONNECTION_LIMIT ?? 10),
  namedPlaceholders: false,
})

export async function ensureUser(user: { uid: string; email?: string; name?: string }) {
  await pool.execute(
    `insert into app_users (id, email, display_name)
     values (?, ?, ?)
     on duplicate key update email = values(email), display_name = values(display_name)`,
    [user.uid, user.email ?? null, user.name ?? null],
  )
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
