"""API module for AI Service."""

from .chat import router as chat_router
from .generate import router as generate_router

__all__ = ["chat_router", "generate_router"]