import fs from 'node:fs'
import mysql from 'mysql2/promise'

/** 환경변수 필수값 검증 헬퍼. 미설정 시 Error throw */
function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

/**
 * TiDB 연결용 SSL 설정을 구성합니다.
 * TIDB_SSL_DISABLED=1 이면 SSL 미사용,
 * TIDB_SSL_CA 경로가 있으면 CA 인증서를 읽어 적용,
 * 없으면 기본 SSL 모드 사용.
 */
function buildSslConfig() {
  if (process.env.TIDB_SSL_DISABLED === '1') return undefined
  const caPath = process.env.TIDB_SSL_CA
  if (!caPath) return {}
  return { ca: fs.readFileSync(caPath, 'utf8') }
}

/** TiDB 커넥션 풀. mysql2/promise로 비동기 쿼리 지원 */
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

/**
 * Firebase 사용자를 app_users 테이블에 upsert 합니다.
 * 이미 존재하면 email과 display_name만 업데이트합니다.
 */
export async function ensureUser(user: { uid: string; email?: string; name?: string }) {
  await pool.execute(
    `insert into app_users (id, email, display_name)
     values (?, ?, ?)
     on duplicate key update email = values(email), display_name = values(display_name)`,
    [user.uid, user.email ?? null, user.name ?? null],
  )
}

/**
 * prefix_randomUUID 형식의 전역 고유 ID를 생성합니다.
 * 예: id('product') → 'product_550e8400-e29b-41d4-a716-446655440000'
 */
export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
