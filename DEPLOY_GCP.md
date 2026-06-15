# Deploy Dugout Intel to Google Cloud Run

Target service: **dugout-intel**  
Target region: **us-central1**

This app uses Next.js `output: "standalone"`. The Docker image runs `node server.js`, which listens on **`process.env.PORT`** (Cloud Run sets this automatically; default `8080`).

---

## Environment variables

| Variable | When set | Server / client | Secret? |
|----------|----------|-----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Build time** (and runtime on Cloud Run) | Both | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build time** (and runtime on Cloud Run) | Both | No (public anon key) |
| `OPENAI_API_KEY` | **Runtime only** | Server | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **Runtime only** | Server | Yes |
| `PORT` | **Runtime** (set by Cloud Run) | Server | No |

**Important:** `NEXT_PUBLIC_*` values are embedded in the client JavaScript bundle during `npm run build`. Pass them as Docker `--build-arg` values when building the image. Server-only secrets must never be build args.

After deploy, verify config (booleans only, no secret values):

```bash
curl https://YOUR_CLOUD_RUN_URL/api/health
```

Expected:

```json
{
  "status": "ok",
  "service": "dugout-intel",
  "port": 8080,
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": true,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": true,
    "OPENAI_API_KEY": true,
    "SUPABASE_SERVICE_ROLE_KEY": true
  }
}
```

---

## Prerequisites

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated
2. A GCP project with billing enabled
3. APIs enabled (commands below)
4. Supabase project configured (schema + storage bucket)
5. OpenAI API key

Set your project ID:

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export SERVICE="dugout-intel"
export AR_REPO="cloud-run-source-deploy"

gcloud config set project "$PROJECT_ID"
```

---

## One-time GCP setup

### 1. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 2. Create Artifact Registry repository

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Cloud Run images for Dugout Intel"
```

### 3. Store secrets in Secret Manager

```bash
# OpenAI
echo -n "sk-your-openai-key" | gcloud secrets create OPENAI_API_KEY \
  --data-file=- \
  --replication-policy=automatic

# Supabase service role (server-only — never expose to client)
echo -n "your-supabase-service-role-key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY \
  --data-file=- \
  --replication-policy=automatic
```

If secrets already exist, add new versions:

```bash
echo -n "sk-your-openai-key" | gcloud secrets versions add OPENAI_API_KEY --data-file=-
echo -n "your-service-role-key" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-
```

### 4. Grant Cloud Run access to secrets

```bash
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SUPABASE_SERVICE_ROLE_KEY \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

### 5. Grant Cloud Build permissions (for CI deploys)

```bash
export CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer"
```

---

## Option A: Deploy with Cloud Build (recommended)

Set Supabase public values (used at build time):

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

From the project root:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL",_NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Cloud Build will:

1. Build the Docker image with `NEXT_PUBLIC_*` build args
2. Push to Artifact Registry
3. Deploy to Cloud Run with runtime secrets from Secret Manager

---

## Option B: Build locally and deploy manually

### 1. Configure Docker for Artifact Registry

```bash
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

### 2. Build the image

```bash
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE}:latest"

docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t "$IMAGE" \
  .
```

### 3. Push the image

```bash
docker push "$IMAGE"
```

### 4. Deploy to Cloud Run

```bash
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
```

---

## Post-deploy

### Get the service URL

```bash
gcloud run services describe "$SERVICE" \
  --region="$REGION" \
  --format='value(status.url)'
```

### Health check

```bash
curl "$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')/api/health"
```

### View logs

```bash
gcloud run services logs read "$SERVICE" --region="$REGION" --limit=50
```

### Update secrets (no rebuild needed)

```bash
echo -n "new-openai-key" | gcloud secrets versions add OPENAI_API_KEY --data-file=-

gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"
```

### Update Supabase public URL/key (requires rebuild)

Changing `NEXT_PUBLIC_*` values requires a new image build because they are inlined into the client bundle.

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL",_NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

---

## Supabase auth redirect URLs

After deploy, add your Cloud Run URL to Supabase:

1. **Authentication → URL Configuration**
2. Site URL: `https://YOUR_CLOUD_RUN_URL`
3. Redirect URLs: `https://YOUR_CLOUD_RUN_URL/**`

---

## Files added for Cloud Run

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build; runs `node server.js` on `PORT` |
| `.dockerignore` | Keeps image small; excludes secrets and `.next` |
| `cloudbuild.yaml` | Build → push → deploy pipeline |
| `next.config.ts` | `output: "standalone"` for container deployment |
| `src/lib/env.ts` | Server-side env access and validation helpers |
| `src/app/api/health/route.ts` | Deployment health / env check endpoint |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Container fails to start | Check Cloud Run logs; verify image built with standalone output |
| `502` / connection refused | App must listen on `0.0.0.0:$PORT` — standalone `server.js` does this |
| Login works locally but not in prod | Supabase redirect URLs not updated; `NEXT_PUBLIC_*` wrong at build time |
| AI extraction fails | `OPENAI_API_KEY` secret missing or Cloud Run SA lacks accessor role |
| Share links fail | `SUPABASE_SERVICE_ROLE_KEY` secret missing |
| Health shows `OPENAI_API_KEY: false` | Secret not mounted — re-run deploy with `--set-secrets` |

---

## Local Docker test

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t dugout-intel:local .

docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e OPENAI_API_KEY="sk-..." \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  dugout-intel:local

curl http://localhost:8080/api/health
```
