import './env'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, 'schema.sql')
const schema = await fs.readFile(schemaPath, 'utf8')

for (const statement of schema.split(';').map((item) => item.trim()).filter(Boolean)) {
  await pool.query(statement)
}

await pool.end()
console.log('TiDB schema applied.')
