import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required before deploying Edge Functions.`)
  return value
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
}

if (process.env.TT_NI_APPROVE_EDGE_DEPLOY !== '1') {
  console.error('Refusing to deploy Edge Functions without TT_NI_APPROVE_EDGE_DEPLOY=1.')
  console.error('When deployment is approved, run this with QA smoke-test credentials configured.')
  process.exit(1)
}

const projectRefPath = 'supabase/.temp/project-ref'
if (!existsSync(projectRefPath)) throw new Error('Supabase project is not linked locally.')
const projectRef = readFileSync(projectRefPath, 'utf8').trim()
requireValue(projectRef, 'Supabase project ref')

const qa = process.env.TT_NI_QA_FILE ? readJson(process.env.TT_NI_QA_FILE) : {}
requireValue(process.env.TT_NI_QA_EMAIL ?? qa.email, 'TT_NI_QA_EMAIL')
requireValue(process.env.TT_NI_QA_PASSWORD ?? qa.password, 'TT_NI_QA_PASSWORD')
requireValue(process.env.TT_NI_LABEL_IMAGE ?? qa.labelImage, 'TT_NI_LABEL_IMAGE')

for (const functionName of ['parse-label', 'run-analysis']) {
  run('supabase', ['functions', 'deploy', functionName, '--project-ref', projectRef, '--use-api'])
}

run('npm', ['run', 'verify:remote:strict'])
run('npm', ['run', 'verify:release'])
