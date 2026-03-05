# ☁️ EyeGuide — Cloud Deployment Proof

This document provides proof that EyeGuide's backend is running on Google Cloud.

## Google Cloud Services Used

### 1. Google Cloud Run (Backend Hosting)
- **Service Name**: `eyeguide`
- **Region**: `us-central1`
- **Image**: Built via Cloud Build and stored in Artifact Registry
- **Configuration**: 1 vCPU, 1 GB RAM, auto-scaling 0-5 instances

**Proof**: See deployment script (`deploy.sh`) and Cloud Build config (`infrastructure/cloudbuild.yaml`)

### 2. Vertex AI — Gemini Live API
- **Model**: `gemini-2.0-flash-live-001`
- **Usage**: Real-time bidirectional audio + video streaming
- **Integration**: Via Google ADK bidi-streaming runtime

**Proof**: See `backend/eyeguide_agent/agent.py` and `backend/server.py` — the agent uses the Gemini Live API model through ADK's `Runner.run_live()` method.

### 3. Google Cloud Firestore
- **Database**: Native mode
- **Collections**: `users` (preferences), `sessions` (event logs)

**Proof**: See `backend/eyeguide_agent/tools.py` — Firestore client is used to persist user preferences and log session events.

### 4. Google Cloud Build
- **Purpose**: Automated CI/CD pipeline for Docker image building
- **Config**: `infrastructure/cloudbuild.yaml`

### 5. Artifact Registry
- **Repository**: `eyeguide-repo`
- **Purpose**: Docker image storage for Cloud Run deployment

## Deployment Commands

```bash
# One-command deployment
./deploy.sh YOUR_PROJECT_ID us-central1

# Or manual:
gcloud run deploy eyeguide \
    --source ./backend \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID"
```

## Screen Recording

> A screen recording showing the Cloud Run console with the running EyeGuide service
> will be included in the Devpost submission as proof of deployment.

## API Calls to Google Cloud Services

| File | Service | API Call |
|------|---------|----------|
| `backend/eyeguide_agent/agent.py` | Vertex AI (Gemini) | ADK Agent with `gemini-2.0-flash-live-001` model |
| `backend/server.py` | Vertex AI (Gemini Live API) | `runner.run_live()` for bidi-streaming |
| `backend/eyeguide_agent/tools.py` | Firestore | `firestore.Client()`, document read/write operations |
| `deploy.sh` | Cloud Run, Cloud Build, Artifact Registry, Firestore | Deployment automation |
