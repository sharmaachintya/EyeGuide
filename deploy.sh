#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# EyeGuide — Automated Cloud Run Deployment Script
# 
# This script automates the deployment of EyeGuide to Google Cloud Run.
# It builds the Docker image, pushes to Artifact Registry, and deploys.
#
# Prerequisites:
#   - Google Cloud SDK (gcloud) installed and authenticated
#   - Docker installed (or use Cloud Build)
#   - A Google Cloud project with billing enabled
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [PROJECT_ID] [REGION]
#
# Example:
#   ./deploy.sh my-project-id us-central1
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="${2:-us-central1}"
SERVICE_NAME="eyeguide"
IMAGE_NAME="eyeguide-backend"
AR_REPO="eyeguide-repo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Validation ──────────────────────────────────────────────────────────────
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: Project ID is required.${NC}"
    echo "Usage: ./deploy.sh <PROJECT_ID> [REGION]"
    echo "   Or: export GOOGLE_CLOUD_PROJECT=your-project-id && ./deploy.sh"
    exit 1
fi

echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   👁️  EyeGuide — Automated Cloud Run Deployment${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "   Project:  ${GREEN}${PROJECT_ID}${NC}"
echo -e "   Region:   ${GREEN}${REGION}${NC}"
echo -e "   Service:  ${GREEN}${SERVICE_NAME}${NC}"
echo ""

# ─── Step 1: Set Project ─────────────────────────────────────────────────────
echo -e "${YELLOW}📌 Step 1: Setting Google Cloud project...${NC}"
gcloud config set project "$PROJECT_ID"

# ─── Step 2: Enable Required APIs ────────────────────────────────────────────
echo -e "${YELLOW}📌 Step 2: Enabling required APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    aiplatform.googleapis.com \
    firestore.googleapis.com \
    --quiet

# ─── Step 3: Create Artifact Registry Repository ────────────────────────────
echo -e "${YELLOW}📌 Step 3: Setting up Artifact Registry...${NC}"
gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="EyeGuide Docker images" \
    --quiet 2>/dev/null || echo "   (Repository already exists)"

# Configure Docker for Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ─── Step 4: Copy Frontend to Backend Static Directory ───────────────────────
echo -e "${YELLOW}📌 Step 4: Preparing build context...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy frontend files into backend/static for serving
rm -rf "${SCRIPT_DIR}/backend/static"
cp -r "${SCRIPT_DIR}/frontend" "${SCRIPT_DIR}/backend/static"
echo "   Frontend files copied to backend/static/"

# ─── Step 5: Build with Cloud Build ──────────────────────────────────────────
echo -e "${YELLOW}📌 Step 5: Building Docker image with Cloud Build...${NC}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}:latest"

cd "${SCRIPT_DIR}/backend"
gcloud builds submit \
    --tag "$IMAGE_URI" \
    --quiet

echo -e "${GREEN}   ✅ Image built: ${IMAGE_URI}${NC}"

# ─── Step 6: Deploy to Cloud Run ─────────────────────────────────────────────
echo -e "${YELLOW}📌 Step 6: Deploying to Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_URI" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5 \
    --timeout 300 \
    --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}" \
    --quiet

# ─── Step 7: Get Service URL ─────────────────────────────────────────────────
echo -e "${YELLOW}📌 Step 7: Retrieving service URL...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --format 'value(status.url)')

# ─── Step 8: Initialize Firestore ────────────────────────────────────────────
echo -e "${YELLOW}📌 Step 8: Setting up Firestore...${NC}"
gcloud firestore databases create \
    --location="$REGION" \
    --type=firestore-native \
    --quiet 2>/dev/null || echo "   (Firestore already initialized)"

# ─── Done! ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ EyeGuide deployed successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "   🌐 Service URL:  ${BLUE}${SERVICE_URL}${NC}"
echo -e "   🏥 Health Check: ${BLUE}${SERVICE_URL}/health${NC}"
echo -e "   📊 Cloud Console: ${BLUE}https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}${NC}"
echo ""
echo -e "   Open ${BLUE}${SERVICE_URL}${NC} in your browser to start using EyeGuide!"
echo ""

# Clean up temporary static copy
rm -rf "${SCRIPT_DIR}/backend/static"
