# tt-ni Deployment

This project is deployment-ready, but deployment should only be run after explicit approval.

## Required Platform Variables

Only expose browser-safe Supabase values to the frontend deployment platform.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Do not set `OPENAI_API_KEY`, `TT_NI_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any Supabase secret key as Vite variables.

## Pre-Deploy Verification

```bash
npm run verify
```

This checks lint, unit tests, production build, frontend env hygiene, Supabase secrets/functions, public table RLS, Data API grants, Storage bucket policies, and remote migration application.

`npm run verify` can print warnings for local Edge Function source that is newer than the deployed function. That is acceptable during development, but it must be resolved before a production release.

For the final release gate, run:

```bash
npm run verify:release
```

Release mode treats pre-deploy warnings as failures. If it fails because `parse-label` or `run-analysis` is newer locally, deploy the functions first and rerun the release check.

For the full remote path, including Supabase Auth, Storage upload, OpenAI image parsing, and analysis report creation:

```bash
TT_NI_QA_EMAIL=qa@example.com \
TT_NI_QA_PASSWORD='password' \
TT_NI_LABEL_IMAGE=/path/to/label.png \
npm run verify:remote
```

QA account values may also be provided with `TT_NI_QA_FILE=/path/to/qa.json`. The JSON file must contain `email` and `password`, and may contain `labelImage`.

The remote smoke test verifies Storage upload/delete, Edge Function parsing, analysis report creation, and direct product/ingredient/user-supplement Data API writes. It deletes the uploaded Storage image and direct smoke product row after it runs and verifies that cleanup. It intentionally leaves `label_parse_jobs` and `analysis_reports` records as audit evidence of the remote function run.

## Deploy

The repo includes `vercel.json` for a Vite static deployment. After deployment, add the production URL to Supabase Auth redirect URLs.

When Edge Function source changes, deploy both functions before the frontend deployment:

```bash
supabase functions deploy parse-label
supabase functions deploy run-analysis
```

Or use the guarded release helper. It refuses to deploy unless the approval flag is present, then deploys both functions, runs the strict remote smoke test, and runs the release gate:

```bash
TT_NI_APPROVE_EDGE_DEPLOY=1 \
TT_NI_QA_FILE=/path/to/qa.json \
TT_NI_LABEL_IMAGE=/path/to/label.png \
npm run deploy:functions
```

After deploying the updated functions, run the strict remote check. This includes the normal Auth, Storage, OpenAI parsing, analysis report persistence path and also requires the `run-analysis` medication/condition warning response and persisted medication recommendation.

```bash
TT_NI_QA_EMAIL=qa@example.com \
TT_NI_QA_PASSWORD='password' \
TT_NI_LABEL_IMAGE=/path/to/label.png \
npm run verify:remote:strict
```

Then rerun the release gate:

```bash
npm run verify:release
```

## Post-Deploy QA

Run the deployed asset check first:

```bash
TT_NI_PRODUCTION_URL=https://your-production-url.example npm run postdeploy:check
# or
npm run postdeploy:check -- --url https://your-production-url.example
```

1. Open the production URL.
2. Sign in with a test account.
3. Upload a label image and verify AI parsing returns editable ingredients.
4. Confirm the supplement and run analysis.
5. Verify the report is saved in Supabase and no client bundle exposes server secrets.
