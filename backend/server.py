"""EyeGuide Backend Server — FastAPI WebSocket server with ADK Bidi-Streaming.

This server handles real-time audio and video streaming between the frontend
client and the Gemini Live API via the ADK bidi-streaming runtime.

Architecture:
  Client (Browser) ←→ WebSocket ←→ FastAPI Server ←→ ADK Runner ←→ Gemini Live API
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file (explicitly from this script's directory)
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from google.adk.runners import Runner, RunConfig
from google.adk.sessions import InMemorySessionService
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import StreamingMode
from google.genai import types
from google.genai.types import Modality

from eyeguide_agent.agent import eyeguide_agent
from eyeguide_agent.config import (
    APP_NAME,
    HOST,
    PORT,
    ALLOWED_ORIGINS,
    AUDIO_MIME_TYPE,
    VIDEO_MIME_TYPE,
    DEFAULT_VOICE,
    AUDIO_OUTPUT_SAMPLE_RATE,
)

# ─── Logging Setup ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eyeguide-server")

# ─── ADK Session & Runner Setup ─────────────────────────────────────────────

session_service = InMemorySessionService()

runner = Runner(
    agent=eyeguide_agent,
    app_name=APP_NAME,
    session_service=session_service,
)

# ─── Active connections tracking ─────────────────────────────────────────────

active_connections: dict[str, dict] = {}


# ─── App Lifespan ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("🚀 EyeGuide server starting up...")
    logger.info(f"   Agent: {eyeguide_agent.name}")
    logger.info(f"   Model: {eyeguide_agent.model}")
    logger.info(f"   Voice: {DEFAULT_VOICE}")
    yield
    logger.info("👋 EyeGuide server shutting down...")
    # Clean up active connections
    for sid in list(active_connections.keys()):
        try:
            info = active_connections[sid]
            if "queue" in info:
                info["queue"].close()
        except Exception:
            pass
    active_connections.clear()


# ─── FastAPI App ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="EyeGuide - Real-time Accessibility Companion",
    description="AI-powered visual assistance for visually impaired users using Gemini Live API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return {
        "status": "healthy",
        "service": "eyeguide",
        "agent": eyeguide_agent.name,
        "model": eyeguide_agent.model,
        "active_sessions": len(active_connections),
    }


@app.get("/api/info")
async def get_info():
    """Return server and agent information."""
    return {
        "name": "EyeGuide",
        "description": "Real-time accessibility companion for visually impaired users",
        "version": "1.0.0",
        "model": eyeguide_agent.model,
        "voice": DEFAULT_VOICE,
        "modes": ["navigation", "reading", "exploration", "shopping"],
        "features": [
            "Real-time scene description",
            "Hazard detection & warnings",
            "Text/label reading",
            "Natural voice conversation",
            "Barge-in (interruption) support",
            "Multiple operating modes",
            "Persistent user preferences",
        ],
    }


# ─── WebSocket Endpoint ─────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str = None):
    """Main WebSocket endpoint for real-time audio/video streaming.
    
    Protocol:
      Client → Server:
        - Binary messages: Raw audio PCM data (16-bit, 16kHz, mono)
        - JSON messages: {"type": "video_frame", "data": "<base64 JPEG>"}
        - JSON messages: {"type": "control", "action": "..."}
      
      Server → Client:
        - Binary messages: Audio PCM data for playback (16-bit, 24kHz, mono)
        - JSON messages: {"type": "transcript", "text": "..."}
        - JSON messages: {"type": "status", "message": "..."}
    """
    await websocket.accept()
    
    # Generate session ID if not provided
    if not session_id or session_id == "new":
        session_id = str(uuid.uuid4())
    
    logger.info(f"📱 Client connected: session={session_id}")

    # Create ADK session
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=session_id,
    )

    # Create the live request queue for bidi-streaming
    live_queue = LiveRequestQueue()

    # Track this connection
    active_connections[session_id] = {
        "websocket": websocket,
        "queue": live_queue,
        "session": session,
    }

    # Send session info to client
    await websocket.send_json({
        "type": "session_info",
        "session_id": session_id,
        "message": "Connected to EyeGuide. Start speaking or point your camera.",
    })

    try:
        # Configure ADK RunConfig for live streaming
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=[Modality.AUDIO],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=DEFAULT_VOICE,
                    )
                )
            ),
        )

        # Start the ADK live agent runner
        live_events = runner.run_live(
            session=session,
            live_request_queue=live_queue,
            run_config=run_config,
        )

        # ─── Task 1: Receive data from client → feed to agent ────────────
        async def receive_from_client():
            """Receive audio/video data from the WebSocket client and feed it to the agent."""
            try:
                while True:
                    message = await websocket.receive()
                    
                    if "bytes" in message:
                        # Binary message = raw audio PCM data
                        audio_data = message["bytes"]
                        live_queue.send_realtime(
                            types.Blob(
                                data=audio_data,
                                mime_type=AUDIO_MIME_TYPE,
                            )
                        )
                    
                    elif "text" in message:
                        # JSON message = video frame or control command
                        try:
                            data = json.loads(message["text"])
                            msg_type = data.get("type", "")
                            
                            if msg_type == "video_frame":
                                # Video frame as base64 JPEG
                                frame_data = base64.b64decode(data["data"])
                                live_queue.send_realtime(
                                    types.Blob(
                                        data=frame_data,
                                        mime_type=VIDEO_MIME_TYPE,
                                    )
                                )
                            
                            elif msg_type == "text_input":
                                # Text input (fallback for accessibility)
                                live_queue.send_content(
                                    types.Content(
                                        role="user",
                                        parts=[types.Part(text=data.get("text", ""))],
                                    )
                                )
                            
                            elif msg_type == "control":
                                action = data.get("action", "")
                                if action == "end_audio_stream":
                                    live_queue.send_realtime(
                                        types.LiveClientRealtimeInput(
                                            audio_stream_end=True
                                        )
                                    )
                                elif action == "close":
                                    break
                                    
                        except json.JSONDecodeError:
                            logger.warning(f"Invalid JSON from client: {message['text'][:100]}")
                    
            except WebSocketDisconnect:
                logger.info(f"📴 Client disconnected: session={session_id}")
            except Exception as e:
                logger.error(f"Error receiving from client: {e}")
            finally:
                live_queue.close()

        # ─── Task 2: Receive agent responses → send to client ────────────
        async def send_to_client():
            """Receive responses from the agent and send them to the WebSocket client."""
            try:
                async for event in live_events:
                    # Safe attribute access for Event fields
                    content = getattr(event, 'content', None)
                    turn_complete = getattr(event, 'turnComplete', None) or getattr(event, 'turn_complete', None)
                    is_interrupted = getattr(event, 'interrupted', None)
                    actions = getattr(event, 'actions', None)
                    
                    # Handle content (audio/text responses from the model)
                    if content and hasattr(content, 'parts') and content.parts:
                        for part in content.parts:
                            if hasattr(part, 'inline_data') and part.inline_data:
                                # Audio response — send as binary
                                await websocket.send_bytes(part.inline_data.data)
                            elif hasattr(part, 'text') and part.text:
                                # Text response — send as JSON
                                await websocket.send_json({
                                    "type": "transcript",
                                    "text": part.text,
                                })
                    
                    # Handle turn completion
                    if turn_complete:
                        await websocket.send_json({
                            "type": "turn_complete",
                        })
                    
                    # Handle interruption (barge-in)
                    if is_interrupted:
                        await websocket.send_json({
                            "type": "interrupted",
                            "message": "Response interrupted by user",
                        })
                        logger.info(f"🔇 Barge-in detected: session={session_id}")
                    
                    # Handle output audio transcription (what the AI said, as text)
                    out_transcription = getattr(event, 'outputTranscription', None)
                    if out_transcription and hasattr(out_transcription, 'text') and out_transcription.text:
                        await websocket.send_json({
                            "type": "transcript",
                            "text": out_transcription.text,
                        })
                    
                    # Handle input audio transcription (what the user said, as text)
                    in_transcription = getattr(event, 'inputTranscription', None)
                    if in_transcription and hasattr(in_transcription, 'text') and in_transcription.text:
                        await websocket.send_json({
                            "type": "user_transcript",
                            "text": in_transcription.text,
                        })
                    
                    # Handle tool calls
                    if actions and hasattr(actions, 'actions') and actions.actions:
                        for action in actions.actions:
                            fc = getattr(action, 'function_call', None)
                            if fc:
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "tool": fc.name,
                                })

            except WebSocketDisconnect:
                pass
            except Exception as e:
                logger.error(f"Error sending to client: {e}")

        # Run both tasks concurrently
        await asyncio.gather(
            receive_from_client(),
            send_to_client(),
        )

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Server error: {str(e)}",
            })
        except Exception:
            pass
    finally:
        # Cleanup
        if session_id in active_connections:
            del active_connections[session_id]
        logger.info(f"🧹 Session cleaned up: {session_id}")


# ─── Serve Frontend Static Files ────────────────────────────────────────────

# Check if static directory exists (for local dev vs Docker)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    @app.get("/")
    async def serve_index():
        """Serve the main frontend page."""
        return FileResponse(os.path.join(static_dir, "index.html"))

    app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ─── Run with Uvicorn ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        reload=True,
        log_level="info",
    )
