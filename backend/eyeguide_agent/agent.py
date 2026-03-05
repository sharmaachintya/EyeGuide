"""EyeGuide Agent — Main ADK agent definition.

This module defines the core EyeGuide agent using Google's Agent Development Kit (ADK).
The agent uses the Gemini Live API for real-time audio + video streaming to provide
accessibility assistance to visually impaired users.
"""

from google.adk.agents import Agent
from google.adk.tools import FunctionTool

from .config import GEMINI_LIVE_MODEL, AGENT_NAME, AGENT_DESCRIPTION
from .prompts import SYSTEM_PROMPT
from .tools import (
    save_user_preference,
    get_user_preferences,
    log_session_event,
    get_mode_description,
)

# ─── Define ADK Function Tools ──────────────────────────────────────────────

save_preference_tool = FunctionTool(func=save_user_preference)
get_preferences_tool = FunctionTool(func=get_user_preferences)
log_event_tool = FunctionTool(func=log_session_event)
get_mode_tool = FunctionTool(func=get_mode_description)

# ─── Define the EyeGuide Agent ──────────────────────────────────────────────

eyeguide_agent = Agent(
    model=GEMINI_LIVE_MODEL,
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
    instruction=SYSTEM_PROMPT,
    tools=[
        save_preference_tool,
        get_preferences_tool,
        log_event_tool,
        get_mode_tool,
    ],
)
