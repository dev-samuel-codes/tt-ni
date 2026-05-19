function readArg(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return ''
  return process.argv[index + 1] ?? ''
}

const target = readArg('--url') || process.env.TT_NI_PRODUCTION_URL
if (!target) throw new Error('TT_NI_PRODUCTION_URL or --url is required.')

const baseUrl = new URL(target)
const errors = []
const notes = []

function fail(message) {
  errors.push(message)
}

function pass(message) {
  notes.push(`ok: ${message}`)
}

async function fetchText(url) {
  const response = await fetch(url)
  const text = await response.text()
  return { response, text }
}

function assetUrls(html, attr) {
  const pattern = new RegExp(`${attr}=["']([^"']+)["']`, 'g')
  return [...html.matchAll(pattern)]
    .map((match) => match[1])
    .filter((value) => value.startsWith('/') || value.startsWith('./') || value.startsWith('http'))
    .map((value) => new URL(value, baseUrl).toString())
}

function scanForSecretLeaks(name, text) {
  const forbidden = [
    ['OpenAI key', /sk-proj-[A-Za-z0-9_-]+|OPENAI_API_KEY\s*[:=]/],
    ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]+|SUPABASE_SECRET_KEYS\s*[:=]/],
    ['service role key', /service_role_[A-Za-z0-9_-]+|TT_NI_SERVICE_ROLE_KEY\s*[:=]|SUPABASE_SERVICE_ROLE_KEY\s*[:=]/],
  ]
  for (const [label, pattern] of forbidden) {
    if (pattern.test(text)) fail(`${label} pattern found in deployed asset: ${name}`)
  }
}

const root = await fetchText(baseUrl.toString())
if (!root.response.ok) fail(`root URL returned HTTP ${root.response.status}`)
else pass(`root URL returned HTTP ${root.response.status}`)

const contentType = root.response.headers.get('content-type') ?? ''
if (!contentType.includes('text/html')) fail(`root content-type is not text/html: ${contentType}`)
else pass('root URL serves HTML')

if (!root.text.includes('id="root"')) fail('root HTML does not contain React root element.')
else pass('root HTML contains React root element')

scanForSecretLeaks('index.html', root.text)

const spaRoute = new URL('/analysis', baseUrl)
const spa = await fetchText(spaRoute.toString())
if (!spa.response.ok) fail(`SPA route ${spaRoute.pathname} returned HTTP ${spa.response.status}`)
else if (!spa.text.includes('id="root"')) fail(`SPA route ${spaRoute.pathname} does not serve the app shell.`)
else pass(`SPA route ${spaRoute.pathname} serves the app shell`)

const assets = [...new Set([...assetUrls(root.text, 'src'), ...assetUrls(root.text, 'href')])]
const jsAssets = assets.filter((url) => url.endsWith('.js'))
const cssAssets = assets.filter((url) => url.endsWith('.css'))
if (jsAssets.length === 0) fail('no deployed JS assets were found.')
else pass(`found ${jsAssets.length} JS asset(s)`)
if (cssAssets.length === 0) fail('no deployed CSS assets were found.')
else pass(`found ${cssAssets.length} CSS asset(s)`)

for (const asset of [...jsAssets, ...cssAssets]) {
  const { response, text } = await fetchText(asset)
  if (!response.ok) {
    fail(`${asset} returned HTTP ${response.status}`)
    continue
  }
  scanForSecretLeaks(asset, text)
}

if (!errors.some((error) => error.includes('pattern found'))) pass('deployed HTML/CSS/JS assets do not expose server secret patterns')

for (const note of notes) console.log(note)
if (errors.length) {
  console.error('\npostdeploy check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('\npostdeploy check passed')
