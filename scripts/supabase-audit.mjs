import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const expectedTables = [
  'analysis_reports',
  'interaction_rules',
  'label_parse_jobs',
  'nutrient_reference_values',
  'nutrients',
  'supplement_ingredients',
  'supplement_products',
  'user_conditions',
  'user_medications',
  'user_profiles',
  'user_supplements',
]

const expectedGrants = new Set([
  'anon:nutrient_reference_values:SELECT',
  'anon:nutrients:SELECT',
  'authenticated:analysis_reports:INSERT',
  'authenticated:analysis_reports:SELECT',
  'authenticated:interaction_rules:SELECT',
  'authenticated:label_parse_jobs:INSERT',
  'authenticated:label_parse_jobs:SELECT',
  'authenticated:nutrient_reference_values:SELECT',
  'authenticated:nutrients:SELECT',
  'authenticated:supplement_ingredients:DELETE',
  'authenticated:supplement_ingredients:INSERT',
  'authenticated:supplement_ingredients:SELECT',
  'authenticated:supplement_ingredients:UPDATE',
  'authenticated:supplement_products:DELETE',
  'authenticated:supplement_products:INSERT',
  'authenticated:supplement_products:SELECT',
  'authenticated:supplement_products:UPDATE',
  'authenticated:user_conditions:DELETE',
  'authenticated:user_conditions:INSERT',
  'authenticated:user_conditions:SELECT',
  'authenticated:user_conditions:UPDATE',
  'authenticated:user_medications:DELETE',
  'authenticated:user_medications:INSERT',
  'authenticated:user_medications:SELECT',
  'authenticated:user_medications:UPDATE',
  'authenticated:user_profiles:INSERT',
  'authenticated:user_profiles:SELECT',
  'authenticated:user_profiles:UPDATE',
  'authenticated:user_supplements:DELETE',
  'authenticated:user_supplements:INSERT',
  'authenticated:user_supplements:SELECT',
  'authenticated:user_supplements:UPDATE',
])

const errors = []
const notes = []

function fail(message) {
  errors.push(message)
}

function pass(message) {
  notes.push(`ok: ${message}`)
}

function runSupabase(args) {
  return execFileSync('supabase', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function parseJsonOutput(output) {
  const index = output.indexOf('{')
  if (index === -1) throw new Error(`Supabase CLI did not return JSON: ${output}`)
  return JSON.parse(output.slice(index))
}

function query(sql) {
  const output = runSupabase(['db', 'query', '--linked', '--output', 'json', sql])
  return parseJsonOutput(output).rows
}

const linkedRef = existsSync('supabase/.temp/project-ref')
  ? readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  : ''
if (!linkedRef) fail('Supabase project is not linked.')
else pass(`linked Supabase ref present (${linkedRef})`)

const tableRows = query(`
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any(array[${expectedTables.map((table) => `'${table}'`).join(',')}])
  order by c.relname;
`)

const seenTables = new Set(tableRows.map((row) => row.table_name))
for (const table of expectedTables) {
  if (!seenTables.has(table)) fail(`missing public table: ${table}`)
}
const rlsOff = tableRows.filter((row) => !row.rls_enabled).map((row) => row.table_name)
if (rlsOff.length) fail(`RLS is disabled on: ${rlsOff.join(', ')}`)
else pass('all expected public tables have RLS enabled')

const grantRows = query(`
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name = any(array[${expectedTables.map((table) => `'${table}'`).join(',')}])
  order by grantee, table_name, privilege_type;
`)
const actualGrants = new Set(grantRows.map((row) => `${row.grantee}:${row.table_name}:${row.privilege_type}`))
for (const grant of expectedGrants) {
  if (!actualGrants.has(grant)) fail(`missing expected grant: ${grant}`)
}
for (const grant of actualGrants) {
  if (!expectedGrants.has(grant)) fail(`unexpected broad grant: ${grant}`)
}
if (!errors.some((error) => error.includes('grant'))) pass('Data API grants match the expected least-privilege set')

const storageRows = query(`
  select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
  where id = 'label-images';
`)
if (storageRows.length !== 1) {
  fail('label-images storage bucket is missing.')
} else {
  const bucket = storageRows[0]
  const mimeTypes = bucket.allowed_mime_types ?? []
  if (bucket.public) fail('label-images bucket must be private.')
  if (Number(bucket.file_size_limit) !== 5242880) fail('label-images bucket file_size_limit should be 5242880.')
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
    if (!mimeTypes.includes(mimeType)) fail(`label-images bucket missing mime type ${mimeType}.`)
  }
  if (!errors.some((error) => error.includes('label-images bucket'))) pass('label-images bucket is private and constrained')
}

const policyRows = query(`
  select policyname, cmd
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'user uploads own label images',
      'user reads own label images',
      'user updates own label images',
      'user deletes own label images'
    )
  order by policyname;
`)
if (policyRows.length !== 4) fail('storage.objects owner-scoped label image policies are incomplete.')
else pass('storage owner-scoped label image policies exist')

const remoteMigrationRows = query(`
  select version
  from supabase_migrations.schema_migrations
  order by version;
`)
const remoteMigrations = new Set(remoteMigrationRows.map((row) => String(row.version)))
const localMigrations = readdirSync('supabase/migrations')
  .filter((name) => name.endsWith('.sql'))
  .map((name) => name.split('_')[0])
for (const migration of localMigrations) {
  if (!remoteMigrations.has(migration)) fail(`local migration is not applied remotely: ${migration}`)
}
if (!errors.some((error) => error.includes('migration'))) pass('all local migrations are applied remotely')

const functions = runSupabase(['functions', 'list', '--project-ref', linkedRef])
for (const name of ['parse-label', 'run-analysis']) {
  if (!new RegExp(`${name}\\s+\\|\\s+ACTIVE`).test(functions)) fail(`Edge Function ${name} is not ACTIVE.`)
}
if (!errors.some((error) => error.startsWith('Edge Function'))) pass('required Edge Functions are ACTIVE')

for (const note of notes) console.log(note)
if (errors.length) {
  console.error('\nSupabase audit failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('\nSupabase audit passed')
