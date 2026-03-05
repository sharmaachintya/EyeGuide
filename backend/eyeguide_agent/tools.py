"""Custom tools for EyeGuide Agent.

These tools enable the agent to interact with Firestore for user preferences
and session management, providing persistent context across sessions.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from google.cloud import firestore
from .config import (
    FIRESTORE_COLLECTION_USERS,
    FIRESTORE_COLLECTION_SESSIONS,
    MODES,
    DEFAULT_MODE,
    DEFAULT_VERBOSITY,
)

logger = logging.getLogger(__name__)

# Initialize Firestore client (lazy initialization)
_db = None


def _get_db():
    """Lazy initialization of Firestore client."""
    global _db
    if _db is None:
        try:
            _db = firestore.Client()
            logger.info("Firestore client initialized successfully.")
        except Exception as e:
            logger.warning(f"Firestore initialization failed: {e}. Running without persistence.")
            return None
    return _db


def save_user_preference(
    user_id: str,
    preference_key: str,
    preference_value: str,
) -> dict:
    """Save a user preference to Firestore.

    Use this tool when the user asks to change their preferences such as
    verbosity level, preferred mode, voice speed, or any other setting.

    Args:
        user_id: The unique identifier for the user.
        preference_key: The preference to save. One of: 'verbosity' (brief/normal/detailed),
                       'default_mode' (navigation/reading/exploration/shopping),
                       'voice_speed' (slow/normal/fast), 'language' (e.g., 'en-US').
        preference_value: The value to set for the preference.

    Returns:
        A dictionary with the result of the operation.
    """
    db = _get_db()
    if db is None:
        return {
            "status": "ok",
            "message": f"Preference noted: {preference_key} = {preference_value} (stored in memory only)",
        }

    try:
        valid_preferences = {
            "verbosity": ["brief", "normal", "detailed"],
            "default_mode": list(MODES.keys()),
            "voice_speed": ["slow", "normal", "fast"],
            "language": None,  # Any string is valid
        }

        if preference_key not in valid_preferences:
            return {
                "status": "error",
                "message": f"Unknown preference '{preference_key}'. Valid options: {list(valid_preferences.keys())}",
            }

        allowed = valid_preferences[preference_key]
        if allowed and preference_value.lower() not in allowed:
            return {
                "status": "error",
                "message": f"Invalid value '{preference_value}' for '{preference_key}'. Valid options: {allowed}",
            }

        doc_ref = db.collection(FIRESTORE_COLLECTION_USERS).document(user_id)
        doc_ref.set(
            {
                preference_key: preference_value.lower(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            merge=True,
        )

        return {
            "status": "success",
            "message": f"Preference saved: {preference_key} = {preference_value}",
        }
    except Exception as e:
        logger.error(f"Error saving preference: {e}")
        return {
            "status": "error",
            "message": f"Could not save preference: {str(e)}",
        }


def get_user_preferences(user_id: str) -> dict:
    """Retrieve user preferences from Firestore.

    Use this tool when you need to check the user's saved preferences,
    such as their preferred verbosity level, default mode, or voice settings.

    Args:
        user_id: The unique identifier for the user.

    Returns:
        A dictionary containing the user's preferences.
    """
    db = _get_db()
    if db is None:
        return {
            "status": "ok",
            "preferences": {
                "verbosity": DEFAULT_VERBOSITY,
                "default_mode": DEFAULT_MODE,
                "voice_speed": "normal",
                "language": "en-US",
            },
            "message": "Using default preferences (Firestore not available)",
        }

    try:
        doc_ref = db.collection(FIRESTORE_COLLECTION_USERS).document(user_id)
        doc = doc_ref.get()

        if doc.exists:
            preferences = doc.to_dict()
            return {
                "status": "success",
                "preferences": preferences,
            }
        else:
            # Return defaults for new user
            default_prefs = {
                "verbosity": DEFAULT_VERBOSITY,
                "default_mode": DEFAULT_MODE,
                "voice_speed": "normal",
                "language": "en-US",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            doc_ref.set(default_prefs)
            return {
                "status": "success",
                "preferences": default_prefs,
                "message": "New user — created with default preferences",
            }
    except Exception as e:
        logger.error(f"Error getting preferences: {e}")
        return {
            "status": "error",
            "preferences": {
                "verbosity": DEFAULT_VERBOSITY,
                "default_mode": DEFAULT_MODE,
            },
            "message": f"Error loading preferences: {str(e)}",
        }


def log_session_event(
    session_id: str,
    event_type: str,
    event_data: Optional[str] = None,
) -> dict:
    """Log a session event to Firestore for analytics and debugging.

    Use this tool to log important events during a session, such as
    mode switches, hazard detections, or error conditions.

    Args:
        session_id: The unique session identifier.
        event_type: Type of event. One of: 'mode_switch', 'hazard_detected',
                    'text_read', 'scene_described', 'error', 'session_start', 'session_end'.
        event_data: Optional additional data about the event.

    Returns:
        A dictionary with the result of the logging operation.
    """
    db = _get_db()
    if db is None:
        logger.info(f"Session event [{session_id}]: {event_type} - {event_data}")
        return {"status": "ok", "message": "Event logged to console (Firestore not available)"}

    try:
        events_ref = (
            db.collection(FIRESTORE_COLLECTION_SESSIONS)
            .document(session_id)
            .collection("events")
        )
        events_ref.add(
            {
                "event_type": event_type,
                "event_data": event_data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {"status": "success", "message": f"Event logged: {event_type}"}
    except Exception as e:
        logger.error(f"Error logging session event: {e}")
        return {"status": "error", "message": f"Could not log event: {str(e)}"}


def get_mode_description(mode_name: str) -> dict:
    """Get the description and instructions for a specific operating mode.

    Use this tool when the user asks to switch modes or wants to know
    what modes are available.

    Args:
        mode_name: The mode to get info about. One of: 'navigation', 'reading',
                   'exploration', 'shopping'. Use 'all' to list all modes.

    Returns:
        A dictionary with mode information.
    """
    if mode_name.lower() == "all":
        return {
            "status": "success",
            "modes": MODES,
            "message": "Available modes listed above. User can say 'switch to [mode]' to change.",
        }

    mode = mode_name.lower()
    if mode in MODES:
        return {
            "status": "success",
            "mode": mode,
            "description": MODES[mode],
        }
    else:
        return {
            "status": "error",
            "message": f"Unknown mode '{mode_name}'. Available modes: {list(MODES.keys())}",
        }
