# 🏗️ EyeGuide Architecture Diagram


## Text-Based Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER'S DEVICE                           │
│                                                              │
│    ┌──────────┐    ┌──────────┐    ┌──────────────────┐     │
│    │ Camera 📷 │    │  Mic 🎤  │    │   Speaker 🔊     │     │
│    └─────┬────┘    └─────┬────┘    └────────▲─────────┘     │
│          │               │                  │               │
│    ┌─────▼───────────────▼──────────────────┴───────────┐   │
│    │              Frontend Web App                       │   │
│    │   ┌────────────────────────────────────────────┐   │   │
│    │   │  camera.js  │  audio.js  │  websocket.js   │   │   │
│    │   │  (frames)   │  (PCM)     │  (transport)    │   │   │
│    │   └──────┬──────┴──────┬─────┴───────┬─────────┘   │   │
│    │          │             │             │              │   │
│    │   ┌──────▼─────────────▼─────────────▼──────────┐  │   │
│    │   │              app.js (orchestrator)           │  │   │
│    │   └─────────────────────┬───────────────────────┘  │   │
│    │                         │                          │   │
│    │   ┌─────────────────────▼───────────────────────┐  │   │
│    │   │           ui.js (accessible UI)             │  │   │
│    │   │  • Mode selector  • Transcript  • Settings  │  │   │
│    │   └─────────────────────────────────────────────┘  │   │
│    └─────────────────────────┬───────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────┘
                               │
                    WebSocket (wss://)
                    ┌──────────┴──────────┐
                    │  Video frames (JPEG) │
                    │  Audio chunks (PCM)  │
                    │  Text messages (JSON)│
                    └──────────┬──────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                   GOOGLE CLOUD                                │
│                                                               │
│   ┌──────────────────────────────────────────────────────┐   │
│   │              Cloud Run (Backend)                     │   │
│   │                                                      │   │
│   │   ┌──────────────────────────────────────────────┐  │   │
│   │   │         FastAPI + WebSocket Server            │  │   │
│   │   │              (server.py)                      │  │   │
│   │   └──────────────────┬───────────────────────────┘  │   │
│   │                      │                              │   │
│   │   ┌──────────────────▼───────────────────────────┐  │   │
│   │   │      ADK Bidi-Streaming Runtime              │  │   │
│   │   │  ┌──────────────────────────────────────┐   │  │   │
│   │   │  │  LiveRequestQueue ←→ Runner           │   │  │   │
│   │   │  │  (concurrent audio/video I/O)         │   │  │   │
│   │   │  └──────────────┬───────────────────────┘   │  │   │
│   │   │                 │                            │  │   │
│   │   │  ┌──────────────▼───────────────────────┐   │  │   │
│   │   │  │      EyeGuide Agent                   │   │  │   │
│   │   │  │  • System prompt (persona)            │   │  │   │
│   │   │  │  • Tools: preferences, modes, logs    │   │  │   │
│   │   │  └──────────────┬───────────────────────┘   │  │   │
│   │   └─────────────────┼────────────────────────────┘  │   │
│   └─────────────────────┼────────────────────────────────┘   │
│                         │                                     │
│   ┌─────────────────────▼────────────────────────────────┐   │
│   │           Vertex AI — Gemini Live API                │   │
│   │                                                      │   │
│   │   Model: gemini-2.0-flash-live-001                  │   │
│   │   ┌─────────────┐  ┌────────────────────────────┐  │   │
│   │   │   INPUT:     │  │   OUTPUT:                  │  │   │
│   │   │ • Audio PCM  │  │ • Audio PCM (voice)        │  │   │
│   │   │ • Video JPEG │  │ • Text (transcript)        │  │   │
│   │   │ • Text       │  │ • Tool calls               │  │   │
│   │   └─────────────┘  └────────────────────────────┘  │   │
│   │                                                      │   │
│   │   Features: VAD, barge-in, session memory,          │   │
│   │             steerable voice, multimodal context      │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌──────────────────────────────────────────────────────┐   │
│   │              Firestore                               │   │
│   │   ┌──────────────┐  ┌───────────────────────────┐  │   │
│   │   │ users/{id}   │  │ sessions/{id}/events      │  │   │
│   │   │ • verbosity  │  │ • mode_switch             │  │   │
│   │   │ • default_mode│  │ • hazard_detected         │  │   │
│   │   │ • voice_speed │  │ • text_read               │  │   │
│   │   └──────────────┘  └───────────────────────────┘  │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌──────────────────────────────────────────────────────┐   │
│   │   Cloud Build + Artifact Registry (CI/CD)           │   │
│   └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **User speaks** → Microphone captures audio → PCM encoded → WebSocket → Server
2. **Camera captures frame** → JPEG encoded → Base64 → WebSocket → Server
3. **Server receives** → Feeds to ADK LiveRequestQueue → Gemini Live API processes
4. **Gemini responds** → Audio + text → Server → WebSocket → Client plays audio + shows transcript
5. **User interrupts (barge-in)** → Gemini detects → Stops generating → Responds to new input
6. **Agent uses tools** → Firestore reads/writes → Results inform agent response
