# 👁️ EyeGuide — Real-Time AI Accessibility Companion

> **An AI-powered visual companion for visually impaired users, built with Google's Gemini Live API and Agent Development Kit (ADK).**

[![Category](https://img.shields.io/badge/Category-Live%20Agent-blue)](#)
[![Built with](https://img.shields.io/badge/Built%20with-Gemini%20Live%20API-orange)](#)
[![Hosted on](https://img.shields.io/badge/Hosted%20on-Google%20Cloud%20Run-green)](#)
[![Hackathon](https://img.shields.io/badge/Hackathon-Gemini%20Live%20Agent%20Challenge-purple)](#)

---

## 🎯 The Problem

**285 million people worldwide are visually impaired.** For them, everyday tasks like navigating unfamiliar spaces, reading labels, identifying objects, and avoiding hazards require constant effort. Existing assistive tools are limited — screen readers can't describe the physical world, and human assistance isn't always available.

## 💡 The Solution

**EyeGuide** is a real-time AI companion that "sees" the world through the user's phone camera and "speaks" to them through natural voice conversation. Users can:

- 🗣️ **Talk naturally** — ask questions, give commands, interrupt anytime
- 👁️ **Get real-time scene descriptions** — the AI sees through the camera
- ⚠️ **Receive hazard warnings** — stairs, obstacles, vehicles detected proactively
- 📖 **Have text read aloud** — labels, signs, documents, screens
- 🧭 **Navigate safely** — spatial descriptions using clock positions and distances
- 🛒 **Shop independently** — product names, prices, ingredients read aloud

### Key Features
- **Real-time audio + video streaming** via Gemini Live API
- **Natural barge-in (interruption) support** — interrupt the AI mid-sentence
- **4 operating modes**: Navigation, Reading, Exploration, Shopping
- **Distinct warm, calm voice persona** — like a trusted friend
- **Persistent user preferences** via Firestore
- **Accessible web UI** — high contrast, large touch targets, screen reader compatible

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S DEVICE                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │ Camera 📷 │  │ Mic 🎤   │  │ Speaker 🔊         │    │
│  └─────┬────┘  └─────┬────┘  └─────────▲──────────┘    │
│        │             │                  │               │
│  ┌─────▼─────────────▼──────────────────┴──────────┐    │
│  │          Frontend (Web App - HTML/CSS/JS)        │    │
│  │  • WebSocket client for real-time streaming      │    │
│  │  • Camera capture (MediaStream API)              │    │
│  │  • Audio capture/playback (Web Audio API)        │    │
│  │  • Accessible UI with mode selection             │    │
│  └─────────────────────┬───────────────────────────┘    │
└────────────────────────┼────────────────────────────────┘
                         │ WebSocket (wss://)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              GOOGLE CLOUD (Cloud Run)                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │      Backend (Python FastAPI + WebSocket)        │    │
│  │  ┌───────────────────────────────────────┐      │    │
│  │  │    ADK Bidi-Streaming Runtime          │      │    │
│  │  │  • LiveRequestQueue (real-time I/O)   │      │    │
│  │  │  • Runner + InMemorySessionService    │      │    │
│  │  └──────────────┬────────────────────────┘      │    │
│  │                 │                                │    │
│  │  ┌──────────────▼────────────────────────┐      │    │
│  │  │    EyeGuide Agent (ADK Agent)          │      │    │
│  │  │  • Accessibility companion persona    │      │    │
│  │  │  • Tools: save_preference,            │      │    │
│  │  │    get_preferences, log_event,        │      │    │
│  │  │    get_mode_description               │      │    │
│  │  └──────────────┬────────────────────────┘      │    │
│  └─────────────────┼───────────────────────────────┘    │
│                    │                                     │
│  ┌─────────────────▼───────────────────────────────┐    │
│  │      Gemini Live API (Vertex AI)                │    │
│  │  • Model: gemini-2.0-flash-live-001             │    │
│  │  • Input: Audio stream + Video frames           │    │
│  │  • Output: Audio stream (voice response)        │    │
│  │  • Features: VAD, barge-in, session memory      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │      Firestore (User Preferences & Sessions)    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

> 📊 A polished architecture diagram image is available in `/docs/architecture-diagram.png`

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **AI Model** | Gemini 2.5 Flash Native Audio (Live API) | Real-time multimodal understanding |
| **Agent Framework** | Google ADK (Python) | Agent orchestration & tool management |
| **Backend** | Python + FastAPI | WebSocket server for real-time streaming |
| **Frontend** | HTML/CSS/JavaScript | Accessible web interface |
| **Hosting** | Google Cloud Run | Serverless container hosting |
| **Database** | Google Firestore | User preferences & session data |
| **CI/CD** | Google Cloud Build | Automated deployment pipeline |

---

## 🚀 Quick Start — Run Locally

### Prerequisites

- Python 3.11+
- A Google Cloud project with billing enabled
- Google Cloud SDK (`gcloud`) installed
- A Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey))

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/eyeguide.git
cd eyeguide
```

### Step 2: Set Up Python Environment

```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### Step 3: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your credentials:
# Option A: Use Google AI Studio (free, for local development)
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_API_KEY=your-api-key-here

# Option B: Use Vertex AI (for production / Cloud Run)
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

### Step 4: Copy Frontend to Static Directory

```bash
# From the project root:
cp -r frontend backend/static
```

### Step 5: Run the Server

```bash
cd backend
python server.py
```

The server will start at **http://localhost:8080**. Open it in your browser (Chrome recommended for best WebRTC support).

### Step 6: Use EyeGuide

1. Click the **"Start EyeGuide"** button
2. Allow microphone and camera permissions
3. Start talking! Try: *"What do you see?"*, *"Read that"*, *"Switch to exploration mode"*
4. Point your camera at objects, text, or surroundings

---

## ☁️ Deploy to Google Cloud Run

### Option A: One-Command Deployment (Recommended)

```bash
# Make the deploy script executable
chmod +x deploy.sh

# Deploy (replace with your project ID)
./deploy.sh YOUR_PROJECT_ID us-central1
```

This script automatically:
1. Enables required Google Cloud APIs
2. Creates an Artifact Registry repository
3. Builds the Docker image with Cloud Build
4. Deploys to Cloud Run
5. Sets up Firestore
6. Outputs the live service URL

### Option B: Manual Deployment

```bash
# 1. Set your project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
    artifactregistry.googleapis.com aiplatform.googleapis.com firestore.googleapis.com

# 3. Copy frontend to backend
cp -r frontend backend/static

# 4. Build and deploy
cd backend
gcloud run deploy eyeguide \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 1Gi \
    --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1"
```

### Option C: Cloud Build Pipeline

```bash
gcloud builds submit --config infrastructure/cloudbuild.yaml .
```

---

## 📁 Project Structure

```
eyeguide/
├── backend/
│   ├── eyeguide_agent/
│   │   ├── __init__.py          # Package initialization
│   │   ├── agent.py             # Main ADK agent definition
│   │   ├── config.py            # Configuration constants
│   │   ├── prompts.py           # System prompts & persona
│   │   └── tools.py             # Custom tools (Firestore, modes)
│   ├── server.py                # FastAPI WebSocket server
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile               # Container image for Cloud Run
│   └── .env.example             # Environment variables template
│
├── frontend/
│   ├── index.html               # Main HTML (accessible UI)
│   ├── css/
│   │   └── styles.css           # Accessible styles (high contrast)
│   └── js/
│       ├── app.js               # Main application orchestrator
│       ├── audio.js             # Microphone capture & playback
│       ├── camera.js            # Camera capture & frame streaming
│       ├── websocket.js         # WebSocket client
│       └── ui.js                # UI management & accessibility
│
├── infrastructure/
│   └── cloudbuild.yaml          # Cloud Build CI/CD pipeline
│
├── docs/
│   ├── architecture-diagram.png # Architecture diagram
│   └── cloud-deployment-proof.md# Cloud deployment documentation
│
├── deploy.sh                    # Automated deployment script
├── README.md                    # This file
├── Rules.txt                    # Hackathon rules
└── .gitignore                   # Git ignore rules
```

---

## 🎬 Demo

📹 **Demo Video**: [YouTube Link — Coming Soon](#)

The demo showcases EyeGuide in 4 real-world scenarios:
1. **Kitchen** — Identifying objects, reading food labels
2. **Walking** — Describing surroundings, warning about stairs
3. **Reading** — Reading a document held up to the camera
4. **Shopping** — Comparing products, reading prices

Key moments:
- Natural voice conversation with the AI
- **Barge-in demonstration**: User interrupts the AI mid-sentence and gets an immediate response
- Mode switching via voice commands
- Hazard detection and proactive warnings

---

## 📊 Google Cloud Services Used

| Service | Purpose | Proof |
|---------|---------|-------|
| **Vertex AI (Gemini Live API)** | Real-time multimodal AI | API calls in `server.py` |
| **Cloud Run** | Backend hosting | Deployment script + console screenshot |
| **Firestore** | User preferences & session data | Tools in `tools.py` |
| **Cloud Build** | CI/CD pipeline | `cloudbuild.yaml` |
| **Artifact Registry** | Docker image storage | `deploy.sh` |

---

## 🏆 Hackathon Submission Details

- **Category**: Live Agents
- **Challenge**: Build an agent that users can talk to naturally, can be interrupted, with real-time audio + vision
- **Mandatory Tech**: ✅ Gemini Live API, ✅ ADK, ✅ Google Cloud hosted
- **Hashtag**: #GeminiLiveAgentChallenge

---

## 📝 Learnings & Findings

1. **Gemini Live API's barge-in is remarkably natural** — the model handles interruptions gracefully, stopping generation immediately
2. **ADK's LiveRequestQueue simplifies bidi-streaming** — it abstracts the complexity of concurrent audio/video I/O
3. **1 FPS video is sufficient** for scene understanding — Gemini can understand context from surprisingly few frames
4. **System prompt engineering is critical** — the difference between a useful assistant and a great one is in the persona design
5. **Accessibility-first design benefits everyone** — large touch targets, high contrast, and keyboard shortcuts improve UX for all users

---

## 🔮 Future Vision

- **Smart glasses integration** — EyeGuide on AR glasses for hands-free, always-on assistance
- **Navigation APIs** — Integrate Google Maps for turn-by-turn walking directions
- **Object memory** — Remember and recognize previously seen objects/places
- **Multi-language support** — Help non-English speakers navigate foreign environments
- **Emergency contacts** — One-tap alert to caregivers in dangerous situations
- **Offline mode** — Basic hazard detection using on-device models

---

## 📄 License

This project is open source under the [MIT License](LICENSE).

---

## 👥 Team

Built for the **Gemini Live Agent Challenge 2026** hackathon.

---

*Created for the purposes of entering the Gemini Live Agent Challenge hackathon. #GeminiLiveAgentChallenge*
