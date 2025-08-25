"""Chat API endpoints for conversational AI."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
import structlog
from models import ChatRequest, ChatResponse, ErrorResponse
from services.firestore_service import get_firestore_service
from services.gemini_service import get_gemini_service
from services.langraph_agent import AgentFactory
from middleware.auth import get_current_user
from middleware.rate_limit import rate_limit_check
from config import get_settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post(
    "/chat-call",
    response_model=ChatResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        402: {"model": ErrorResponse, "description": "Insufficient credits"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    }
)
@rate_limit_check(5)  # 5 requests per minute
async def chat_call(
    chat_request: ChatRequest,
    request: Request,
    current_user: str = Depends(get_current_user)
) -> ChatResponse:
    """
    Handle conversational AI requests.
    
    This endpoint processes user messages through AI agents with personalities,
    deducts chat credits, and returns the agent's response.
    """
    firestore = get_firestore_service()
    gemini = get_gemini_service()
    settings = get_settings()
    
    try:
        # Validate user matches request
        if chat_request.user_id != current_user:
            raise HTTPException(
                status_code=403,
                detail="User ID mismatch"
            )
        
        # Check user credits
        user_credits = await firestore.get_user_credits(chat_request.user_id)
        if not user_credits:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        if user_credits.chat_credits < settings.chat_credit_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient chat credits. Required: {settings.chat_credit_cost}, Available: {user_credits.chat_credits}"
            )
        
        # Check agent access
        has_access = await firestore.check_user_agent_access(
            chat_request.user_id,
            chat_request.agent_id
        )
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this AI agent"
            )
        
        # Get agent personality
        agent_personality = await firestore.get_agent_personality(chat_request.agent_id)
        if not agent_personality:
            raise HTTPException(
                status_code=404,
                detail="AI agent not found"
            )
        
        # Create agent with personality
        agent = AgentFactory.create_agent(agent_personality, gemini)
        
        # Process message through agent
        response_text, metadata = await agent.call(
            message=chat_request.message,
            context=chat_request.context
        )
        
        # Deduct credits
        success, remaining_credits = await firestore.deduct_credits(
            user_id=chat_request.user_id,
            credit_type="chat",
            amount=settings.chat_credit_cost
        )
        
        if not success:
            raise HTTPException(
                status_code=402,
                detail="Failed to deduct credits"
            )
        
        # Log interaction
        await firestore.log_ai_interaction(
            user_id=chat_request.user_id,
            agent_id=chat_request.agent_id,
            interaction_type="chat",
            tokens_used=metadata.get("tokens_used", 0),
            credits_used=settings.chat_credit_cost,
            metadata={
                "room_id": chat_request.room_id,
                "server_id": chat_request.server_id,
                "message_length": len(chat_request.message)
            }
        )
        
        # Build response
        return ChatResponse(
            message=response_text,
            agent_id=chat_request.agent_id,
            tokens_used=metadata.get("tokens_used", 0),
            credits_remaining=remaining_credits
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat call: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error processing chat request"
        )


@router.get("/chat/agents/{agent_id}")
async def get_agent_info(
    agent_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get information about a specific AI agent."""
    firestore = get_firestore_service()
    
    try:
        # Check access
        has_access = await firestore.check_user_agent_access(current_user, agent_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this AI agent"
            )
        
        # Get agent info
        agent = await firestore.get_agent_personality(agent_id)
        if not agent:
            raise HTTPException(
                status_code=404,
                detail="AI agent not found"
            )
        
        # Return public info only
        return {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "is_public": agent.is_public,
            "personality_rules_count": len(agent.personality_rules),
            "created_at": agent.created_at,
            "updated_at": agent.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent info: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )