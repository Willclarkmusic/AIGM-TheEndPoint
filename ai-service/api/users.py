"""User management API endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
import structlog
from models import UserCredits, ErrorResponse
from services.firestore_service import get_firestore_service
from middleware.auth import get_current_user
from config import get_settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["users"])


@router.post(
    "/users/initialize",
    response_model=UserCredits,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    }
)
async def initialize_user(
    current_user: str = Depends(get_current_user)
) -> UserCredits:
    """
    Initialize user with default credits.
    
    Creates user document with initial credit allocation if it doesn't exist.
    Returns existing credits if user already exists.
    """
    firestore = get_firestore_service()
    settings = get_settings()
    
    try:
        # Check if user already exists
        existing_credits = await firestore.get_user_credits(current_user)
        if existing_credits:
            logger.info(f"User {current_user} already exists with {existing_credits.chat_credits} chat credits and {existing_credits.gen_ai_credits} genAI credits")
            return existing_credits
        
        # Create new user with initial credits
        success = await firestore.initialize_user_credits(
            user_id=current_user,
            chat_credits=settings.free_chat_credits_monthly,
            gen_ai_credits=settings.free_gen_ai_credits_monthly
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize user credits"
            )
        
        # Return the new credits
        new_credits = await firestore.get_user_credits(current_user)
        if not new_credits:
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve initialized user credits"
            )
        
        logger.info(f"Initialized user {current_user} with {new_credits.chat_credits} chat credits and {new_credits.gen_ai_credits} genAI credits")
        return new_credits
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initializing user: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error initializing user"
        )


@router.get(
    "/users/credits",
    response_model=UserCredits,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "User not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    }
)
async def get_user_credits(
    current_user: str = Depends(get_current_user)
) -> UserCredits:
    """
    Get user's current credit balance.
    
    Returns the user's chat and genAI credit balances.
    """
    firestore = get_firestore_service()
    
    try:
        credits = await firestore.get_user_credits(current_user)
        if not credits:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        return credits
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user credits: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error getting user credits"
        )


@router.post(
    "/users/migrate-credits",
    responses={
        200: {"description": "Migration completed successfully"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    }
)
async def migrate_user_credits(
    current_user: str = Depends(get_current_user)
):
    """
    Migrate existing user to new credit system.
    
    This endpoint ensures existing users have proper credit documents.
    """
    firestore = get_firestore_service()
    settings = get_settings()
    
    try:
        # Initialize user if they don't exist
        result = await initialize_user(current_user)
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "User credits migrated successfully",
                "chat_credits": result.chat_credits,
                "gen_ai_credits": result.gen_ai_credits
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error migrating user credits: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error migrating user credits"
        )