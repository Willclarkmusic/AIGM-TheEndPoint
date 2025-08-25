"""Generation API endpoints for AI-generated content."""

import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
import structlog
from models import (
    GenerateRequest, 
    GenerateResponse, 
    ErrorResponse,
    MediaType,
    GenerationStatus
)
from services.firestore_service import get_firestore_service
from services.stability_service import get_stability_service
from middleware.auth import get_current_user
from config import get_settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["generate"])


@router.post(
    "/gen-call",
    response_model=GenerateResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        402: {"model": ErrorResponse, "description": "Insufficient credits"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    }
)
async def generate_content(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user)
) -> GenerateResponse:
    """
    Handle generative AI requests for images and music.
    
    This endpoint checks user credits, initiates generation with Stability AI,
    and returns a request ID for tracking the generation status.
    """
    firestore = get_firestore_service()
    stability = get_stability_service()
    settings = get_settings()
    
    try:
        # Validate user matches request
        if request.user_id != current_user:
            raise HTTPException(
                status_code=403,
                detail="User ID mismatch"
            )
        
        # Calculate credit cost
        credit_cost = stability.get_generation_cost(
            request.media_type,
            request.duration
        )
        
        # Check user credits
        user_credits = await firestore.get_user_credits(request.user_id)
        if not user_credits:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        if user_credits.gen_ai_credits < credit_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient GenAI credits. Required: {credit_cost}, Available: {user_credits.gen_ai_credits}"
            )
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # For synchronous processing (MVP)
        # In production, this should use Pub/Sub for async processing
        try:
            if request.media_type == MediaType.IMAGE:
                # Generate image
                media_url, metadata = await stability.generate_image(
                    prompt=request.prompt,
                    style=request.style
                )
                
            elif request.media_type == MediaType.MUSIC:
                # Generate music
                media_url, metadata = await stability.generate_music(
                    prompt=request.prompt,
                    duration=request.duration or 30,
                    style=request.style
                )
                
            elif request.media_type == MediaType.ALBUM_ART:
                # Generate album art
                media_url, metadata = await stability.generate_album_art(
                    prompt=request.prompt
                )
            else:
                raise ValueError(f"Unsupported media type: {request.media_type}")
            
            # Deduct credits after successful generation
            success, remaining_credits = await firestore.deduct_credits(
                user_id=request.user_id,
                credit_type="genai",
                amount=credit_cost
            )
            
            if not success:
                # This shouldn't happen as we checked earlier
                logger.error(f"Failed to deduct credits after generation for user {request.user_id}")
            
            # Log interaction
            await firestore.log_ai_interaction(
                user_id=request.user_id,
                agent_id="stability-ai",
                interaction_type="generation",
                credits_used=credit_cost,
                metadata={
                    "request_id": request_id,
                    "media_type": request.media_type.value,
                    "prompt_length": len(request.prompt),
                    **metadata
                }
            )
            
            # Return successful response
            return GenerateResponse(
                request_id=request_id,
                status=GenerationStatus.COMPLETED,
                media_url=media_url,
                media_type=request.media_type,
                credits_used=credit_cost,
                credits_remaining=remaining_credits
            )
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            
            # Return error response (no credits deducted)
            return GenerateResponse(
                request_id=request_id,
                status=GenerationStatus.FAILED,
                media_type=request.media_type,
                credits_used=0,
                credits_remaining=user_credits.gen_ai_credits,
                error=str(e)
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate call: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error processing generation request"
        )


@router.get("/generate/{request_id}")
async def get_generation_status(
    request_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get the status of a generation request.
    
    In the MVP, generations are synchronous so this will always return completed/failed.
    In production, this would check the actual async job status.
    """
    # For MVP, we don't store generation status
    # In production, this would query a jobs collection
    return {
        "request_id": request_id,
        "status": GenerationStatus.COMPLETED,
        "message": "Generation requests are processed synchronously in MVP"
    }


@router.get("/generate/credits/balance")
async def get_credit_balance(
    current_user: str = Depends(get_current_user)
):
    """Get user's current credit balance."""
    firestore = get_firestore_service()
    
    try:
        user_credits = await firestore.get_user_credits(current_user)
        if not user_credits:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        return {
            "user_id": current_user,
            "chat_credits": user_credits.chat_credits,
            "gen_ai_credits": user_credits.gen_ai_credits,
            "subscription_tier": user_credits.subscription_tier,
            "last_reset": user_credits.last_reset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting credit balance: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )