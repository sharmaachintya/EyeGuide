"""Configuration constants for EyeGuide Agent."""

import os

# ─── Model Configuration ────────────────────────────────────────────────────
GEMINI_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")

# ─── Agent Configuration ────────────────────────────────────────────────────
AGENT_NAME = "eyeguide"
AGENT_DESCRIPTION = "Real-time accessibility companion for visually impaired users"
APP_NAME = "eyeguide-app"

# ─── Audio Configuration ────────────────────────────────────────────────────
AUDIO_SAMPLE_RATE = 16000  # 16kHz for input
AUDIO_OUTPUT_SAMPLE_RATE = 24000  # 24kHz for output
AUDIO_CHANNELS = 1
AUDIO_MIME_TYPE = "audio/pcm"

# ─── Video Configuration ────────────────────────────────────────────────────
VIDEO_FRAME_RATE = 1  # 1 frame per second
VIDEO_MIME_TYPE = "image/jpeg"
VIDEO_WIDTH = 640
VIDEO_HEIGHT = 480
VIDEO_QUALITY = 0.7

# ─── Voice Configuration ────────────────────────────────────────────────────
# Available voices: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr
DEFAULT_VOICE = "Kore"  # Warm, calm female voice
SPEECH_LANGUAGE = "en-US"

# ─── Server Configuration ───────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8080"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# ─── Google Cloud Configuration ─────────────────────────────────────────────
GCP_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "")
GCP_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
USE_VERTEX_AI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "TRUE").upper() == "TRUE"

# ─── Firestore Configuration ────────────────────────────────────────────────
FIRESTORE_COLLECTION_USERS = "users"
FIRESTORE_COLLECTION_SESSIONS = "sessions"

# ─── Modes ───────────────────────────────────────────────────────────────────
MODES = {
    "navigation": "Focus on paths, obstacles, directions, signs, and safe movement.",
    "reading": "Focus on reading and dictating all visible text clearly.",
    "exploration": "Describe the full scene in rich, vivid detail.",
    "shopping": "Read product labels, prices, ingredients, and compare items.",
}

DEFAULT_MODE = "navigation"
DEFAULT_VERBOSITY = "normal"  # brief, normal, detailed
