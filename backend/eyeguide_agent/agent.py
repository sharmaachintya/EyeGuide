"""EyeGuide Agent — Main ADK agent definition.

This module defines the core EyeGuide agent using Google's Agent Development Kit (ADK).
The agent uses the Gemini Live API for real-time audio + video streaming to provide
accessibility assistance to visually impaired users.
"""

from google.adk.agents import Agent

from .config import GEMINI_LIVE_MODEL, AGENT_NAME, AGENT_DESCRIPTION
from .prompts import SYSTEM_PROMPT

# ─── Define the EyeGuide Agent ──────────────────────────────────────────────
# Note: Function tools are disabled for the native audio model
# (gemini-2.5-flash-native-audio) as it does not fully support function calling.
# The agent handles mode switching, preferences, etc. via the system prompt
# and natural language understanding.

eyeguide_agent = Agent(
    model=GEMINI_LIVE_MODEL,
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
    instruction=SYSTEM_PROMPT,
    tools=[],
)
