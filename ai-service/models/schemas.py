"""API schemas for AI Service."""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class MediaType(str, Enum):
    """Supported media generation types."""
    IMAGE = "image"
    MUSIC = "music"
    ALBUM_ART = "album_art"


class GenerationStatus(str, Enum):
    """Status of generation request."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    user_id: str = Field(..., description="User ID making the request")
    agent_id: str = Field(..., description="AI agent ID to use")
    message: str = Field(..., description="User's message")
    context: Optional[List[Dict[str, str]]] = Field(
        default=None, 
        description="Previous conversation context"
    )
    room_id: Optional[str] = Field(None, description="Chat room ID")
    server_id: Optional[str] = Field(None, description="Server ID")
    
    @validator('message')
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError('Message cannot be empty')
        if len(v) > 4096:
            raise ValueError('Message too long (max 4096 characters)')
        return v


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    message: str = Field(..., description="AI agent's response")
    agent_id: str = Field(..., description="AI agent ID")
    tokens_used: int = Field(..., description="Number of tokens used")
    credits_remaining: int = Field(..., description="User's remaining chat credits")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class GenerateRequest(BaseModel):
    """Request model for generation endpoint."""
    user_id: str = Field(..., description="User ID making the request")
    prompt: str = Field(..., description="Generation prompt")
    media_type: MediaType = Field(..., description="Type of media to generate")
    style: Optional[str] = Field(None, description="Style parameters")
    duration: Optional[int] = Field(
        None, 
        description="Duration in seconds (for music)",
        ge=1,
        le=180
    )
    
    @validator('prompt')
    def validate_prompt(cls, v):
        if not v.strip():
            raise ValueError('Prompt cannot be empty')
        if len(v) > 1000:
            raise ValueError('Prompt too long (max 1000 characters)')
        return v


class GenerateResponse(BaseModel):
    """Response model for generation endpoint."""
    request_id: str = Field(..., description="Unique request ID")
    status: GenerationStatus = Field(..., description="Generation status")
    media_url: Optional[str] = Field(None, description="URL of generated media")
    media_type: MediaType = Field(..., description="Type of media generated")
    credits_used: int = Field(..., description="Credits consumed")
    credits_remaining: int = Field(..., description="User's remaining GenAI credits")
    error: Optional[str] = Field(None, description="Error message if failed")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(..., description="API version")
    services: Dict[str, bool] = Field(
        ..., 
        description="Status of connected services"
    )


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    code: str = Field(..., description="Error code")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class UserCredits(BaseModel):
    """User credits model."""
    user_id: str
    chat_credits: int = Field(ge=0)
    gen_ai_credits: int = Field(ge=0)
    last_reset: datetime
    subscription_tier: str = "free"


class AgentPersonality(BaseModel):
    """AI agent personality model."""
    agent_id: str
    name: str
    personality_rules: List[str] = Field(
        ..., 
        description="List of personality rules/prompts"
    )
    gen_rules: Optional[List[str]] = Field(
        None,
        description="Generation-specific rules"
    )
    is_public: bool = False
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)